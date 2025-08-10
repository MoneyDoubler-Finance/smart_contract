import * as anchor from '@coral-xyz/anchor';
import { ComputeBudgetProgram, PublicKey } from '@solana/web3.js';
import { readFileSync } from 'fs';

const PROGRAM_ID = new PublicKey('CaCK9zpnvkdwmzbTX45k99kBFAb9zbAm1EU8YoVWTFcB');

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idl = JSON.parse(readFileSync('target/idl/pump.json','utf8'));
  const program = new anchor.Program(idl as anchor.Idl, provider);

  // IDL shows: migrate(nonce: u8) and accounts: { payer: signer }
  const nonceEnv = process.env.NONCE ?? "0";
  const nonce = Number(nonceEnv);
  if (Number.isNaN(nonce) || nonce < 0 || nonce > 255) {
    throw new Error("Set NONCE to an integer 0..255");
  }

  const builder = (program as any).methods
    .migrate(nonce)
    .accounts({ payer: provider.wallet.publicKey });

  const ix = await builder.instruction();
  const tx = new anchor.web3.Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }))
    .add(ix);
  const sig = await provider.sendAndConfirm(tx);

  console.log("MIGRATE tx:", sig);
  const txm = await provider.connection.getTransaction(sig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
  const cu = txm?.meta?.computationalUnitsConsumed;
  if (cu !== undefined) console.log('Compute units used:', cu);
}

main().catch((e) => { console.error(e); process.exit(1); });
