import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import {
  buildAccountsFromIdl,
  buildPreview,
  getInstructionIdl,
  getProgram,
  globalConfigPda,
  parseFlags,
  SYS,
} from './shared';

function help() {
  console.log('Usage: ts-node --transpile-only scripts/configure.ts [--fees 0.05] [--send]  (env: ANCHOR_PROVIDER_URL, ANCHOR_WALLET)');
}

async function main() {
  const flags = parseFlags(process.argv);
  if (flags.help) return help();

  const { program, idl, PROGRAM_ID, provider } = getProgram();

  const fees = typeof flags.fees === 'number' ? flags.fees : 0.05;

  const ixIdl = getInstructionIdl(idl, ['configure']);

  const globalConfig = globalConfigPda(PROGRAM_ID);

  // Build config struct according to IDL types (uses snake_case field names from IDL)
  const new_config: any = {
    authority: provider.wallet.publicKey,
    fee_recipient: provider.wallet.publicKey,
    curve_limit: new anchor.BN(5_000_000_000),
    initial_virtual_token_reserves: new anchor.BN(2_000_000_000),
    initial_virtual_sol_reserves: new anchor.BN(1_000_000_000),
    initial_real_token_reserves: new anchor.BN(0),
    total_token_supply: new anchor.BN(1_000_000_000_000),
    buy_fee_percent: fees,
    sell_fee_percent: fees,
    migration_fee_percent: fees,
  };

  const accounts = buildAccountsFromIdl(ixIdl.accounts, {
    admin: provider.wallet.publicKey,
    global_config: globalConfig,
    system_program: SYS.SystemProgram.programId,
  } as any);

  buildPreview('configure', PROGRAM_ID, accounts as any, { new_config });

  const builder = (program as any).methods.configure(new_config).accounts(accounts);
  if (!flags.send) {
    await builder.instruction(); // ensure it encodes without sending
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
