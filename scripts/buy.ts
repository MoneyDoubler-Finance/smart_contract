import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import {
  buildAccountsFromIdl,
  buildPreview,
  getInstructionIdl,
  getMintDecimals,
  getProgram,
  globalConfigPda,
  ownerAta,
  parseConfig,
  parseFlags,
  SPL,
  SYS,
  bondingCurvePda,
  fetchAccountData,
  curveAta,
} from './shared';

function help() {
  console.log('Usage: ts-node --transpile-only scripts/buy.ts --mint <MINT> --lamports <LAMPORTS> [--minOut <MIN_RAW>] [--slippageBps <BPS>] [--send]  (env: ANCHOR_PROVIDER_URL, ANCHOR_WALLET)');
}

async function main() {
  const flags = parseFlags(process.argv);
  if (flags.help) return help();

  const mintStr = flags.mint as string;
  const lamports = flags.lamports as number;
  if (!mintStr || lamports === undefined) return help();

  const minOutFlag = flags.minOut !== undefined ? BigInt(flags.minOut) : BigInt(0);
  const slippageBps = typeof flags.slippageBps === 'number' ? flags.slippageBps : undefined;

  const { program, idl, PROGRAM_ID, provider } = getProgram();
  const connection = provider.connection;

  const mint = new PublicKey(mintStr);
  const ixIdl = getInstructionIdl(idl, ['swap']);

  const globalConfig = globalConfigPda(PROGRAM_ID);
  const cfgData = await fetchAccountData(connection, globalConfig);
  const cfg = parseConfig(cfgData);
  const feeRecipient = cfg.feeRecipient;

  const bondingCurve = bondingCurvePda(PROGRAM_ID, mint);
  const curveTokenAccount = curveAta(mint, bondingCurve);
  const userTokenAccount = ownerAta(mint, provider.wallet.publicKey);

  const accounts = buildAccountsFromIdl(ixIdl.accounts, {
    user: provider.wallet.publicKey,
    global_config: globalConfig,
    fee_recipient: feeRecipient,
    bonding_curve: bondingCurve,
    token_mint: mint,
    curve_token_account: curveTokenAccount,
    user_token_account: userTokenAccount,
    token_program: SPL.TOKEN_PROGRAM_ID,
    associated_token_program: SPL.ASSOCIATED_TOKEN_PROGRAM_ID,
    system_program: SYS.SystemProgram.programId,
  } as any);

  const amount = new anchor.BN(lamports);
  const direction = 0; // 0=buy

  // Users must specify at least one of --minOut or --slippageBps
  let minOutBn: anchor.BN;
  if (minOutFlag > 0n) {
    minOutBn = new anchor.BN(minOutFlag.toString());
  } else if (slippageBps !== undefined) {
    // conservative placeholder: require at least (lamports * (10000 - bps))/10000 out in raw units
    // actual on-chain calc determines amountOut; this simply protects users from 100% loss by default
    const minOutApprox = BigInt(Math.floor((lamports * (10000 - slippageBps)) / 10000));
    minOutBn = new anchor.BN(minOutApprox.toString());
  } else {
    throw new Error('Provide --minOut or --slippageBps');
  }

  const decimals = await getMintDecimals(connection, mint);

  buildPreview('buy', PROGRAM_ID, accounts as any, { amount: amount.toString(), direction, min_out: minOutBn.toString() }, {
    mint: mint.toBase58(),
    mintDecimals: decimals,
    lamports,
  });

  const builder = (program as any).methods.swap(amount, direction, minOutBn).accounts(accounts);
  if (!flags.send) {
    await builder.instruction();
    console.log('Dry-run. Pass --send to submit.');
    return;
  }
  const sig = await builder.rpc();
  console.log('Signature:', sig);
}

main().catch((e) => {
  if (process.argv.includes('--help')) return help();
  console.error(e);
  process.exit(1);
});
