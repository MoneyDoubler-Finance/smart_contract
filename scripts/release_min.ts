import * as anchor from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { readFileSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  getAssociatedTokenAddressSync,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

async function main() {
  const MINT = process.env.MINT;
  const RECIPIENT = process.env.RECIPIENT;
  const WALLET_JSON = process.env.ANCHOR_WALLET_JSON;
  const PROVIDER_URL = process.env.ANCHOR_PROVIDER_URL;

  if (!MINT || !RECIPIENT || !WALLET_JSON || !PROVIDER_URL) {
    const missing = [
      !MINT ? 'MINT' : null,
      !RECIPIENT ? 'RECIPIENT' : null,
      !WALLET_JSON ? 'ANCHOR_WALLET_JSON' : null,
      !PROVIDER_URL ? 'ANCHOR_PROVIDER_URL' : null,
    ].filter(Boolean);
    console.log(`send skipped: missing env -> ${missing.join(', ')}`);
    return;
  }

  // Materialize wallet JSON to a temp file for Anchor
  const tmp = mkdtempSync(join(tmpdir(), 'anchor-wallet-'));
  const walletPath = join(tmp, 'id.json');
  writeFileSync(walletPath, WALLET_JSON, { encoding: 'utf8', mode: 0o600 });
  process.env.ANCHOR_WALLET = walletPath;
  process.env.ANCHOR_PROVIDER_URL = PROVIDER_URL;

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const rawIdl = JSON.parse(readFileSync('target/idl/pump.json', 'utf8'));
  const PROGRAM_ID = new PublicKey(rawIdl.address);
  const idlClean: any = { ...rawIdl };
  delete idlClean.accounts; // avoid Anchor account coder build on funky IDL
  const prog = new anchor.Program(idlClean as anchor.Idl, PROGRAM_ID, provider);

  const mint = new PublicKey(MINT);
  const recipient = new PublicKey(RECIPIENT);

  const [globalConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('global-config')],
    PROGRAM_ID
  );
  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), mint.toBuffer()],
    PROGRAM_ID
  );

  const curveTokenAccount = getAssociatedTokenAddressSync(
    mint, bondingCurve, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const recipientTokenAccount = getAssociatedTokenAddressSync(
    mint, recipient, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const conn = provider.connection;
  const [curveLamportsBefore, recipientLamportsBefore] = await Promise.all([
    conn.getBalance(bondingCurve),
    conn.getBalance(recipient),
  ]);

  let curveTokensBefore = '0';
  try { curveTokensBefore = (await getAccount(conn, curveTokenAccount)).amount.toString(); } catch {}

  const tx = await (prog as any).methods
    .releaseReserves()
    .accounts({
      admin: (provider.wallet as any).publicKey,
      globalConfig,
      bondingCurve,
      recipient,
      tokenMint: mint,
      curveTokenAccount,
      recipientTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  const [curveLamportsAfter, recipientLamportsAfter] = await Promise.all([
    conn.getBalance(bondingCurve),
    conn.getBalance(recipient),
  ]);

  let curveTokensAfter = '0';
  try { curveTokensAfter = (await getAccount(conn, curveTokenAccount)).amount.toString(); } catch {}

  const report = {
    tx,
    programId: PROGRAM_ID.toBase58(),
    mint: mint.toBase58(),
    bondingCurve: bondingCurve.toBase58(),
    curveTokenAccount: curveTokenAccount.toBase58(),
    recipient: recipient.toBase58(),
    recipientTokenAccount: recipientTokenAccount.toBase58(),
    before: {
      curveLamports: curveLamportsBefore,
      recipientLamports: recipientLamportsBefore,
      curveTokenRaw: curveTokensBefore,
    },
    after: {
      curveLamports: curveLamportsAfter,
      recipientLamports: recipientLamportsAfter,
      curveTokenRaw: curveTokensAfter,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
