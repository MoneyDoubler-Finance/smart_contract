import * as anchor from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { writeFileSync } from 'fs';
import { program as loadProgram, globalConfigPda, bondingCurvePda, curveAta, recipientAta, ASSOCIATED_TOKEN_PROGRAM_ID } from './utils';

async function main() {
  const MINT = process.env.MINT!;
  const RECIPIENT = process.env.RECIPIENT!;
  if (!MINT || !RECIPIENT) throw new Error('Set MINT and RECIPIENT');

  const prog = loadProgram();
  const pid = prog.programId;
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const conn = provider.connection;

  const mint = new PublicKey(MINT);
  const recipient = new PublicKey(RECIPIENT);

  const globalConfig = globalConfigPda(pid);
  const bondingCurve = bondingCurvePda(pid, mint);
  const curveTokenAccount = curveAta(mint, bondingCurve);
  const recipientTokenAccount = recipientAta(mint, recipient);

  const [curveSolBefore, recSolBefore] = await Promise.all([
    conn.getBalance(bondingCurve),
    conn.getBalance(recipient),
  ]);

  let curveTokenBefore = '0';
  try { curveTokenBefore = (await getAccount(conn, curveTokenAccount)).amount.toString(); } catch {}

  const tx = await prog.methods
    .releaseReserves()
    .accounts({
      admin: (provider.wallet as any).publicKey,
      globalConfig,
      tokenMint: mint,
      bondingCurve,
      recipient,
      curveTokenAccount,
      recipientTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  const [curveSolAfter, recSolAfter] = await Promise.all([
    conn.getBalance(bondingCurve),
    conn.getBalance(recipient),
  ]);

  let curveTokenAfter = '0';
  try { curveTokenAfter = (await getAccount(conn, curveTokenAccount)).amount.toString(); } catch {}

  const report = {
    programId: pid.toBase58(),
    mint: mint.toBase58(),
    bondingCurve: bondingCurve.toBase58(),
    curveTokenAccount: curveTokenAccount.toBase58(),
    recipient: recipient.toBase58(),
    recipientTokenAccount: recipientTokenAccount.toBase58(),
    tx,
    before: { curveLamports: curveSolBefore, recipientLamports: recSolBefore, curveTokenRaw: curveTokenBefore },
    after: { curveLamports: curveSolAfter, recipientLamports: recSolAfter, curveTokenRaw: curveTokenAfter },
  };

  writeFileSync('release_report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
