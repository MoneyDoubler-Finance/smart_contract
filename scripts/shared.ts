import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { readFileSync } from 'fs';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getMint,
} from '@solana/spl-token';

export const DEFAULT_KEYPAIR =
  process.env.ANCHOR_WALLET || `${process.env.HOME}/.config/solana/id.json`;

export const RAYDIUM_AMM_PROGRAM = new PublicKey('11111111111111111111111111111111'); // <fill if required by IDL>
export const OPENBOOK_MARKET_PROGRAM = new PublicKey('11111111111111111111111111111111'); // <fill if required by IDL>

export function getProvider(): anchor.AnchorProvider {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  return provider;
}

export function loadIdl(): any {
  const raw = readFileSync('target/idl/pump.json', 'utf8');
  const idl = JSON.parse(raw);
  if (!idl?.address) throw new Error('IDL missing address');
  return idl;
}

export function getProgram() {
  const provider = getProvider();
  const idl = loadIdl();
  const idlClean: any = { ...idl };
  // Avoid anchor trying to build account coders from non-standard "accounts" entries
  // We'll parse accounts manually from raw data using the type layouts below.
  delete idlClean.accounts;
  const program = new anchor.Program(idlClean as anchor.Idl, provider);
  const PROGRAM_ID = new PublicKey(idl.address);
  return { program, idl, PROGRAM_ID, provider };
}

export function findPda(seeds: Array<string | Buffer | PublicKey>, programId: PublicKey): [PublicKey, number] {
  const resolved = seeds.map((s) => (typeof s === 'string' ? Buffer.from(s) : s instanceof PublicKey ? s.toBuffer() : s));
  return PublicKey.findProgramAddressSync(resolved, programId);
}

export function globalConfigPda(programId: PublicKey): PublicKey {
  return findPda(['global-config'], programId)[0];
}

export function bondingCurvePda(programId: PublicKey, mint: PublicKey): PublicKey {
  return findPda(['bonding-curve', mint], programId)[0];
}

export function curveAta(mint: PublicKey, curve: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, curve, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
}

export function ownerAta(mint: PublicKey, owner: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
}

export function toCamelCase(snake: string): string {
  return snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function getInstructionIdl(idl: any, nameCandidates: string[]): { name: string; accounts: Array<{ name: string }> } {
  for (const cand of nameCandidates) {
    const found = idl.instructions.find((ix: any) => ix.name === cand);
    if (found) return { name: cand, accounts: found.accounts || [] };
  }
  throw new Error(`Instruction not found in IDL. Tried: ${nameCandidates.join(', ')}`);
}

export function buildAccountsFromIdl(
  idlAccounts: Array<{ name: string }>,
  valueMap: Record<string, PublicKey>
): Record<string, PublicKey> {
  const out: Record<string, PublicKey> = {};
  for (const acct of idlAccounts) {
    const snake = acct.name;
    const camel = toCamelCase(snake);
    const value = valueMap[snake] || valueMap[camel];
    if (!value) {
      const provided = Object.keys(valueMap).join(', ');
      throw new Error(`Missing required account for ${snake}. Provided keys: ${provided}`);
    }
    out[camel] = value;
  }
  return out;
}

export function buildPreview(
  label: string,
  programId: PublicKey,
  accounts: Record<string, PublicKey>,
  args: any,
  extras?: Record<string, any>
) {
  const json = {
    action: label,
    programId: programId.toBase58(),
    accounts: Object.fromEntries(Object.entries(accounts).map(([k, v]) => [k, (v as PublicKey).toBase58()])),
    args,
    ...extras,
  };
  console.log(JSON.stringify(json));
}

export async function maybeSend(
  builder: any,
  send: boolean,
  signers: Keypair[] = []
): Promise<{ signature?: string; instruction: TransactionInstruction }> {
  const ix: TransactionInstruction = await builder.instruction();
  if (!send) {
    return { instruction: ix };
  }
  const { provider } = getProgram();
  const tx = new Transaction().add(ix);
  const sig = await provider.sendAndConfirm(tx, signers);
  return { signature: sig, instruction: ix };
}

export async function getMintDecimals(connection: Connection, mint: PublicKey): Promise<number> {
  const mintInfo = await getMint(connection, mint);
  return mintInfo.decimals;
}

export async function fetchAccountData(connection: Connection, pubkey: PublicKey): Promise<Buffer> {
  const info = await connection.getAccountInfo(pubkey);
  if (!info || !info.data) throw new Error(`Account not found: ${pubkey.toBase58()}`);
  return info.data as Buffer;
}

// Manual parsing helpers for non-standard IDL account coders
export function parseConfig(data: Buffer): {
  authority: PublicKey;
  feeRecipient: PublicKey;
  curveLimit: anchor.BN;
  initialVirtualTokenReserves: anchor.BN;
  initialVirtualSolReserves: anchor.BN;
  initialRealTokenReserves: anchor.BN;
  totalTokenSupply: anchor.BN;
  buyFeePercent: number;
  sellFeePercent: number;
  migrationFeePercent: number;
} {
  let o = 8; // discriminator
  const readPub = () => {
    const pk = new PublicKey(data.slice(o, o + 32));
    o += 32;
    return pk;
  };
  const readU64 = () => {
    const v = new anchor.BN(data.slice(o, o + 8), 10, 'le');
    o += 8;
    return v;
  };
  const readF64 = () => {
    const v = data.readDoubleLE(o);
    o += 8;
    return v;
  };
  const authority = readPub();
  const feeRecipient = readPub();
  const curveLimit = readU64();
  const initialVirtualTokenReserves = readU64();
  const initialVirtualSolReserves = readU64();
  const initialRealTokenReserves = readU64();
  const totalTokenSupply = readU64();
  const buyFeePercent = readF64();
  const sellFeePercent = readF64();
  const migrationFeePercent = readF64();
  return {
    authority,
    feeRecipient,
    curveLimit,
    initialVirtualTokenReserves,
    initialVirtualSolReserves,
    initialRealTokenReserves,
    totalTokenSupply,
    buyFeePercent,
    sellFeePercent,
    migrationFeePercent,
  };
}

export function parseBondingCurve(data: Buffer): {
  virtualTokenReserves: anchor.BN;
  virtualSolReserves: anchor.BN;
  realTokenReserves: anchor.BN;
  realSolReserves: anchor.BN;
  tokenTotalSupply: anchor.BN;
  isCompleted: boolean;
} {
  let o = 8; // discriminator
  const readU64 = () => {
    const v = new anchor.BN(data.slice(o, o + 8), 10, 'le');
    o += 8;
    return v;
  };
  const readBool = () => {
    const v = data[o] !== 0;
    o += 1;
    return v;
  };
  const virtualTokenReserves = readU64();
  const virtualSolReserves = readU64();
  const realTokenReserves = readU64();
  const realSolReserves = readU64();
  const tokenTotalSupply = readU64();
  const isCompleted = readBool();
  return {
    virtualTokenReserves,
    virtualSolReserves,
    realTokenReserves,
    realSolReserves,
    tokenTotalSupply,
    isCompleted,
  };
}

export function requireFlag<T>(flags: Record<string, any>, key: string, help: string): T {
  const v = flags[key];
  if (v === undefined || v === null || v === '') {
    throw new Error(help);
  }
  return v as T;
}

export function parseFlags(argv: string[]): Record<string, any> {
  const flags: Record<string, any> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const [k, vRaw] = a.includes('=') ? a.split('=') : [a, 'true'];
    const key = k.replace(/^--/, '');
    let v: any = vRaw;
    if (vRaw === 'true') v = true;
    else if (vRaw === 'false') v = false;
    else if (/^-?\d+$/.test(vRaw)) v = parseInt(vRaw, 10);
    else if (/^-?\d+\.\d+$/.test(vRaw)) v = parseFloat(vRaw);
    flags[key] = v;
  }
  // env fallbacks
  if (flags.mint === undefined && process.env.MINT) flags.mint = process.env.MINT;
  if (flags.recipient === undefined && process.env.RECIPIENT) flags.recipient = process.env.RECIPIENT;
  if (flags.lamports === undefined && process.env.LAMPORTS) flags.lamports = parseInt(process.env.LAMPORTS, 10);
  if (flags.rawTokens === undefined && process.env.RAW_TOKENS) flags.rawTokens = process.env.RAW_TOKENS;
  if (flags.feeRecipient === undefined && process.env.FEE_RECIPIENT) flags.feeRecipient = process.env.FEE_RECIPIENT;
  // dry-run default true unless --send is passed
  flags.send = !!flags.send;
  flags.dryRun = !flags.send;
  return flags;
}

export const SPL = {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
};

export const SYS = {
  SystemProgram,
};