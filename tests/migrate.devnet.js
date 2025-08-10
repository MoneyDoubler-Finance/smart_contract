const anchor = require('@coral-xyz/anchor');
const { BN } = anchor;
const { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Connection } = require('@solana/web3.js');
const { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { readFileSync } = require('fs');
const assert = require('assert').strict;

const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

async function ensureAirdrop(conn, pubkey, minLamports = 2 * LAMPORTS_PER_SOL) {
  const bal = await conn.getBalance(pubkey);
  if (bal >= minLamports) return;
  const sig = await conn.requestAirdrop(pubkey, minLamports - bal);
  await conn.confirmTransaction({ signature: sig, ...(await conn.getLatestBlockhash()) });
}

function globalConfigPda(programId) {
  return PublicKey.findProgramAddressSync([Buffer.from('global-config')], programId)[0];
}
function bondingCurvePda(programId, mint) {
  return PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), mint.toBuffer()], programId)[0];
}
function metadataPda(mint) {
  return PublicKey.findProgramAddressSync([
    Buffer.from('metadata'),
    METADATA_PROGRAM_ID.toBuffer(),
    mint.toBuffer(),
  ], METADATA_PROGRAM_ID)[0];
}

function buildProvider() {
  // Use env-configured provider/wallet (devnet), avoids airdrop rate limits if wallet is funded
  return anchor.AnchorProvider.env({ preflightCommitment: 'confirmed', commitment: 'confirmed' });
}

function loadProgram(provider) {
  const idl = JSON.parse(readFileSync('target/idl/pump.json', 'utf8'));
  const program = new anchor.Program(idl, provider);
  return { program, programId: new PublicKey(idl.address), idl };
}

describe('migrate: ensure curve completion and failure cases', () => {
  const provider = buildProvider();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const { program, programId, idl } = loadProgram(provider);

  const buyer = Keypair.generate();

  let currentConfig = null;

  async function configureAndFetch() {
    await ensureAirdrop(connection, provider.wallet.publicKey);
    const cfg = {
      authority: provider.wallet.publicKey,
      feeRecipient: provider.wallet.publicKey,
      curveLimit: new BN(800_000), // small for speed
      initialVirtualTokenReserves: new BN(500_000_000_000),
      initialVirtualSolReserves: new BN(0),
      initialRealTokenReserves: new BN(0),
      totalTokenSupply: new BN(1_000_000_000_000),
      buyFeePercent: 0,
      sellFeePercent: 0,
      migrationFeePercent: 0,
    };
    const globalConfig = globalConfigPda(programId);
    try {
      await program.methods
        .configure(cfg)
        .accounts({
          admin: provider.wallet.publicKey,
          globalConfig,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (_) {}
    currentConfig = await program.account.config.fetch(globalConfig);
    return globalConfig;
  }

  async function launch(name, symbol, uri) {
    const tokenMint = Keypair.generate();
    const globalConfig = globalConfigPda(programId);
    const bondingCurve = bondingCurvePda(programId, tokenMint.publicKey);
    const curveTokenAccount = getAssociatedTokenAddressSync(tokenMint.publicKey, bondingCurve, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const tokenMetadataAccount = metadataPda(tokenMint.publicKey);

    await program.methods
      .launch(name, symbol, uri)
      .accounts({
        creator: provider.wallet.publicKey,
        globalConfig,
        tokenMint: tokenMint.publicKey,
        bondingCurve,
        curveTokenAccount,
        tokenMetadataAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        metadataProgram: METADATA_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([tokenMint])
      .rpc();

    return { tokenMint: tokenMint.publicKey, bondingCurve, curveTokenAccount };
  }

  it('fails migrate when curve not completed', async function () {
    const globalConfig = await configureAndFetch();
    const { tokenMint, bondingCurve, curveTokenAccount } = await launch('MigA', 'MIGA', 'https://example.com/a.json');

    await ensureAirdrop(connection, buyer.publicKey, 1 * LAMPORTS_PER_SOL);

    await program.methods
      .swap(currentConfig.curveLimit.div(new BN(10)), 0, new BN(0))
      .accounts({
        user: buyer.publicKey,
        globalConfig,
        feeRecipient: currentConfig.feeRecipient,
        bondingCurve,
        tokenMint,
        curveTokenAccount,
        userTokenAccount: getAssociatedTokenAddressSync(tokenMint, buyer.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    // Require admin; skip on shared devnet when not admin
    const isAdmin = currentConfig.authority.toBase58() === provider.wallet.publicKey.toBase58();
    if (!isAdmin) {
      this.skip();
    }

    let failed = false;
    try {
      // Try migrate using current IDL (may only require payer)
      if (idl.instructions.find((ix) => ix.name === 'migrate').accounts.length === 1) {
        await program.methods
          .migrate(0)
          .accounts({ payer: provider.wallet.publicKey })
          .rpc();
      } else {
        await program.methods
          .migrate(0)
          .accounts({ payer: provider.wallet.publicKey, globalConfig, tokenMint, bondingCurve })
          .rpc();
      }
    } catch (e) {
      failed = true;
      assert.match(String(e.message || e), /Curve is not completed yet|6000/);
    }
    assert.ok(failed, 'expected migrate to fail when curve not completed');
  });

  it('migrate succeeds after curve complete, and second migrate fails (already migrated)', async function () {
    const globalConfig = await configureAndFetch();
    const { tokenMint, bondingCurve, curveTokenAccount } = await launch('MigB', 'MIGB', 'https://example.com/b.json');

    await ensureAirdrop(connection, buyer.publicKey, 2 * LAMPORTS_PER_SOL);

    // Buy enough to complete curve
    await program.methods
      .swap(currentConfig.curveLimit, 0, new BN(0))
      .accounts({
        user: buyer.publicKey,
        globalConfig,
        feeRecipient: currentConfig.feeRecipient,
        bondingCurve,
        tokenMint,
        curveTokenAccount,
        userTokenAccount: getAssociatedTokenAddressSync(tokenMint, buyer.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const curveAcct = await program.account.bondingCurve.fetch(bondingCurve);
    assert.equal(curveAcct.isCompleted, true);

    const isAdmin = currentConfig.authority.toBase58() === provider.wallet.publicKey.toBase58();
    if (!isAdmin) {
      this.skip();
    }

    // Happy path migrate (handle old/new IDL)
    try {
      if (idl.instructions.find((ix) => ix.name === 'migrate').accounts.length === 1) {
        await program.methods
          .migrate(0)
          .accounts({ payer: provider.wallet.publicKey })
          .rpc();
      } else {
        await program.methods
          .migrate(0)
          .accounts({ payer: provider.wallet.publicKey, globalConfig, tokenMint, bondingCurve })
          .rpc();
      }
    } catch (e) {
      // If first attempt fails due to IDL mismatch, try other signature
      await program.methods
        .migrate(0)
        .accounts({ payer: provider.wallet.publicKey, globalConfig, tokenMint, bondingCurve })
        .rpc();
    }

    // Second migrate should fail (already migrated via ProgramCompleted)
    let failed = false;
    try {
      if (idl.instructions.find((ix) => ix.name === 'migrate').accounts.length === 1) {
        await program.methods
          .migrate(0)
          .accounts({ payer: provider.wallet.publicKey })
          .rpc();
      } else {
        await program.methods
          .migrate(0)
          .accounts({ payer: provider.wallet.publicKey, globalConfig, tokenMint, bondingCurve })
          .rpc();
      }
    } catch (e) {
      failed = true;
      assert.match(String(e.message || e), /Program is completed|Custom|0x/i);
    }
    assert.ok(failed, 'expected second migrate to fail (already migrated)');
  });
});