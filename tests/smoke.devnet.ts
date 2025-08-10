import * as anchor from '@coral-xyz/anchor';
import { BN } from '@coral-xyz/anchor';
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Connection } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, getAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { readFileSync } from 'fs';
import { strict as assert } from 'assert';

// Metaplex NFT metadata program ID
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// Helper: airdrop and confirm
async function ensureAirdrop(conn: Connection, pubkey: PublicKey, minLamports: number = 2 * LAMPORTS_PER_SOL) {
  const bal = await conn.getBalance(pubkey);
  if (bal >= minLamports) return;
  const sig = await conn.requestAirdrop(pubkey, minLamports - bal);
  await conn.confirmTransaction({ signature: sig, ...(await conn.getLatestBlockhash()) });
}

// Derive PDA helpers
function globalConfigPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('global-config')], programId)[0];
}
function bondingCurvePda(programId: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), mint.toBuffer()], programId)[0];
}
function metadataPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([
    Buffer.from('metadata'),
    METADATA_PROGRAM_ID.toBuffer(),
    mint.toBuffer(),
  ], METADATA_PROGRAM_ID)[0];
}

// Build a provider explicitly on devnet if env is not set
function buildProvider(): anchor.AnchorProvider {
  const url = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';
  // Use Anchor default wallet discovery; require ANCHOR_WALLET or local Solana CLI keypair
  const provider = anchor.AnchorProvider.env({ preflightCommitment: 'confirmed', commitment: 'confirmed' } as any);
  // If env had no cluster, override connection
  const conn = new Connection(url, 'confirmed');
  return new anchor.AnchorProvider(conn, provider.wallet, { preflightCommitment: 'confirmed', commitment: 'confirmed' });
}

// Load program from IDL on disk
function loadProgram(provider: anchor.AnchorProvider) {
  const idl = JSON.parse(readFileSync('target/idl/pump.json', 'utf8')) as anchor.Idl & { address: string };
  const programId = new PublicKey(idl.address);
  // Anchor 0.30 supports Program(idl, provider) reading idl.address
  const program = new anchor.Program(idl as any, provider);
  return { program, programId };
}

describe('devnet smoke: configure → launch → buy until completion → release_reserves', () => {
  const provider = buildProvider();
  anchor.setProvider(provider);
  const connection = provider.connection;

  const { program, programId } = loadProgram(provider);

  const buyer = Keypair.generate();
  const recipient = Keypair.generate();

  const totalTokenSupply = new BN(1_000_000_000_000); // 1e12 with 6 decimals
  const curveLimit = new BN(1_200_000); // 0.0012 SOL

  it('configure: sets config and rejects non-admin update', async () => {
    // ensure admin funded
    await ensureAirdrop(connection, (provider.wallet as any).publicKey);

    const cfg = {
      authority: (provider.wallet as any).publicKey,
      feeRecipient: (provider.wallet as any).publicKey,
      curveLimit: curveLimit,
      initialVirtualTokenReserves: new BN(500_000_000_000),
      initialVirtualSolReserves: new BN(0),
      initialRealTokenReserves: new BN(0),
      totalTokenSupply: totalTokenSupply,
      buyFeePercent: 0,
      sellFeePercent: 0,
      migrationFeePercent: 0,
    };

    const globalConfig = globalConfigPda(programId);

    await (program as any).methods
      .configure(cfg)
      .accounts({
        admin: (provider.wallet as any).publicKey,
        globalConfig,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Try to reconfigure with a random non-admin signer
    const rando = Keypair.generate();
    await ensureAirdrop(connection, rando.publicKey, 1 * LAMPORTS_PER_SOL);
    const cfg2 = { ...cfg, buyFeePercent: 1 };
    let threw = false;
    try {
      await (program as any).methods
        .configure(cfg2)
        .accounts({ admin: rando.publicKey, globalConfig, systemProgram: SystemProgram.programId })
        .signers([rando])
        .rpc();
    } catch (e: any) {
      threw = true;
      // Expect custom NotAuthorized message
      assert.match(String(e.message || e), /Not authorized address|Custom|0x/i);
    }
    assert.ok(threw, 'expected configure with non-admin to fail');
  });

  it('launch: mints supply into curve ATA', async () => {
    const tokenMint = Keypair.generate();
    const globalConfig = globalConfigPda(programId);
    const bondingCurve = bondingCurvePda(programId, tokenMint.publicKey);
    const curveTokenAccount = getAssociatedTokenAddressSync(tokenMint.publicKey, bondingCurve, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const tokenMetadataAccount = metadataPda(tokenMint.publicKey);

    const name = 'SmokeToken';
    const symbol = 'SMK';
    const uri = 'https://example.com/smoke.json';

    await (program as any).methods
      .launch(name, symbol, uri)
      .accounts({
        creator: (provider.wallet as any).publicKey,
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

    // Buy enough to complete curve, then release
    await ensureAirdrop(connection, buyer.publicKey, 2 * LAMPORTS_PER_SOL);

    // Pre-sanity: recipient funded minimally so we can compare deltas
    await ensureAirdrop(connection, recipient.publicKey, 1 * LAMPORTS_PER_SOL);

    // Perform a buy that should push reserves >= curveLimit
    const sig1 = await (program as any).methods
      .swap(new BN(curveLimit.toNumber()), 0, new BN(0))
      .accounts({
        user: buyer.publicKey,
        globalConfig,
        feeRecipient: (provider.wallet as any).publicKey,
        bondingCurve,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount,
        userTokenAccount: getAssociatedTokenAddressSync(tokenMint.publicKey, buyer.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();
    const tx1 = await connection.getTransaction(sig1, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
    const cu1 = tx1?.meta?.computationalUnitsConsumed;
    if (cu1 !== undefined) console.log('swap buy CU:', cu1);

    // Ensure curve is completed
    const curveAcct: any = await (program as any).account.bondingCurve.fetch(bondingCurve);
    assert.equal(curveAcct.isCompleted, true);

    // Balances before release
    const [curveInfoBefore, recipientBefore, curveAtaBefore] = await Promise.all([
      connection.getAccountInfo(bondingCurve),
      connection.getBalance(recipient.publicKey),
      getAccount(connection, curveTokenAccount).catch(() => null as any),
    ]);
    assert.ok(curveInfoBefore, 'curve account must exist');
    const minRent = await connection.getMinimumBalanceForRentExemption(curveInfoBefore!.data.length);
    const curveLamportsBefore = curveInfoBefore!.lamports;
    const curveTokenRawBefore = curveAtaBefore ? BigInt(curveAtaBefore.amount.toString()) : 0n;

    // Call release_reserves (happy path)
    await (program as any).methods
      .releaseReserves()
      .accounts({
        admin: (provider.wallet as any).publicKey,
        globalConfig,
        bondingCurve,
        recipient: recipient.publicKey,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount,
        recipientTokenAccount: getAssociatedTokenAddressSync(tokenMint.publicKey, recipient.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Post balances
    const [curveInfoAfter, recipientAfter] = await Promise.all([
      connection.getAccountInfo(bondingCurve),
      connection.getBalance(recipient.publicKey),
    ]);

    assert.ok(curveInfoAfter, 'curve account should remain (rent-exempt)');
    assert.equal(curveInfoAfter!.lamports, minRent, 'curve PDA should be drained to rent');
    assert.ok(recipientAfter >= recipientBefore + (curveLamportsBefore - minRent), 'recipient received drained SOL');

    // Curve ATA should be closed; recipient ATA should hold tokens
    const curveAtaAfter = await connection.getAccountInfo(curveTokenAccount);
    assert.equal(curveAtaAfter, null, 'curve ATA should be closed');

    const recipientAta = getAssociatedTokenAddressSync(tokenMint.publicKey, recipient.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const recipToken = await getAccount(connection, recipientAta);
    const recipAmount = BigInt(recipToken.amount.toString());
    assert.ok(recipAmount >= curveTokenRawBefore, 'recipient received tokens from curve ATA');
  });

  it('release_reserves fails if curve not completed', async () => {
    // fresh mint/curve with small buy below limit
    const tokenMint = Keypair.generate();
    const globalConfig = globalConfigPda(programId);
    const bondingCurve = bondingCurvePda(programId, tokenMint.publicKey);
    const curveTokenAccount = getAssociatedTokenAddressSync(tokenMint.publicKey, bondingCurve, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const tokenMetadataAccount = metadataPda(tokenMint.publicKey);

    await (program as any).methods
      .launch('Smoke2', 'SMK2', 'https://example.com/smoke2.json')
      .accounts({
        creator: (provider.wallet as any).publicKey,
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

    await ensureAirdrop(connection, buyer.publicKey, 1 * LAMPORTS_PER_SOL);
    const sig2 = await (program as any).methods
      .swap(new BN(curveLimit.toNumber() / 10), 0, new BN(0))
      .accounts({
        user: buyer.publicKey,
        globalConfig,
        feeRecipient: (provider.wallet as any).publicKey,
        bondingCurve,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount,
        userTokenAccount: getAssociatedTokenAddressSync(tokenMint.publicKey, buyer.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();
    const tx2 = await connection.getTransaction(sig2, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
    const cu2 = tx2?.meta?.computationalUnitsConsumed;
    if (cu2 !== undefined) console.log('swap buy (below limit) CU:', cu2);

    let failed = false;
    try {
      await (program as any).methods
        .releaseReserves()
        .accounts({
          admin: (provider.wallet as any).publicKey,
          globalConfig,
          bondingCurve,
          recipient: recipient.publicKey,
          tokenMint: tokenMint.publicKey,
          curveTokenAccount,
          recipientTokenAccount: getAssociatedTokenAddressSync(tokenMint.publicKey, recipient.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (e: any) {
      failed = true;
      assert.match(String(e.message || e), /Curve is not completed yet|6000/);
    }
    assert.ok(failed, 'expected CurveNotCompleted');
  });
});