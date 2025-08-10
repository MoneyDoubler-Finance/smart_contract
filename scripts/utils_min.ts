import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { readFileSync } from "fs";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

export type MinimalProgramBundle = {
  idl: anchor.Idl;
  programId: PublicKey;
  program: anchor.Program;
  provider: anchor.AnchorProvider;
};

export function getProvider(): anchor.AnchorProvider {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  return provider;
}

export function loadProgramFromIdl(
  path: string = "target/idl/pump.json",
  provider?: anchor.AnchorProvider,
): MinimalProgramBundle {
  const rawIdl = JSON.parse(readFileSync(path, "utf8")) as any;
  const programId = new PublicKey(rawIdl.address);
  const idlClean: any = { ...rawIdl };
  delete (idlClean as any).accounts;
  const resolvedProvider = provider ?? getProvider();
  const program = new anchor.Program(
    idlClean as anchor.Idl,
    programId,
    resolvedProvider,
  );
  return {
    idl: idlClean as anchor.Idl,
    programId,
    program,
    provider: resolvedProvider,
  };
}

export function deriveGlobalConfigPda(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global-config")],
    programId,
  );
  return pda;
}

export function deriveBondingCurvePda(
  programId: PublicKey,
  mint: PublicKey,
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    programId,
  );
  return pda;
}

export function getCurveTokenAccount(
  mint: PublicKey,
  bondingCurve: PublicKey,
): PublicKey {
  return getAssociatedTokenAddressSync(
    mint,
    bondingCurve,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
}

export function getOwnerTokenAccount(
  mint: PublicKey,
  owner: PublicKey,
): PublicKey {
  return getAssociatedTokenAddressSync(
    mint,
    owner,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
}
