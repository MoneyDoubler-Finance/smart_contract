import * as anchor from '@coral-xyz/anchor';
import {
  Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { readFileSync } from 'fs';

const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const METADATA_PROGRAM_ID          = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idl = JSON.parse(readFileSync('target/idl/pump.json','utf8'));
  // In Anchor >=0.30, Program constructor takes (idl, provider) and reads programId from idl.address
  const program = new anchor.Program(idl as anchor.Idl, provider);
  const PROGRAM_ID = program.programId as PublicKey;

  // Change these:
  const name   = 'TestToken';
  const symbol = 'TST';
  const uri    = 'https://example.com/metadata.json';

  const [globalConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('global-config')],
    PROGRAM_ID
  );

  const tokenMint = Keypair.generate();

  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), tokenMint.publicKey.toBuffer()],
    PROGRAM_ID
  );

  // ATA(owner = bondingCurve PDA, mint = tokenMint), owner off-curve allowed
  const curveTokenAccount = getAssociatedTokenAddressSync(
    tokenMint.publicKey,
    bondingCurve,
    true, // owner off-curve
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Metaplex metadata PDA
  const [tokenMetadataAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      METADATA_PROGRAM_ID.toBuffer(),
      tokenMint.publicKey.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );

  const tx = await program.methods
    .launch(name, symbol, uri)
    .accounts({
      creator: provider.wallet.publicKey,
      globalConfig,
      tokenMint: tokenMint.publicKey,
      bondingCurve,
      curveTokenAccount,
      tokenMetadataAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      metadataProgram: METADATA_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([tokenMint]) // IDL says token_mint is a signer
    .rpc();

  console.log('launch tx:', tx);
  console.log('mint:', tokenMint.publicKey.toBase58());
}
main().catch(e => { console.error(e); process.exit(1); });
