import * as anchor from '@coral-xyz/anchor';
import { SystemProgram, PublicKey } from '@solana/web3.js';
import { readFileSync } from 'fs';


async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idl = JSON.parse(readFileSync('target/idl/pump.json','utf8'));
  // In Anchor >=0.30, Program constructor takes (idl, provider) and reads programId from idl.address
  const program = new anchor.Program(idl as anchor.Idl, provider);
  const PROGRAM_ID = program.programId as PublicKey;

  const [globalConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('global-config')],
    PROGRAM_ID
  );

  // Fill with sensible defaults; adjust as needed
  const new_config: any = {
    authority: provider.wallet.publicKey,
    feeRecipient: provider.wallet.publicKey,
    curveLimit: new anchor.BN(5_000_000_000), // 5 SOL in lamports
    initialVirtualTokenReserves: new anchor.BN(2_000_000_000),
    initialVirtualSolReserves: new anchor.BN(1_000_000_000), // 1 SOL in lamports
    initialRealTokenReserves: new anchor.BN(0),
    totalTokenSupply: new anchor.BN(1_000_000_000_000),
    buyFeePercent: 0.02,
    sellFeePercent: 0.02,
    migrationFeePercent: 0.05,
  };

  const tx = await program.methods
    .configure(new_config)
    .accounts({
      admin: provider.wallet.publicKey,
      globalConfig,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log('configure tx:', tx);
}
main().catch(e => { console.error(e); process.exit(1); });
