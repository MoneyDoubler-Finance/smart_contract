"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getATokenAccountsNeedCreate = exports.createAssociatedTokenAccountInstruction = exports.execTx = exports.getAssociatedTokenAccount = void 0;
const getAssociatedTokenAccount = (ownerPubkey, mintPk) => {
};
exports.getAssociatedTokenAccount = getAssociatedTokenAccount;
const execTx = async (transaction, connection, payer, commitment = 'confirmed') => {
};
exports.execTx = execTx;
const createAssociatedTokenAccountInstruction = (associatedTokenAddress, payer, walletAddress, splTokenMintAddress) => {
};
exports.createAssociatedTokenAccountInstruction = createAssociatedTokenAccountInstruction;
const getATokenAccountsNeedCreate = async (connection, walletAddress, owner, nfts) => {
};
exports.getATokenAccountsNeedCreate = getATokenAccountsNeedCreate;
