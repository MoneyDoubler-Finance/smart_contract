import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, getMint, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';

const RPC = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';
const MINT_STR = process.env.MINT!;

async function main() {
  if (!MINT_STR) throw new Error('Set MINT env var');
  const mintPk = new PublicKey(MINT_STR);

  const conn = new Connection(RPC, 'confirmed');
  const wallet = (anchor.AnchorProvider.env().wallet as any).payer?.publicKey
              || anchor.AnchorProvider.env().wallet.publicKey;

  const mint = await getMint(conn, mintPk);
  const decimals = mint.decimals;

  const ata = getAssociatedTokenAddressSync(mintPk, wallet, false, TOKEN_PROGRAM_ID);
  let ataBal = 'N/A';
  try {
    const acct = await getAccount(conn, ata);
    ataBal = acct.amount.toString();
  } catch (_) {}

  console.log(JSON.stringify({
    wallet: wallet.toBase58(),
    mint: mintPk.toBase58(),
    decimals,
    ata: ata.toBase58(),
    ataBalanceRaw: ataBal
  }, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
