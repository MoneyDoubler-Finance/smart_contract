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
const ASSOCIATED_TOKEN_PROGRAM_ID = new web3_js_1.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
async function main() {
    const MINT = process.env.MINT;
    const RECIPIENT = process.env.RECIPIENT;
    if (!MINT || !RECIPIENT)
        throw new Error('Set MINT and RECIPIENT env vars');
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const idl = JSON.parse((0, fs_1.readFileSync)('target/idl/pump.json', 'utf8'));
    const program = new anchor.Program(idl, provider);
    console.log('Program ID used:', program.programId.toBase58?.() ?? program.programId);
    const mint = new web3_js_1.PublicKey(MINT);
    const recipient = new web3_js_1.PublicKey(RECIPIENT);
    const [globalConfig] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('global-config')], program.programId);
    const [bondingCurve] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), mint.toBuffer()], program.programId);
    const curveTokenAccount = (0, spl_token_1.getAssociatedTokenAddressSync)(mint, bondingCurve, true, spl_token_1.TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const recipientTokenAccount = (0, spl_token_1.getAssociatedTokenAddressSync)(mint, recipient, false, spl_token_1.TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const tx = await program.methods
        .releaseReserves()
        .accounts({
        admin: provider.wallet.publicKey,
        globalConfig,
        tokenMint: mint,
        bondingCurve,
        curveTokenAccount,
        recipient,
        recipientTokenAccount,
        tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: web3_js_1.SystemProgram.programId,
    })
        .rpc();
    console.log('RELEASE_RESERVES tx:', tx);
}
main().catch(e => { console.error(e); process.exit(1); });
