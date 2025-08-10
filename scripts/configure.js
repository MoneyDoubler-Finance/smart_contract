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
const fs_1 = require("fs");
async function main() {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const idl = JSON.parse((0, fs_1.readFileSync)('target/idl/pump.json', 'utf8'));
    // In Anchor >=0.30, Program constructor takes (idl, provider) and reads programId from idl.address
    const program = new anchor.Program(idl, provider);
    const PROGRAM_ID = program.programId;
    const [globalConfig] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('global-config')], PROGRAM_ID);
    // Fill with sensible defaults; adjust as needed
    const new_config = {
        authority: provider.wallet.publicKey,
        feeRecipient: provider.wallet.publicKey,
        curveLimit: new anchor.BN(5000000000), // 5 SOL in lamports
        initialVirtualTokenReserves: new anchor.BN(2000000000),
        initialVirtualSolReserves: new anchor.BN(1000000000), // 1 SOL in lamports
        initialRealTokenReserves: new anchor.BN(0),
        totalTokenSupply: new anchor.BN(1000000000000),
        buyFeePercent: 0.02,
        sellFeePercent: 0.02,
        migrationFeePercent: 0.05,
    };
    const tx = await program.methods
        .configure(new_config)
        .accounts({
        admin: provider.wallet.publicKey,
        globalConfig,
        systemProgram: web3_js_1.SystemProgram.programId,
    })
        .rpc();
    console.log('configure tx:', tx);
}
main().catch(e => { console.error(e); process.exit(1); });
