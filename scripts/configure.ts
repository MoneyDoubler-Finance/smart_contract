import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { readFileSync } from 'fs';

export const PROGRAM_ID = new PublicKey('CaCK9zpnvkdwmzbTX45k99kBFAb9zbAm1EU8YoVWTFcB');
export const RAYDIUM_ADAPTER_ID = new PublicKey('2q8EXsQ99V7F3pQq8gGjt6o3vijqjCEYazA2Yh4S4ray');

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idl = JSON.parse(readFileSync('target/idl/pump.json','utf8'));
  const program = new anchor.Program(idl as anchor.Idl, provider);

  console.log('Program ID', program.programId.toBase58());
}

main().catch((e) => { console.error(e); process.exit(1); });
