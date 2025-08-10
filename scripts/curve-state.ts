import { PublicKey } from '@solana/web3.js';
import {
  bondingCurvePda,
  getProgram,
  globalConfigPda,
  parseBondingCurve,
  parseFlags,
  fetchAccountData,
} from './shared';

function help() {
  console.log('Usage: ts-node --transpile-only scripts/curve-state.ts --mint <MINT>  (env: ANCHOR_PROVIDER_URL, ANCHOR_WALLET)');
}

async function main() {
  const flags = parseFlags(process.argv);
  if (flags.help) return help();

  const mintStr = flags.mint as string;
  if (!mintStr) return help();

  const { PROGRAM_ID, provider } = getProgram();
  const connection = provider.connection;

  const mint = new PublicKey(mintStr);
  const globalConfig = globalConfigPda(PROGRAM_ID);
  const bondingCurve = bondingCurvePda(PROGRAM_ID, mint);

  const data = await fetchAccountData(connection, bondingCurve);
  const parsed = parseBondingCurve(data);

  console.log(JSON.stringify({
    programId: PROGRAM_ID.toBase58(),
    mint: mint.toBase58(),
    globalConfig: globalConfig.toBase58(),
    bondingCurve: bondingCurve.toBase58(),
    reserves: {
      virtualToken: parsed.virtualTokenReserves.toString(),
      virtualSol: parsed.virtualSolReserves.toString(),
      realToken: parsed.realTokenReserves.toString(),
      realSol: parsed.realSolReserves.toString(),
      totalSupply: parsed.tokenTotalSupply.toString(),
    },
    isCompleted: parsed.isCompleted,
    migrationCompleted: parsed.migrationCompleted,
  }));
}

main().catch((e) => {
  if (process.argv.includes('--help')) return help();
  console.error(e);
  process.exit(1);
});
