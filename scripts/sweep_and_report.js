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
const utils_1 = require("./utils");
async function main() {
    const MINT = process.env.MINT;
    const RECIPIENT = process.env.RECIPIENT;
    if (!MINT || !RECIPIENT)
        throw new Error('Set MINT and RECIPIENT');
    const prog = (0, utils_1.program)();
    const pid = prog.programId;
    const provider = anchor.getProvider();
    const conn = provider.connection;
    const mint = new web3_js_1.PublicKey(MINT);
    const recipient = new web3_js_1.PublicKey(RECIPIENT);
    const globalConfig = (0, utils_1.globalConfigPda)(pid);
    const bondingCurve = (0, utils_1.bondingCurvePda)(pid, mint);
    const curveTokenAccount = (0, utils_1.curveAta)(mint, bondingCurve);
    const recipientTokenAccount = (0, utils_1.recipientAta)(mint, recipient);
    const [curveSolBefore, recSolBefore] = await Promise.all([
        conn.getBalance(bondingCurve),
        conn.getBalance(recipient),
    ]);
    let curveTokenBefore = '0';
    try {
        curveTokenBefore = (await (0, spl_token_1.getAccount)(conn, curveTokenAccount)).amount.toString();
    }
    catch { }
    const tx = await prog.methods
        .releaseReserves()
        .accounts({
        admin: provider.wallet.publicKey,
        globalConfig,
        tokenMint: mint,
        bondingCurve,
        recipient,
        curveTokenAccount,
        recipientTokenAccount,
        tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils_1.ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: web3_js_1.SystemProgram.programId,
    })
        .rpc();
    const [curveSolAfter, recSolAfter] = await Promise.all([
        conn.getBalance(bondingCurve),
        conn.getBalance(recipient),
    ]);
    let curveTokenAfter = '0';
    try {
        curveTokenAfter = (await (0, spl_token_1.getAccount)(conn, curveTokenAccount)).amount.toString();
    }
    catch { }
    const report = {
        programId: pid.toBase58(),
        mint: mint.toBase58(),
        bondingCurve: bondingCurve.toBase58(),
        curveTokenAccount: curveTokenAccount.toBase58(),
        recipient: recipient.toBase58(),
        recipientTokenAccount: recipientTokenAccount.toBase58(),
        tx,
        before: { curveLamports: curveSolBefore, recipientLamports: recSolBefore, curveTokenRaw: curveTokenBefore },
        after: { curveLamports: curveSolAfter, recipientLamports: recSolAfter, curveTokenRaw: curveTokenAfter },
    };
    (0, fs_1.writeFileSync)('release_report.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
