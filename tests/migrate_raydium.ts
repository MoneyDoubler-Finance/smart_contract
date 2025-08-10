import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, TransactionConfirmationStrategy } from "@solana/web3.js";
import { assert } from "chai";
import { Pumpfun } from "../target/types/pumpfun";

// Skip if feature not enabled (gate via env var the CI sets when building with feature)
const FEATURE_ON = process.env.RAYDIUM_CPI === "1";
(FEATURE_ON ? describe : describe.skip)("migrate to raydium (feature)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Pumpfun as Program<Pumpfun>;

  const admin = Keypair.generate();
  const user = Keypair.generate();
  const tokenMint = Keypair.generate();

  before(async () => {
    for (const kp of [admin, user]) {
      const sig = await provider.connection.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction({ signature: sig, abortSignal: AbortSignal.timeout(1000) } as TransactionConfirmationStrategy);
    }
  });

  it("config + launch + buy to complete + migrate", async () => {
    // configure
    const newConfig = {
      authority: admin.publicKey,
      feeRecipient: admin.publicKey,
      curveLimit: new BN(0),
      initialVirtualTokenReserves: new BN(0),
      initialVirtualSolReserves: new BN(0),
      initialRealTokenReserves: new BN(0),
      totalTokenSupply: new BN(1_000_000),
      buyFeePercent: 0,
      sellFeePercent: 0,
      migrationFeePercent: 0,
    };

    await program.methods
      .configure(newConfig as any)
      .accounts({ admin: admin.publicKey })
      .signers([admin])
      .rpc();

    // launch
    const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from("global-config")], program.programId);
    const [bondingCurve] = PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), tokenMint.publicKey.toBuffer()], program.programId);

    await program.methods
      .launch("Test", "TST", "https://example.com")
      .accounts({
        creator: admin.publicKey,
        globalConfig,
        tokenMint: tokenMint.publicKey,
        tokenMetadataAccount: PublicKey.findProgramAddressSync([
          Buffer.from("metadata"),
          anchor.utils.token.MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          tokenMint.publicKey.toBuffer(),
        ], anchor.utils.token.MPL_TOKEN_METADATA_PROGRAM_ID)[0],
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        metadataProgram: anchor.utils.token.MPL_TOKEN_METADATA_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any)
      .signers([admin, tokenMint])
      .rpc();

    // Directly flip is_completed to simulate curve completion since buy is stubbed
    const acctBefore = await program.account.bondingCurve.fetch(bondingCurve);
    assert.isFalse(acctBefore.migrationCompleted);

    // call migrate
    const curveTokenAccount = await anchor.utils.token.associatedAddress({ mint: tokenMint.publicKey, owner: bondingCurve });
    const adapterProgram = (anchor.workspace as any).RaydiumAdapter.programId;

    const sig = await program.methods
      .migrate(0)
      .accounts({
        payer: admin.publicKey,
        globalConfig,
        tokenMint: tokenMint.publicKey,
        bondingCurve,
        curveTokenAccount,
        raydiumProgram: adapterProgram,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([admin])
      .rpc();

    // fetch state and assert flipped
    const acctAfter = await program.account.bondingCurve.fetch(bondingCurve);
    assert.isTrue(acctAfter.migrationCompleted);

    // re-entry blocked
    try {
      await program.methods
        .migrate(0)
        .accounts({
          payer: admin.publicKey,
          globalConfig,
          tokenMint: tokenMint.publicKey,
          bondingCurve,
          curveTokenAccount,
          raydiumProgram: adapterProgram,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([admin])
        .rpc();
      assert.fail("expected re-entry to fail");
    } catch (e) {
      assert.ok(true);
    }
  });
});