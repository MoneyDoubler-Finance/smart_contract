import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { readFileSync } from 'fs';

const PROGRAM_ID = new PublicKey('CaCK9zpnvkdwmzbTX45k99kBFAb9zbAm1EU8YoVWTFcB');
const MINT_STR = process.env.MINT!;

async function main() {
  if (!MINT_STR) throw new Error('Set MINT env var');
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idl = JSON.parse(readFileSync('target/idl/pump.json','utf8'));
  const program = new anchor.Program(idl as anchor.Idl, provider);

  const mint = new PublicKey(MINT_STR);
  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), mint.toBuffer()],
    PROGRAM_ID
  );

  const acct = await (program.account as any).bondingCurve.fetch(bondingCurve);
  console.log(JSON.stringify({ bondingCurve: bondingCurve.toBase58(), ...acct }, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
