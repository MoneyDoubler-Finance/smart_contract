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
exports.getProvider = getProvider;
exports.loadProgramFromIdl = loadProgramFromIdl;
exports.deriveGlobalConfigPda = deriveGlobalConfigPda;
exports.deriveBondingCurvePda = deriveBondingCurvePda;
exports.getCurveTokenAccount = getCurveTokenAccount;
exports.getOwnerTokenAccount = getOwnerTokenAccount;
const anchor = __importStar(require("@coral-xyz/anchor"));
const web3_js_1 = require("@solana/web3.js");
const fs_1 = require("fs");
const spl_token_1 = require("@solana/spl-token");
function getProvider() {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    return provider;
}
function loadProgramFromIdl(path = 'target/idl/pump.json', provider) {
    const rawIdl = JSON.parse((0, fs_1.readFileSync)(path, 'utf8'));
    const programId = new web3_js_1.PublicKey(rawIdl.address);
    const idlClean = { ...rawIdl };
    delete idlClean.accounts;
    const resolvedProvider = provider ?? getProvider();
    const program = new anchor.Program(idlClean, programId, resolvedProvider);
    return { idl: idlClean, programId, program, provider: resolvedProvider };
}
function deriveGlobalConfigPda(programId) {
    const [pda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('global-config')], programId);
    return pda;
}
function deriveBondingCurvePda(programId, mint) {
    const [pda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), mint.toBuffer()], programId);
    return pda;
}
function getCurveTokenAccount(mint, bondingCurve) {
    return (0, spl_token_1.getAssociatedTokenAddressSync)(mint, bondingCurve, true, spl_token_1.TOKEN_PROGRAM_ID, spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID);
}
function getOwnerTokenAccount(mint, owner) {
    return (0, spl_token_1.getAssociatedTokenAddressSync)(mint, owner, false, spl_token_1.TOKEN_PROGRAM_ID, spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID);
}
