import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { readFileSync } from 'fs';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';

export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

export function provider() {
  const p = anchor.AnchorProvider.env();
  anchor.setProvider(p);
  return p;
}

export function program() {
  const raw = readFileSync('target/idl/pump.json', 'utf8');
  const idl: any = JSON.parse(raw);
  const pid = new PublicKey(idl.address);
  delete idl.accounts;
  return new anchor.Program(idl as anchor.Idl, pid, provider());
}

export function globalConfigPda(programId: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from('global-config')], programId)[0];
}

export function bondingCurvePda(programId: PublicKey, mint: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), mint.toBuffer()], programId)[0];
}

export function curveAta(mint: PublicKey, curve: PublicKey) {
  return getAssociatedTokenAddressSync(mint, curve, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
}

export function recipientAta(mint: PublicKey, recipient: PublicKey) {
  return getAssociatedTokenAddressSync(mint, recipient, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
}
