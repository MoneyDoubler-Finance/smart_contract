import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import {
  buildAccountsFromIdl,
  buildPreview,
  getInstructionIdl,
  getProgram,
  globalConfigPda,
  parseFlags,
  curveAta,
  SPL,
  SYS,
} from './shared';

function help() {
  console.log('Usage: ts-node --transpile-only scripts/launch.ts [--name NAME --symbol SYM --uri URL] [--send]  (env: ANCHOR_PROVIDER_URL, ANCHOR_WALLET)');
}

async function main() {
  const flags = parseFlags(process.argv);
  if (flags.help) return help();

  const name = (flags.name as string) || 'TestToken';
  const symbol = (flags.symbol as string) || 'TST';
  const uri = (flags.uri as string) || 'https://example.com/metadata.json';

  const { program, idl, PROGRAM_ID, provider } = getProgram();

  const ixIdl = getInstructionIdl(idl, ['launch']);

  const tokenMint = Keypair.generate();
  const globalConfig = globalConfigPda(PROGRAM_ID);

  // compute bonding curve PDA idempotently
  const [bondingCurvePk] = PublicKey.findProgramAddressSync([
    Buffer.from('bonding-curve'),
    tokenMint.publicKey.toBuffer(),
  ], PROGRAM_ID);

  const curveTokenAccount = curveAta(tokenMint.publicKey, bondingCurvePk);

  // Metaplex metadata PDA uses fixed program id from IDL accounts list when present
  const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
  const [tokenMetadataAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      METADATA_PROGRAM_ID.toBuffer(),
      tokenMint.publicKey.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );

  const accounts = buildAccountsFromIdl(ixIdl.accounts, {
    creator: provider.wallet.publicKey,
    global_config: globalConfig,
    token_mint: tokenMint.publicKey,
    bonding_curve: bondingCurvePk,
    curve_token_account: curveTokenAccount,
    token_metadata_account: tokenMetadataAccount,
    token_program: SPL.TOKEN_PROGRAM_ID,
    associated_token_program: SPL.ASSOCIATED_TOKEN_PROGRAM_ID,
    metadata_program: METADATA_PROGRAM_ID,
    system_program: SYS.SystemProgram.programId,
    rent: SYSVAR_RENT_PUBKEY,
  } as any);

  buildPreview('launch', PROGRAM_ID, accounts as any, { name, symbol, uri }, {
    mint: tokenMint.publicKey.toBase58(),
  });

  const builder = (program as any).methods.launch(name, symbol, uri).accounts(accounts).signers([tokenMint]);
  if (!flags.send) {
    await builder.instruction();
    console.log('Dry-run. Pass --send to submit.');
    return;
  }
  const sig = await builder.rpc();
  console.log('Signature:', sig);
  console.log('Mint:', tokenMint.publicKey.toBase58());
}

main().catch((e) => {
  if (process.argv.includes('--help')) return help();
  console.error(e);
  process.exit(1);
});
