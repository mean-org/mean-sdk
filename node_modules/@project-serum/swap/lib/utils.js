"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAssociatedTokenAddress = exports.getVaultOwnerAndNonce = exports.USDT_PUBKEY = exports.USDC_PUBKEY = exports.SWAP_PID = exports.DEX_PID = void 0;
const bn_js_1 = __importDefault(require("bn.js"));
const web3_js_1 = require("@solana/web3.js");
// Serum DEX program id on mainnet-beta.
exports.DEX_PID = new web3_js_1.PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');
// Swap program id on mainnet-beta.
exports.SWAP_PID = new web3_js_1.PublicKey('22Y43yTVxuUkoRKdm9thyRhQ3SdgQS7c7kB6UNCiaczD');
// USDC mint on mainnet-beta.
exports.USDC_PUBKEY = new web3_js_1.PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
// USDT mint on mainnet-beta.
exports.USDT_PUBKEY = new web3_js_1.PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
// Return the program derived address used by the serum DEX to control token
// vaults.
async function getVaultOwnerAndNonce(marketPublicKey, dexProgramId = exports.DEX_PID) {
    const nonce = new bn_js_1.default(0);
    while (nonce.toNumber() < 255) {
        try {
            const vaultOwner = await web3_js_1.PublicKey.createProgramAddress([marketPublicKey.toBuffer(), nonce.toArrayLike(Buffer, 'le', 8)], dexProgramId);
            return [vaultOwner, nonce];
        }
        catch (e) {
            nonce.iaddn(1);
        }
    }
    throw new Error('Unable to find nonce');
}
exports.getVaultOwnerAndNonce = getVaultOwnerAndNonce;
// Returns an associated token address for spl tokens.
async function getAssociatedTokenAddress(associatedProgramId, programId, mint, owner) {
    return (await web3_js_1.PublicKey.findProgramAddress([owner.toBuffer(), programId.toBuffer(), mint.toBuffer()], associatedProgramId))[0];
}
exports.getAssociatedTokenAddress = getAssociatedTokenAddress;
//# sourceMappingURL=utils.js.map