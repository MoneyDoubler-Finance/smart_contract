import * as anchor from '@coral-xyz/anchor';
import { BN } from '@coral-xyz/anchor';
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Connection } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { readFileSync } from 'fs';
import { strict as assert } from 'assert';

const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

async function ensureAirdrop(conn: Connection, pubkey: PublicKey, minLamports: number = 2 * LAMPORTS_PER_SOL) {
  const bal = await conn.getBalance(pubkey);
  if (bal >= minLamports) return;
  const sig = await conn.requestAirdrop(pubkey, minLamports - bal);
  await conn.confirmTransaction({ signature: sig, ...(await conn.getLatestBlockhash()) });
}

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

function buildProvider(): anchor.AnchorProvider {
  const url = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';
  const conn = new Connection(url, 'confirmed');
  const wallet = new anchor.Wallet(Keypair.generate());
  return new anchor.AnchorProvider(conn, wallet, { preflightCommitment: 'confirmed', commitment: 'confirmed' } as any);
}

function loadProgram(provider: anchor.AnchorProvider) {
  const idl = JSON.parse(readFileSync('target/idl/pump.json', 'utf8')) as anchor.Idl & { address: string };
  const program = new anchor.Program(idl as any, provider);
  return { program, programId: new PublicKey(idl.address) };
}

describe('migrate: ensure curve completion and failure cases', () => {
  const provider = buildProvider();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const { program, programId } = loadProgram(provider);

  const buyer = Keypair.generate();

  const totalTokenSupply = new BN(1_000_000_000_000); // 1e12 with 6 decimals
  const curveLimit = new BN(800_000); // 0.0008 SOL for speed

  async function configure() {
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
    return globalConfig;
  }

  async function launch(name: string, symbol: string, uri: string) {
    const tokenMint = Keypair.generate();
    const globalConfig = globalConfigPda(programId);
    const bondingCurve = bondingCurvePda(programId, tokenMint.publicKey);
    const curveTokenAccount = getAssociatedTokenAddressSync(tokenMint.publicKey, bondingCurve, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const tokenMetadataAccount = metadataPda(tokenMint.publicKey);

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

    return { tokenMint: tokenMint.publicKey, bondingCurve, curveTokenAccount };
  }

  it('fails migrate when curve not completed', async () => {
    await configure();
    const { tokenMint, bondingCurve, curveTokenAccount } = await launch('MigA', 'MIGA', 'https://example.com/a.json');

    await ensureAirdrop(connection, buyer.publicKey, 1 * LAMPORTS_PER_SOL);
    const globalConfig = globalConfigPda(programId);

    await (program as any).methods
      .swap(curveLimit.div(new BN(10)), 0, new BN(0))
      .accounts({
        user: buyer.publicKey,
        globalConfig,
        feeRecipient: (provider.wallet as any).publicKey,
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

    let failed = false;
    try {
      await (program as any).methods
        .migrate(0)
        .accounts({
          payer: (provider.wallet as any).publicKey,
          globalConfig,
          tokenMint,
          bondingCurve,
        })
        .rpc();
    } catch (e: any) {
      failed = true;
      assert.match(String(e.message || e), /Curve is not completed yet|6000/);
    }
    assert.ok(failed, 'expected migrate to fail when curve not completed');
  });

  it('migrate succeeds after curve complete, and second migrate fails (already migrated)', async () => {
    await configure();
    const { tokenMint, bondingCurve, curveTokenAccount } = await launch('MigB', 'MIGB', 'https://example.com/b.json');

    await ensureAirdrop(connection, buyer.publicKey, 2 * LAMPORTS_PER_SOL);
    const globalConfig = globalConfigPda(programId);

    // Buy enough to complete curve
    await (program as any).methods
      .swap(curveLimit, 0, new BN(0))
      .accounts({
        user: buyer.publicKey,
        globalConfig,
        feeRecipient: (provider.wallet as any).publicKey,
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

    // Sanity: curve completed
    const curveAcct: any = await (program as any).account.bondingCurve.fetch(bondingCurve);
    assert.equal(curveAcct.isCompleted, true);

    // Happy path migrate
    await (program as any).methods
      .migrate(0)
      .accounts({
        payer: (provider.wallet as any).publicKey,
        globalConfig,
        tokenMint,
        bondingCurve,
      })
      .rpc();

    // Second migrate should fail due to global ProgramCompleted guard
    let failed = false;
    try {
      await (program as any).methods
        .migrate(0)
        .accounts({
          payer: (provider.wallet as any).publicKey,
          globalConfig,
          tokenMint,
          bondingCurve,
        })
        .rpc();
    } catch (e: any) {
      failed = true;
      assert.match(String(e.message || e), /Program is completed|Custom|0x/i);
    }
    assert.ok(failed, 'expected second migrate to fail (already migrated)');
  });
});
