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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withdraw = exports.migrate = exports.swap = exports.launchToken = exports.configProject = exports.setClusterConfig = void 0;
const anchor = __importStar(require("@coral-xyz/anchor"));
const anchor_1 = require("@coral-xyz/anchor");
const fs_1 = __importDefault(require("fs"));
const web3_js_1 = require("@solana/web3.js");
const nodewallet_1 = __importDefault(require("@coral-xyz/anchor/dist/cjs/nodewallet"));
const scripts_1 = require("../lib/scripts");
const util_1 = require("../lib/util");
const constant_1 = require("../lib/constant");
const create_market_1 = require("../lib/create-market");
let solConnection = null;
let program = null;
let payer = null;
/**
 * Set cluster, provider, program
 * If rpc != null use rpc, otherwise use cluster param
 * @param cluster - cluster ex. mainnet-beta, devnet ...
 * @param keypair - wallet keypair
 * @param rpc - rpc
 */
const setClusterConfig = async (cluster, keypair, rpc) => {
    if (!rpc) {
        solConnection = new anchor_1.web3.Connection(anchor_1.web3.clusterApiUrl(cluster));
    }
    else {
        solConnection = new anchor_1.web3.Connection(rpc);
    }
    const walletKeypair = web3_js_1.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs_1.default.readFileSync(keypair, "utf-8"))), { skipValidation: true });
    payer = new nodewallet_1.default(walletKeypair);
    console.log("Wallet Address: ", payer.publicKey.toBase58());
    anchor.setProvider(new anchor.AnchorProvider(solConnection, payer, {
        skipPreflight: true,
        commitment: "confirmed",
    }));
    // Generate the program client from IDL.
    program = anchor.workspace.Pumpfun;
    console.log("ProgramId: ", program.programId.toBase58());
};
exports.setClusterConfig = setClusterConfig;
const configProject = async () => {
    // Create a dummy config object to pass as argument.
    const newConfig = {
        authority: payer.publicKey,
        pendingAuthority: web3_js_1.PublicKey.default,
        teamWallet: payer.publicKey,
        initBondingCurve: constant_1.TEST_INIT_BONDING_CURVE,
        platformBuyFee: 0.5, // Example fee: 5%
        platformSellFee: 0.5, // Example fee: 5%
        platformMigrationFee: 0.5, //  Example fee: 5%
        curveLimit: new anchor_1.BN(6000000000), //  Example limit: 6 SOL
        lamportAmountConfig: new anchor_1.BN(constant_1.TEST_VIRTUAL_RESERVES),
        tokenSupplyConfig: new anchor_1.BN(constant_1.TEST_TOKEN_SUPPLY),
        tokenDecimalsConfig: new anchor_1.BN(constant_1.TEST_DECIMALS),
    };
    const tx = await (0, scripts_1.createConfigTx)(payer.publicKey, newConfig, solConnection, program);
    await (0, util_1.execTx)(tx, solConnection, payer);
};
exports.configProject = configProject;
const launchToken = async () => {
    const tx = await (0, scripts_1.launchTokenTx)(
    //  metadata
    constant_1.TEST_NAME, constant_1.TEST_SYMBOL, constant_1.TEST_URI, payer.publicKey, solConnection, program);
    await (0, util_1.execTx)(tx, solConnection, payer);
};
exports.launchToken = launchToken;
const swap = async (token, amount, style) => {
    const tx = await (0, scripts_1.swapTx)(payer.publicKey, token, amount, style, solConnection, program);
    await (0, util_1.execTx)(tx, solConnection, payer);
};
exports.swap = swap;
const migrate = async (token) => {
    const market = await (0, create_market_1.createMarket)(payer, token, solConnection);
    // const market = new PublicKey("8GrKmcQ6rhCNVW4FoKKVLUayduiuNsf9gJ9G1VN4UEEH");
    const tx = await (0, scripts_1.migrateTx)(payer.publicKey, token, market, solConnection, program);
    await (0, util_1.execTx)(tx, solConnection, payer);
};
exports.migrate = migrate;
const withdraw = async (token) => {
    const tx = await (0, scripts_1.withdrawTx)(payer.publicKey, token, solConnection, program);
    await (0, util_1.execTx)(tx, solConnection, payer);
};
exports.withdraw = withdraw;
