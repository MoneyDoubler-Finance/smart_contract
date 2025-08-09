import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
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

  const tx = await program.methods
    .migrate(nonce)
    .accounts({ payer: provider.wallet.publicKey })
    .rpc();

  console.log("MIGRATE tx:", tx);
}

main().catch((e) => { console.error(e); process.exit(1); });
