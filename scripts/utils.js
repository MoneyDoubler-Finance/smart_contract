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
exports.ASSOCIATED_TOKEN_PROGRAM_ID = void 0;
exports.provider = provider;
exports.program = program;
exports.globalConfigPda = globalConfigPda;
exports.bondingCurvePda = bondingCurvePda;
exports.curveAta = curveAta;
exports.recipientAta = recipientAta;
const anchor = __importStar(require("@coral-xyz/anchor"));
const web3_js_1 = require("@solana/web3.js");
const fs_1 = require("fs");
const spl_token_1 = require("@solana/spl-token");
exports.ASSOCIATED_TOKEN_PROGRAM_ID = new web3_js_1.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
function provider() {
    const p = anchor.AnchorProvider.env();
    anchor.setProvider(p);
    return p;
}
function program() {
    const raw = (0, fs_1.readFileSync)('target/idl/pump.json', 'utf8');
    const idl = JSON.parse(raw);
    const pid = new web3_js_1.PublicKey(idl.address);
    delete idl.accounts;
    return new anchor.Program(idl, pid, provider());
}
function globalConfigPda(programId) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('global-config')], programId)[0];
}
function bondingCurvePda(programId, mint) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), mint.toBuffer()], programId)[0];
}
function curveAta(mint, curve) {
    return (0, spl_token_1.getAssociatedTokenAddressSync)(mint, curve, true, spl_token_1.TOKEN_PROGRAM_ID, exports.ASSOCIATED_TOKEN_PROGRAM_ID);
}
function recipientAta(mint, recipient) {
    return (0, spl_token_1.getAssociatedTokenAddressSync)(mint, recipient, false, spl_token_1.TOKEN_PROGRAM_ID, exports.ASSOCIATED_TOKEN_PROGRAM_ID);
}
