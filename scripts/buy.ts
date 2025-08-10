import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
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
} from "./shared";

function help() {
  console.log(
    "Usage: ts-node --transpile-only scripts/buy.ts --mint <MINT> --lamports <LAMPORTS> [--send]  (env: ANCHOR_PROVIDER_URL, ANCHOR_WALLET)",
  );
}

async function main() {
  const flags = parseFlags(process.argv);
  if (flags.help) return help();

  const mintStr = flags.mint as string;
  const lamports = flags.lamports as number;
  if (!mintStr || lamports === undefined) return help();

  const { program, idl, PROGRAM_ID, provider } = getProgram();
  const connection = provider.connection;

  const mint = new PublicKey(mintStr);
  const ixIdl = getInstructionIdl(idl, ["swap"]);

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
  const minOut = new anchor.BN(0);

  const decimals = await getMintDecimals(connection, mint);

  buildPreview(
    "buy",
    PROGRAM_ID,
    accounts as any,
    { amount: amount.toString(), direction, minOut: minOut.toString() },
    {
      mint: mint.toBase58(),
      mintDecimals: decimals,
      lamports,
    },
  );

  const builder = (program as any).methods
    .swap(amount, direction, minOut)
    .accounts(accounts);
  if (!flags.send) {
    await builder.instruction();
    console.log("Dry-run. Pass --send to submit.");
    return;
  }
  const sig = await builder.rpc();
  console.log("Signature:", sig);
}

main().catch((e) => {
  if (process.argv.includes("--help")) return help();
  console.error(e);
  process.exit(1);
});
