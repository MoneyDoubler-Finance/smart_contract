import * as anchor from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { readFileSync } from 'fs';

// Program IDs
const PROGRAM_ID = new PublicKey('CaCK9zpnvkdwmzbTX45k99kBFAb9zbAm1EU8YoVWTFcB');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

// ---- EDIT THESE BEFORE RUNNING ----
const MINT_STR = process.env.MINT!;              // e.g. BTGKofy2wh57...
const LAMPORTS  = process.env.LAMPORTS!;         // e.g. "10000000" for 0.01 SOL
// -----------------------------------

async function main() {
  if (!MINT_STR || !LAMPORTS) throw new Error('Set MINT and LAMPORTS env vars');

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idl = JSON.parse(readFileSync('target/idl/pump.json', 'utf8'));
  const program = new anchor.Program(idl as anchor.Idl, provider);

  const mint = new PublicKey(MINT_STR);

  const [globalConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('global-config')],
    PROGRAM_ID
  );

  // Fetch config to get fee recipient
  const cfg: any = await (program.account as any).config.fetch(globalConfig);
  const feeRecipient: PublicKey = new PublicKey(cfg.feeRecipient);

  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), mint.toBuffer()],
    PROGRAM_ID
  );

  const curveTokenAccount = getAssociatedTokenAddressSync(
    mint,
    bondingCurve,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const userTokenAccount = getAssociatedTokenAddressSync(
    mint,
    provider.wallet.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const accounts = {
    user: provider.wallet.publicKey,
    globalConfig,
    feeRecipient,
    bondingCurve,
    tokenMint: mint,
    curveTokenAccount,
    userTokenAccount,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  };

  const amount = new anchor.BN(LAMPORTS);
  const direction = 0; // 0 = buy, 1 = sell
  const minOut = new anchor.BN(0); // no slippage protection for smoke test

  const tx = await program.methods
    .swap(amount, direction, minOut)
    .accounts(accounts)
    .rpc();

  console.log('BUY tx:', tx);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
