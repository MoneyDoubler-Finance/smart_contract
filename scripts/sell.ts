import * as anchor from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { readFileSync } from 'fs';

const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

// ---- EDIT THESE BEFORE RUNNING ----
// RAW token amount in base units (respect mint decimals!)
// e.g. if decimals=6, RAW_TOKENS="1000000" means 1.0 token.
const MINT_STR = process.env.MINT!;
const RAW_TOKENS = process.env.RAW_TOKENS!;
// -----------------------------------

async function main() {
  if (!MINT_STR || !RAW_TOKENS) throw new Error('Set MINT and RAW_TOKENS env vars');

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idl = JSON.parse(readFileSync('target/idl/pump.json','utf8'));
  const program = new anchor.Program(idl as anchor.Idl, provider);
  const PROGRAM_ID = program.programId as PublicKey;

  const mint = new PublicKey(MINT_STR);

  const [globalConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('global-config')],
    PROGRAM_ID
  );

  const cfg: any = await (program.account as any).config.fetch(globalConfig);
  const feeRecipient = new PublicKey(cfg.feeRecipient);

  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), mint.toBuffer()],
    PROGRAM_ID
  );

  const curveTokenAccount = getAssociatedTokenAddressSync(
    mint, bondingCurve, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const userTokenAccount = getAssociatedTokenAddressSync(
    mint, provider.wallet.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
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

  const amount = new anchor.BN(RAW_TOKENS); // tokens in base units
  const direction = 1; // 0 = buy, 1 = sell
  const minOut = new anchor.BN(0); // lamports min-out; set >0 later for slippage

  const tx = await program.methods
    .swap(amount, direction, minOut)
    .accounts(accounts)
    .rpc();

  console.log('SELL tx:', tx);
}
main().catch(e => { console.error(e); process.exit(1); });
