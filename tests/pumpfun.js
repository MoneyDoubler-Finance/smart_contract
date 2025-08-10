"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const anchor = __importStar(require("@coral-xyz/anchor"));
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
const assert = __importStar(require("assert"));
const constant_1 = require("./constant");
const utils_1 = require("./utils");
require("dotenv").config();
describe("pumpfun", () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.Pumpfun;
    const adminKp = web3_js_1.Keypair.generate();
    const userKp = web3_js_1.Keypair.generate();
    const user2Kp = web3_js_1.Keypair.generate();
    const tokenKp = web3_js_1.Keypair.generate();
    console.log("admin: ", adminKp.publicKey.toBase58());
    console.log("user: ", userKp.publicKey.toBase58());
    console.log("user2: ", user2Kp.publicKey.toBase58());
    const connection = provider.connection;
    before(async () => {
        console.log("airdrop SOL to admin");
        const airdropTx = await connection.requestAirdrop(adminKp.publicKey, 5 * web3_js_1.LAMPORTS_PER_SOL);
        await connection.confirmTransaction({
            signature: airdropTx,
            abortSignal: AbortSignal.timeout(1000),
        });
        console.log("airdrop SOL to user");
        const airdropTx2 = await connection.requestAirdrop(userKp.publicKey, 5 * web3_js_1.LAMPORTS_PER_SOL);
        await connection.confirmTransaction({
            signature: airdropTx2,
            abortSignal: AbortSignal.timeout(1000),
        });
        console.log("airdrop SOL to user2");
        const airdropTx3 = await connection.requestAirdrop(user2Kp.publicKey, 5 * web3_js_1.LAMPORTS_PER_SOL);
        await connection.confirmTransaction({
            signature: airdropTx3,
            abortSignal: AbortSignal.timeout(1000),
        });
    });
    it("Is correctly configured", async () => {
        // Create a dummy config object to pass as argument.
        const newConfig = {
            authority: adminKp.publicKey,
            pendingAuthority: web3_js_1.PublicKey.default,
            platformMigrationFee: 0,
            teamWallet: adminKp.publicKey,
            initBondingCurve: constant_1.TEST_INIT_BONDING_CURVE,
            platformBuyFee: 5.0, // Example fee: 5%
            platformSellFee: 5.0, // Example fee: 5%
            curveLimit: new anchor_1.BN(400000000000), //  Example limit: 400 SOL
            lamportAmountConfig: new anchor_1.BN(constant_1.TEST_VIRTUAL_RESERVES),
            tokenSupplyConfig: new anchor_1.BN(constant_1.TEST_TOKEN_SUPPLY),
            tokenDecimalsConfig: constant_1.TEST_DECIMALS,
        };
        // Send the transaction to configure the program.
        const tx = await program.methods
            .configure(newConfig)
            .accounts({
            payer: adminKp.publicKey,
        })
            .signers([adminKp])
            .rpc();
        console.log("tx signature:", tx);
        // get PDA for the config account using the seed "config".
        const [configPda, _] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constant_1.SEED_CONFIG)], program.programId);
        // Log PDA details for debugging.
        console.log("config PDA:", configPda.toString());
        // Fetch the updated config account to validate the changes.
        const configAccount = await program.account.config.fetch(configPda);
        // Assertions to verify configuration
        assert.equal(configAccount.authority.toString(), adminKp.publicKey.toString());
        assert.equal(configAccount.platformBuyFee, 5);
        assert.equal(configAccount.platformSellFee, 5);
        assert.equal(configAccount.lamportAmountConfig, constant_1.TEST_VIRTUAL_RESERVES);
        assert.equal(configAccount.tokenSupplyConfig, constant_1.TEST_TOKEN_SUPPLY);
        assert.equal(configAccount.tokenDecimalsConfig, constant_1.TEST_DECIMALS);
        assert.equal(configAccount.initBondingCurve, constant_1.TEST_INIT_BONDING_CURVE);
    });
    it("Is the token created", async () => {
        console.log("token: ", tokenKp.publicKey.toBase58());
        // get PDA for the config account using the seed "config".
        const [configPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constant_1.SEED_CONFIG)], program.programId);
        const configAccount = await program.account.config.fetch(configPda);
        // Send the transaction to launch a token
        const tx = await program.methods
            .launch(
        //  metadata
        constant_1.TEST_NAME, constant_1.TEST_SYMBOL, constant_1.TEST_URI)
            .accounts({
            creator: userKp.publicKey,
            token: tokenKp.publicKey,
            teamWallet: configAccount.teamWallet,
        })
            .signers([userKp, tokenKp])
            .rpc();
        console.log("tx signature:", tx);
        // get token detailed info
        const supply = await connection.getTokenSupply(tokenKp.publicKey);
        // Assertions to verify configuration
        assert.equal(supply.value.amount, constant_1.TEST_TOKEN_SUPPLY);
        // check launch phase is 'Presale'
        const [bondingCurvePda, _] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constant_1.SEED_BONDING_CURVE), tokenKp.publicKey.toBytes()], program.programId);
        console.log("bonding curve PDA:", bondingCurvePda.toString());
        const curveAccount = await program.account.bondingCurve.fetch(bondingCurvePda);
        // Assertions to verify configuration
        assert.equal(curveAccount.creator.toBase58(), userKp.publicKey.toBase58());
        // assertions balances
        const teamTokenAccount = (0, utils_1.getAssociatedTokenAccount)(adminKp.publicKey, tokenKp.publicKey);
        const [global_vault] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constant_1.SEED_GLOBAL)], program.programId);
        const globalVaultTokenAccount = (0, utils_1.getAssociatedTokenAccount)(global_vault, tokenKp.publicKey);
        const teamTokenBalance = await connection.getTokenAccountBalance(teamTokenAccount);
        const globalVaultBalance = await connection.getTokenAccountBalance(globalVaultTokenAccount);
        assert.equal(teamTokenBalance.value.amount, (constant_1.TEST_TOKEN_SUPPLY * (100 - constant_1.TEST_INIT_BONDING_CURVE)) / 100);
        assert.equal(globalVaultBalance.value.amount, (constant_1.TEST_TOKEN_SUPPLY * constant_1.TEST_INIT_BONDING_CURVE) / 100);
    });
    // trade SOL for token
    it("Is user1's simulate swap SOL for token completed", async () => {
        // get PDA for the config account using the seed "config".
        const [configPda, _] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constant_1.SEED_CONFIG)], program.programId);
        // Log PDA details for debugging.
        console.log("config PDA:", configPda.toString());
        // Fetch the updated config account to validate the changes.
        const configAccount = await program.account.config.fetch(configPda);
        const amount = new anchor_1.BN(5000000);
        const tx = await program.methods
            .simulateSwap(amount, 0)
            .accounts({
            tokenMint: tokenKp.publicKey,
        })
            .view();
        const actualAmountOut = new anchor_1.BN(tx).toNumber();
        // amount after minus fees
        const adjustedAmount = (0, utils_1.convertFromFloat)(((0, utils_1.convertToFloat)(amount.toNumber(), constant_1.TEST_DECIMALS) *
            (100 - configAccount.platformBuyFee)) /
            100, constant_1.TEST_DECIMALS);
        const reserveToken = (constant_1.TEST_TOKEN_SUPPLY * constant_1.TEST_INIT_BONDING_CURVE) / 100;
        console.log(reserveToken);
        const amountOut = (0, utils_1.calculateAmountOutBuy)(constant_1.TEST_VIRTUAL_RESERVES, adjustedAmount, constant_1.TEST_DECIMALS, reserveToken);
        console.log("expected amount out: ", amountOut);
        console.log("actual amount out: ", actualAmountOut);
        assert.equal(actualAmountOut, Math.floor(amountOut));
    });
    it("Is user1's swap SOL for token completed", async () => {
        const [configPda, _] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constant_1.SEED_CONFIG)], program.programId);
        const configAccount = await program.account.config.fetch(configPda);
        // case 1: failed because minimum receive is too high because of slippage
        try {
            await program.methods
                .swap(new anchor_1.BN(5000000), 0, new anchor_1.BN(50000000))
                .accounts({
                teamWallet: configAccount.teamWallet,
                user: userKp.publicKey,
                tokenMint: tokenKp.publicKey,
            })
                .signers([userKp])
                .rpc();
        }
        catch (error) {
            assert.match(JSON.stringify(error), /Return amount is too small compared to the minimum received amount./);
        }
        // case 2: happy case. Send the transaction to launch a token
        const tx = await program.methods
            .swap(new anchor_1.BN(5000000), 0, new anchor_1.BN(0))
            .accounts({
            teamWallet: configAccount.teamWallet,
            user: userKp.publicKey,
            tokenMint: tokenKp.publicKey,
        })
            .signers([userKp])
            .rpc();
        console.log("tx signature:", tx);
        //  check user1's balance
        const tokenAccount = (0, utils_1.getAssociatedTokenAccount)(userKp.publicKey, tokenKp.publicKey);
        const balance = await connection.getBalance(userKp.publicKey);
        const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);
        console.log("buyer: ", userKp.publicKey.toBase58());
        console.log("lamports: ", balance);
        console.log("token amount: ", tokenBalance.value.uiAmount);
    });
    it("Is user1's swap Token for SOL completed", async () => {
        const [configPda, _] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constant_1.SEED_CONFIG)], program.programId);
        const configAccount = await program.account.config.fetch(configPda);
        // Send the transaction to launch a token
        const tx = await program.methods
            .swap(new anchor_1.BN(22000000), 1, new anchor_1.BN(0))
            .accounts({
            teamWallet: configAccount.teamWallet,
            user: userKp.publicKey,
            tokenMint: tokenKp.publicKey,
        })
            .signers([userKp])
            .rpc();
        console.log("tx signature:", tx);
        //  check user1's balance
        const tokenAccount = (0, utils_1.getAssociatedTokenAccount)(userKp.publicKey, tokenKp.publicKey);
        const balance = await connection.getBalance(userKp.publicKey);
        const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);
        console.log("buyer: ", userKp.publicKey.toBase58());
        console.log("lamports: ", balance);
        console.log("token amount: ", tokenBalance.value.uiAmount);
    });
    it("Is the curve reached the limit", async () => {
        const [configPda, _] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constant_1.SEED_CONFIG)], program.programId);
        const configAccount = await program.account.config.fetch(configPda);
        // Send the transaction to launch a token
        const tx = await program.methods
            .swap(new anchor_1.BN(4000000000), 0, new anchor_1.BN(0))
            .accounts({
            teamWallet: configAccount.teamWallet,
            user: user2Kp.publicKey,
            tokenMint: tokenKp.publicKey,
        })
            .signers([user2Kp])
            .rpc();
        console.log("tx signature:", tx);
        //  check user2's balance
        const tokenAccount = (0, utils_1.getAssociatedTokenAccount)(user2Kp.publicKey, tokenKp.publicKey);
        const balance = await connection.getBalance(user2Kp.publicKey);
        const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);
        console.log("buyer: ", user2Kp.publicKey.toBase58());
        console.log("lamports: ", balance);
        console.log("token amount: ", tokenBalance.value.uiAmount);
        // check launch phase is 'completed'
        const [bondingCurvePda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constant_1.SEED_BONDING_CURVE), tokenKp.publicKey.toBytes()], program.programId);
        const curveAccount = await program.account.bondingCurve.fetch(bondingCurvePda);
        // Assertions to verify configuration
        assert.equal(curveAccount.isCompleted, true);
        assert.equal(curveAccount.reserveLamport.toNumber(), configAccount.curveLimit.toNumber());
    });
});
