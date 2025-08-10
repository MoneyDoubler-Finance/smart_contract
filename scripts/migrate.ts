import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { readFileSync } from 'fs';

const PROGRAM_ID = new PublicKey('CaCK9zpnvkdwmzbTX45k99kBFAb9zbAm1EU8YoVWTFcB');

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idl = JSON.parse(readFileSync('target/idl/pump.json','utf8'));
  const program = new anchor.Program(idl as anchor.Idl, PROGRAM_ID, provider);

  const nonceEnv = process.env.NONCE ?? "0";
  const nonce = Number(nonceEnv);
  if (Number.isNaN(nonce) || nonce < 0 || nonce > 255) {
    throw new Error("Set NONCE to an integer 0..255");
  }

  const mintStr = process.env.MINT as string;
  if (!mintStr) throw new Error("Set MINT=<token mint>");
  const tokenMint = new PublicKey(mintStr);

  const [globalConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("global-config")],
    PROGRAM_ID
  );
  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), tokenMint.toBuffer()],
    PROGRAM_ID
  );
  const curveTokenAccount = anchor.utils.token.associatedAddress({ mint: tokenMint, owner: bondingCurve });

  const adapterProgram = (anchor.workspace as any).RaydiumAdapter?.programId
    ?? new PublicKey('2q8EXsQ99V7F3pQq8gGjt6o3vijqjCEYazA2Yh4S4ray');

  const tx = await program.methods
    .migrate(nonce)
    .accounts({
      payer: provider.wallet.publicKey,
      globalConfig,
      tokenMint,
      bondingCurve,
      curveTokenAccount,
      raydiumProgram: adapterProgram,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    } as any)
    .rpc();

  console.log("MIGRATE tx:", tx);
}

main().catch((e) => { console.error(e); process.exit(1); });
