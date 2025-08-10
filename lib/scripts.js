"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateTx = exports.withdrawTx = exports.swapTx = exports.launchTokenTx = exports.createConfigTx = void 0;
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
const constant_1 = require("./constant");
const spl_token_1 = require("@solana/spl-token");
const createConfigTx = async (admin, newConfig, connection, program) => {
    const [configPda, _] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constant_1.SEED_CONFIG)], program.programId);
    console.log("configPda: ", configPda.toBase58());
    const tx = await program.methods
        .configure(newConfig)
        .accounts({
        payer: admin,
    })
        .transaction();
    tx.feePayer = admin;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    return tx;
};
exports.createConfigTx = createConfigTx;
const launchTokenTx = async (name, symbol, uri, user, connection, program) => {
    const tokenKp = web3_js_1.Keypair.generate();
    console.log("token address: ", tokenKp.publicKey.toBase58());
    // Send the transaction to launch a token
    const tx = await program.methods
        .launch(
    //  metadata
    name, symbol, uri)
        .accounts({
        creator: user,
        token: tokenKp.publicKey,
        teamWallet: user,
    })
        .transaction();
    tx.feePayer = user;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(tokenKp);
    return tx;
};
exports.launchTokenTx = launchTokenTx;
const swapTx = async (user, token, amount, style, connection, program) => {
    const [configPda, _] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constant_1.SEED_CONFIG)], program.programId);
    const configAccount = await program.account.config.fetch(configPda);
    const tx = await program.methods
        .swap(new anchor_1.BN(amount), style, new anchor_1.BN(amount))
        .accounts({
        teamWallet: configAccount.teamWallet,
        user,
        tokenMint: token,
    })
        .transaction();
    tx.feePayer = user;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    return tx;
};
exports.swapTx = swapTx;
const withdrawTx = async (user, token, connection, program) => {
    const [configPda, _] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constant_1.SEED_CONFIG)], program.programId);
    const configAccount = await program.account.config.fetch(configPda);
    console.log(token);
    const tx = await program.methods
        .withdraw()
        .accounts({
        tokenMint: token,
    })
        .transaction();
    tx.feePayer = user;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    return tx;
};
exports.withdrawTx = withdrawTx;
const migrateTx = async (payer, token, market, connection, program) => {
    const configPda = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constant_1.SEED_CONFIG)], program.programId)[0];
    const configAccount = await program.account.config.fetch(configPda);
    const nonce = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("amm authority")], constant_1.ammProgram)[1];
    console.log("nonce: ", nonce);
    const bondingCurve = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constant_1.SEED_BONDING_CURVE), token.toBytes()], program.programId)[0];
    console.log("bondingCurve: ", bondingCurve.toBase58());
    const globalVault = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("global")], program.programId)[0];
    console.log("globalVault: ", globalVault.toBase58());
    const tx = new web3_js_1.Transaction()
        .add(web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({ units: 500000 }))
        .add(await program.methods
        .migrate(nonce)
        .accounts({
        teamWallet: configAccount.teamWallet,
        ammProgram: constant_1.ammProgram,
        coinMint: token,
        pcMint: spl_token_1.NATIVE_MINT,
        market,
        marketProgram: constant_1.marketProgram,
        payer,
        feeDestination: constant_1.feeDestination
    })
        .transaction());
    tx.feePayer = payer;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    return tx;
};
exports.migrateTx = migrateTx;
