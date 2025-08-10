import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { readFileSync } from 'fs';
import { parseFlags } from './shared';

async function main() {
  const flags = parseFlags(process.argv);
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idl = JSON.parse(readFileSync('target/idl/pump.json','utf8'));
  const program = new anchor.Program(idl as anchor.Idl, provider);

  // IDL shows: migrate(nonce: u8) and accounts: { payer: signer, raydium_program, meteora_program }
  const nonceEnv = flags.nonce ?? process.env.NONCE ?? '0';
  const nonce = Number(nonceEnv);
  if (Number.isNaN(nonce) || nonce < 0 || nonce > 255) {
    throw new Error('Set --nonce or NONCE to an integer 0..255');
  }

  const raydium = new PublicKey(flags.raydium || process.env.RAYDIUM_AMM_PROGRAM || '11111111111111111111111111111111');
  const meteora = new PublicKey(flags.meteora || process.env.METEORA_PROGRAM || '11111111111111111111111111111111');

  const tx = await program.methods
    .migrate(nonce)
    .accounts({ payer: provider.wallet.publicKey, raydiumProgram: raydium, meteoraProgram: meteora } as any)
    .rpc();

  console.log('MIGRATE tx:', tx);
}

main().catch((e) => { console.error(e); process.exit(1); });
