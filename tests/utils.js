"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAssociatedTokenAccount = exports.sleep = void 0;
exports.convertToFloat = convertToFloat;
exports.convertFromFloat = convertFromFloat;
exports.calculateAmountOutBuy = calculateAmountOutBuy;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const sleep = (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};
exports.sleep = sleep;
const getAssociatedTokenAccount = (ownerPubkey, mintPk) => {
    let associatedTokenAccountPubkey = (web3_js_1.PublicKey.findProgramAddressSync([
        ownerPubkey.toBytes(),
        spl_token_1.TOKEN_PROGRAM_ID.toBytes(),
        mintPk.toBytes(), // mint address
    ], spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID))[0];
    return associatedTokenAccountPubkey;
};
exports.getAssociatedTokenAccount = getAssociatedTokenAccount;
function convertToFloat(value, decimals) {
    return value / Math.pow(10, decimals);
}
function convertFromFloat(value, decimals) {
    return value * Math.pow(10, decimals);
}
function calculateAmountOutBuy(reserveLamport, adjustedAmount, tokenOneDecimals, reserveToken) {
    // Calculate the denominator sum which is (y + dy)
    const denominatorSum = reserveLamport + adjustedAmount;
    // Convert to float for division
    const denominatorSumFloat = convertToFloat(denominatorSum, tokenOneDecimals);
    const adjustedAmountFloat = convertToFloat(adjustedAmount, tokenOneDecimals);
    // (y + dy) / dy
    const divAmt = denominatorSumFloat / (adjustedAmountFloat);
    // Convert reserveToken to float with 9 decimals
    const reserveTokenFloat = convertToFloat(reserveToken, 9);
    // Calculate dx = xdy / (y + dy)
    const amountOutInFloat = reserveTokenFloat / (divAmt);
    // Convert the result back to the original decimal format
    const amountOut = convertFromFloat(amountOutInFloat, 9);
    return amountOut;
}
