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
const METADATA_PROGRAM_ID = new web3_js_1.PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
async function main() {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const idl = JSON.parse((0, fs_1.readFileSync)('target/idl/pump.json', 'utf8'));
    // In Anchor >=0.30, Program constructor takes (idl, provider) and reads programId from idl.address
    const program = new anchor.Program(idl, provider);
    const PROGRAM_ID = program.programId;
    // Change these:
    const name = 'TestToken';
    const symbol = 'TST';
    const uri = 'https://example.com/metadata.json';
    const [globalConfig] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('global-config')], PROGRAM_ID);
    const tokenMint = web3_js_1.Keypair.generate();
    const [bondingCurve] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), tokenMint.publicKey.toBuffer()], PROGRAM_ID);
    // ATA(owner = bondingCurve PDA, mint = tokenMint), owner off-curve allowed
    const curveTokenAccount = (0, spl_token_1.getAssociatedTokenAddressSync)(tokenMint.publicKey, bondingCurve, true, // owner off-curve
    spl_token_1.TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    // Metaplex metadata PDA
    const [tokenMetadataAccount] = web3_js_1.PublicKey.findProgramAddressSync([
        Buffer.from('metadata'),
        METADATA_PROGRAM_ID.toBuffer(),
        tokenMint.publicKey.toBuffer(),
    ], METADATA_PROGRAM_ID);
    const tx = await program.methods
        .launch(name, symbol, uri)
        .accounts({
        creator: provider.wallet.publicKey,
        globalConfig,
        tokenMint: tokenMint.publicKey,
        bondingCurve,
        curveTokenAccount,
        tokenMetadataAccount,
        tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        metadataProgram: METADATA_PROGRAM_ID,
        systemProgram: web3_js_1.SystemProgram.programId,
        rent: web3_js_1.SYSVAR_RENT_PUBKEY,
    })
        .signers([tokenMint]) // IDL says token_mint is a signer
        .rpc();
    console.log('launch tx:', tx);
    console.log('mint:', tokenMint.publicKey.toBase58());
}
main().catch(e => { console.error(e); process.exit(1); });
