"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateAddress = exports.translateError = exports.validateAccounts = exports.toInstruction = exports.parseIdlErrors = void 0;
const web3_js_1 = require("@solana/web3.js");
const error_1 = require("../error");
function parseIdlErrors(idl) {
    const errors = new Map();
    if (idl.errors) {
        idl.errors.forEach((e) => {
            var _a;
            let msg = (_a = e.msg) !== null && _a !== void 0 ? _a : e.name;
            errors.set(e.code, msg);
        });
    }
    return errors;
}
exports.parseIdlErrors = parseIdlErrors;
// Allow either IdLInstruction or IdlStateMethod since the types share fields.
function toInstruction(idlIx, ...args) {
    if (idlIx.args.length != args.length) {
        throw new Error("Invalid argument length");
    }
    const ix = {};
    let idx = 0;
    idlIx.args.forEach((ixArg) => {
        ix[ixArg.name] = args[idx];
        idx += 1;
    });
    return ix;
}
exports.toInstruction = toInstruction;
// Throws error if any account required for the `ix` is not given.
function validateAccounts(ixAccounts, accounts) {
    ixAccounts.forEach((acc) => {
        // @ts-ignore
        if (acc.accounts !== undefined) {
            // @ts-ignore
            validateAccounts(acc.accounts, accounts[acc.name]);
        }
        else {
            if (accounts[acc.name] === undefined) {
                throw new Error(`Invalid arguments: ${acc.name} not provided.`);
            }
        }
    });
}
exports.validateAccounts = validateAccounts;
function translateError(idlErrors, err) {
    // TODO: don't rely on the error string. web3.js should preserve the error
    //       code information instead of giving us an untyped string.
    let components = err.toString().split("custom program error: ");
    if (components.length === 2) {
        try {
            const errorCode = parseInt(components[1]);
            let errorMsg = idlErrors.get(errorCode);
            if (errorMsg === undefined) {
                // Unexpected error code so just throw the untranslated error.
                return null;
            }
            return new error_1.ProgramError(errorCode, errorMsg);
        }
        catch (parseErr) {
            // Unable to parse the error. Just return the untranslated error.
            return null;
        }
    }
}
exports.translateError = translateError;
// Translates an address to a Pubkey.
function translateAddress(address) {
    if (typeof address === "string") {
        const pk = new web3_js_1.PublicKey(address);
        return pk;
    }
    else {
        return address;
    }
}
exports.translateAddress = translateAddress;
//# sourceMappingURL=common.js.map