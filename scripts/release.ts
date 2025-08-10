import * as anchor from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { readFileSync } from 'fs';

const PROGRAM_ID = new PublicKey('CaCK9zpnvkdwmzbTX45k99kBFAb9zbAm1EU8YoVWTFcB');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

async function main() {
  const MINT = process.env.MINT!;
  const RECIPIENT = process.env.RECIPIENT!;

  if (!MINT || !RECIPIENT) throw new Error('Set MINT and RECIPIENT env vars');

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idl = JSON.parse(readFileSync('target/idl/pump.json','utf8'));
  const program = new anchor.Program(idl as anchor.Idl, provider);
  console.log('Program ID used:', (program.programId as any).toBase58?.() ?? program.programId);

  const mint = new PublicKey(MINT);
  const recipient = new PublicKey(RECIPIENT);

  const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from('global-config')], program.programId);
  const [bondingCurve] = PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), mint.toBuffer()], program.programId);

  const curveTokenAccount = getAssociatedTokenAddressSync(mint, bondingCurve, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const recipientTokenAccount = getAssociatedTokenAddressSync(mint, recipient, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  const tx = await program.methods
    .releaseReserves()
    .accounts({
      admin: provider.wallet.publicKey,
      globalConfig,
      tokenMint: mint,
      bondingCurve,
      curveTokenAccount,
      recipient,
      recipientTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log('RELEASE_RESERVES tx:', tx);
}
main().catch(e => { console.error(e); process.exit(1); });


