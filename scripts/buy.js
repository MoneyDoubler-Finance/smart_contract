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
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const fs_1 = require("fs");
// Program IDs
const ASSOCIATED_TOKEN_PROGRAM_ID = new web3_js_1.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
// ---- EDIT THESE BEFORE RUNNING ----
const MINT_STR = process.env.MINT; // e.g. BTGKofy2wh57...
const LAMPORTS = process.env.LAMPORTS; // e.g. "10000000" for 0.01 SOL
// -----------------------------------
async function main() {
    if (!MINT_STR || !LAMPORTS)
        throw new Error('Set MINT and LAMPORTS env vars');
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const idl = JSON.parse((0, fs_1.readFileSync)('target/idl/pump.json', 'utf8'));
    const program = new anchor.Program(idl, provider);
    const PROGRAM_ID = program.programId;
    const mint = new web3_js_1.PublicKey(MINT_STR);
    const [globalConfig] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('global-config')], PROGRAM_ID);
    // Fetch config to get fee recipient
    const cfg = await program.account.config.fetch(globalConfig);
    const feeRecipient = new web3_js_1.PublicKey(cfg.feeRecipient);
    const [bondingCurve] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), mint.toBuffer()], PROGRAM_ID);
    const curveTokenAccount = (0, spl_token_1.getAssociatedTokenAddressSync)(mint, bondingCurve, true, spl_token_1.TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const userTokenAccount = (0, spl_token_1.getAssociatedTokenAddressSync)(mint, provider.wallet.publicKey, false, spl_token_1.TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const accounts = {
        user: provider.wallet.publicKey,
        globalConfig,
        feeRecipient,
        bondingCurve,
        tokenMint: mint,
        curveTokenAccount,
        userTokenAccount,
        tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: web3_js_1.SystemProgram.programId,
    };
    const amount = new anchor.BN(LAMPORTS);
    const direction = 0; // 0 = buy, 1 = sell
    const minOut = new anchor.BN(0); // no slippage protection for smoke test
    const tx = await program.methods
        .swap(amount, direction, minOut)
        .accounts(accounts)
        .rpc();
    console.log('BUY tx:', tx);
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
