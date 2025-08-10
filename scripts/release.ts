import { PublicKey } from "@solana/web3.js";
import {
  buildAccountsFromIdl,
  buildPreview,
  bondingCurvePda,
  curveAta,
  getInstructionIdl,
  getProgram,
  globalConfigPda,
  ownerAta,
  parseFlags,
  SPL,
  SYS,
} from "./shared";

function help() {
  console.log(
    "Usage: ts-node --transpile-only scripts/release.ts --mint <MINT> --recipient <RECIPIENT> [--send]",
  );
}

async function main() {
  const flags = parseFlags(process.argv);
  if (flags.help) return help();

  const mintStr = flags.mint as string;
  const recipientStr = flags.recipient as string;
  if (!mintStr || !recipientStr) return help();

  const { program, idl, PROGRAM_ID, provider } = getProgram();

  const ixIdl = getInstructionIdl(idl, ["release_reserves", "releaseReserves"]);

  const mint = new PublicKey(mintStr);
  const recipient = new PublicKey(recipientStr);
  const globalConfig = globalConfigPda(PROGRAM_ID);
  const bondingCurve = bondingCurvePda(PROGRAM_ID, mint);
  const curveTokenAccount = curveAta(mint, bondingCurve);
  const recipientTokenAccount = ownerAta(mint, recipient);

  const accounts = buildAccountsFromIdl(ixIdl.accounts, {
    admin: provider.wallet.publicKey,
    global_config: globalConfig,
    token_mint: mint,
    bonding_curve: bondingCurve,
    recipient,
    curve_token_account: curveTokenAccount,
    recipient_token_account: recipientTokenAccount,
    token_program: SPL.TOKEN_PROGRAM_ID,
    associated_token_program: SPL.ASSOCIATED_TOKEN_PROGRAM_ID,
    system_program: SYS.SystemProgram.programId,
  } as any);

  buildPreview("release_reserves", PROGRAM_ID, accounts as any, {});

  const builder = (program as any).methods[ixIdl.name]().accounts(accounts);
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
