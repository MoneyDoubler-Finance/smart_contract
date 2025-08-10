const anchor = require("@coral-xyz/anchor");
const {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Connection,
} = require("@solana/web3.js");
const {
  getAssociatedTokenAddressSync,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");
const { readFileSync } = require("fs");
const assert = require("assert");

const METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);

async function ensureAirdrop(conn, pubkey, minLamports = 2 * LAMPORTS_PER_SOL) {
  const bal = await conn.getBalance(pubkey);
  if (bal >= minLamports) return;
  const sig = await conn.requestAirdrop(pubkey, minLamports - bal);
  await conn.confirmTransaction({
    signature: sig,
    ...(await conn.getLatestBlockhash()),
  });
}

function globalConfigPda(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("global-config")],
    programId,
  )[0];
}
function bondingCurvePda(programId, mint) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    programId,
  )[0];
}
function metadataPda(mint) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    METADATA_PROGRAM_ID,
  )[0];
}

function buildProviderWithAdmin(adminKp) {
  const url =
    process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com";
  const conn = new Connection(url, "confirmed");
  const wallet = {
    publicKey: adminKp.publicKey,
    signTransaction: async (tx) => {
      tx.partialSign(adminKp);
      return tx;
    },
    signAllTransactions: async (txs) =>
      txs.map((t) => {
        t.partialSign(adminKp);
        return t;
      }),
    payer: adminKp,
  };
  return new anchor.AnchorProvider(conn, wallet, {
    preflightCommitment: "confirmed",
    commitment: "confirmed",
  });
}

function loadProgram(provider) {
  const idl = JSON.parse(readFileSync("target/idl/pump.json", "utf8"));
  const programId = new PublicKey(idl.address);
  const program = new anchor.Program(idl, provider);
  return { program, programId };
}

describe("devnet smoke: configure → launch → buy until completion → release_reserves", () => {
  const admin = Keypair.generate();
  const provider = buildProviderWithAdmin(admin);
  anchor.setProvider(provider);
  const connection = provider.connection;
  const { program, programId } = loadProgram(provider);

  const buyer = Keypair.generate();
  const recipient = Keypair.generate();

  let currentConfig = null;

  it("configure or load existing config; NotAuthorized acceptable on shared devnet", async () => {
    await ensureAirdrop(connection, admin.publicKey);

    const cfg = {
      authority: admin.publicKey,
      feeRecipient: admin.publicKey,
      curveLimit: new anchor.BN(1_200_000),
      initialVirtualTokenReserves: new anchor.BN(500_000_000_000),
      initialVirtualSolReserves: new anchor.BN(0),
      initialRealTokenReserves: new anchor.BN(0),
      totalTokenSupply: new anchor.BN(1_000_000_000_000),
      buyFeePercent: 0,
      sellFeePercent: 0,
      migrationFeePercent: 0,
    };

    const globalConfig = globalConfigPda(programId);

    try {
      await program.methods
        .configure(cfg)
        .accounts({
          admin: admin.publicKey,
          globalConfig,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (e) {
      // If NotAuthorized, proceed with existing config
      assert.match(String(e.message || e), /Not authorized address|Custom|0x/i);
    }

    currentConfig = await program.account.config.fetch(globalConfig);
    assert.ok(currentConfig, "global config must exist on devnet");
  });

  it("launch + swap to completion + release_reserves (skips release if not admin)", async function () {
    const tokenMint = Keypair.generate();
    const globalConfig = globalConfigPda(programId);
    const bondingCurve = bondingCurvePda(programId, tokenMint.publicKey);
    const curveTokenAccount = getAssociatedTokenAddressSync(
      tokenMint.publicKey,
      bondingCurve,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const tokenMetadataAccount = metadataPda(tokenMint.publicKey);

    await program.methods
      .launch("SmokeToken", "SMK", "https://example.com/smoke.json")
      .accounts({
        creator: admin.publicKey,
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
      .signers([tokenMint])
      .rpc();

    await ensureAirdrop(connection, buyer.publicKey, 2 * LAMPORTS_PER_SOL);
    await ensureAirdrop(connection, recipient.publicKey, 1 * LAMPORTS_PER_SOL);

    // Use configured fee recipient and curve limit
    const feeRecipient = currentConfig.feeRecipient;
    const limitBn = currentConfig.curveLimit; // Anchor returns BN

    await program.methods
      .swap(limitBn, 0, new anchor.BN(0))
      .accounts({
        user: buyer.publicKey,
        globalConfig,
        feeRecipient,
        bondingCurve,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount,
        userTokenAccount: getAssociatedTokenAddressSync(
          tokenMint.publicKey,
          buyer.publicKey,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const curveAcct = await program.account.bondingCurve.fetch(bondingCurve);
    assert.equal(curveAcct.isCompleted, true);

    const [curveInfoBefore, recipientBefore] = await Promise.all([
      connection.getAccountInfo(bondingCurve),
      connection.getBalance(recipient.publicKey),
    ]);
    assert.ok(curveInfoBefore);
    const minRent = await connection.getMinimumBalanceForRentExemption(
      curveInfoBefore.data.length,
    );
    const curveLamportsBefore = curveInfoBefore.lamports;

    let curveTokenRawBefore = 0n;
    try {
      const curveAtaBefore = await getAccount(connection, curveTokenAccount);
      curveTokenRawBefore = BigInt(curveAtaBefore.amount.toString());
    } catch {}

    // Only the admin (config.authority) can call release_reserves
    const isAdmin =
      currentConfig.authority.toBase58() === admin.publicKey.toBase58();
    if (!isAdmin) {
      this.skip();
    }

    await program.methods
      .releaseReserves()
      .accounts({
        admin: admin.publicKey,
        globalConfig,
        bondingCurve,
        recipient: recipient.publicKey,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount,
        recipientTokenAccount: getAssociatedTokenAddressSync(
          tokenMint.publicKey,
          recipient.publicKey,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const [curveInfoAfter, recipientAfter] = await Promise.all([
      connection.getAccountInfo(bondingCurve),
      connection.getBalance(recipient.publicKey),
    ]);
    assert.ok(curveInfoAfter);
    assert.equal(curveInfoAfter.lamports, minRent);
    assert.ok(
      recipientAfter >= recipientBefore + (curveLamportsBefore - minRent),
    );

    const curveAtaAfter = await connection.getAccountInfo(curveTokenAccount);
    assert.equal(curveAtaAfter, null);

    const recipientAta = getAssociatedTokenAddressSync(
      tokenMint.publicKey,
      recipient.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const recipToken = await getAccount(connection, recipientAta);
    const recipAmount = BigInt(recipToken.amount.toString());
    assert.ok(recipAmount >= curveTokenRawBefore);
  });

  it("release_reserves fails if curve not completed (skipped if not admin)", async function () {
    const tokenMint = Keypair.generate();
    const globalConfig = globalConfigPda(programId);
    const bondingCurve = bondingCurvePda(programId, tokenMint.publicKey);
    const curveTokenAccount = getAssociatedTokenAddressSync(
      tokenMint.publicKey,
      bondingCurve,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const tokenMetadataAccount = metadataPda(tokenMint.publicKey);

    await program.methods
      .launch("Smoke2", "SMK2", "https://example.com/smoke2.json")
      .accounts({
        creator: admin.publicKey,
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
      .signers([tokenMint])
      .rpc();

    await ensureAirdrop(connection, buyer.publicKey, 1 * LAMPORTS_PER_SOL);
    await program.methods
      .swap(
        currentConfig.curveLimit.div(new anchor.BN(10)),
        0,
        new anchor.BN(0),
      )
      .accounts({
        user: buyer.publicKey,
        globalConfig,
        feeRecipient: currentConfig.feeRecipient,
        bondingCurve,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount,
        userTokenAccount: getAssociatedTokenAddressSync(
          tokenMint.publicKey,
          buyer.publicKey,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const isAdmin =
      currentConfig.authority.toBase58() === admin.publicKey.toBase58();
    if (!isAdmin) {
      this.skip();
    }

    let failed = false;
    try {
      await program.methods
        .releaseReserves()
        .accounts({
          admin: admin.publicKey,
          globalConfig,
          bondingCurve,
          recipient: recipient.publicKey,
          tokenMint: tokenMint.publicKey,
          curveTokenAccount,
          recipientTokenAccount: getAssociatedTokenAddressSync(
            tokenMint.publicKey,
            recipient.publicKey,
            false,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
          ),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (e) {
      failed = true;
      assert.match(String(e.message || e), /Curve is not completed yet|6000/);
    }
    assert.ok(failed);
  });
});
