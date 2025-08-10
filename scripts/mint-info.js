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
const RPC = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';
const MINT_STR = process.env.MINT;
async function main() {
    if (!MINT_STR)
        throw new Error('Set MINT env var');
    const mintPk = new web3_js_1.PublicKey(MINT_STR);
    const conn = new web3_js_1.Connection(RPC, 'confirmed');
    const wallet = anchor.AnchorProvider.env().wallet.payer?.publicKey
        || anchor.AnchorProvider.env().wallet.publicKey;
    const mint = await (0, spl_token_1.getMint)(conn, mintPk);
    const decimals = mint.decimals;
    const ata = (0, spl_token_1.getAssociatedTokenAddressSync)(mintPk, wallet, false, spl_token_1.TOKEN_PROGRAM_ID);
    let ataBal = 'N/A';
    try {
        const acct = await (0, spl_token_1.getAccount)(conn, ata);
        ataBal = acct.amount.toString();
    }
    catch (_) { }
    console.log(JSON.stringify({
        wallet: wallet.toBase58(),
        mint: mintPk.toBase58(),
        decimals,
        ata: ata.toBase58(),
        ataBalanceRaw: ataBal
    }, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
