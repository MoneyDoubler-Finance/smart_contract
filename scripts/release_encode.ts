import * as anchor from "@coral-xyz/anchor";
import { readFileSync } from "fs";
import {
  PublicKey,
  Keypair,
  Connection,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

async function main() {
  const MINT = process.env.MINT;
  if (!MINT) {
    console.log("release:encode skipped: missing MINT env");
    return;
  }

  // Provider: prefer env; otherwise create a dummy provider on devnet
  let provider: anchor.AnchorProvider | null = null;
  try {
    provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
  } catch {
    provider = null;
  }

  const rawIdl = JSON.parse(readFileSync("target/idl/pump.json", "utf8"));
  const PROGRAM_ID = new PublicKey(rawIdl.address);

  const mint = new PublicKey(MINT);

  const [globalConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("global-config")],
    PROGRAM_ID,
  );
  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    PROGRAM_ID,
  );

  const admin = provider
    ? ((provider.wallet as any).publicKey as PublicKey)
    : Keypair.generate().publicKey;
  const recipient = process.env.RECIPIENT
    ? new PublicKey(process.env.RECIPIENT)
    : admin;

  const curveTokenAccount = getAssociatedTokenAddressSync(
    mint,
    bondingCurve,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const recipientTokenAccount = getAssociatedTokenAddressSync(
    mint,
    recipient,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const instr = (rawIdl.instructions as any[]).find(
    (i) => i.name === "release_reserves",
  );
  if (!instr || !instr.discriminator) {
    throw new Error("IDL does not contain release_reserves discriminator");
  }
  const data = Buffer.from(instr.discriminator);

  const keys = [
    { pubkey: admin, isSigner: true, isWritable: true },
    { pubkey: globalConfig, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: bondingCurve, isSigner: false, isWritable: true },
    { pubkey: curveTokenAccount, isSigner: false, isWritable: true },
    { pubkey: recipient, isSigner: false, isWritable: true },
    { pubkey: recipientTokenAccount, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({ programId: PROGRAM_ID, keys, data });

  const output = {
    programId: PROGRAM_ID.toBase58(),
    mint: mint.toBase58(),
    accounts: keys.map((k) => ({
      pubkey: k.pubkey.toBase58(),
      isSigner: k.isSigner,
      isWritable: k.isWritable,
    })),
    ixBase64: Buffer.from(ix.data).toString("base64"),
    note: "Instruction encoded from IDL discriminator; this script does not send a transaction.",
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
