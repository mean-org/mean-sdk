"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const eventemitter3_1 = __importDefault(require("eventemitter3"));
const web3_js_1 = require("@solana/web3.js");
const coder_1 = require("../../coder");
const common_1 = require("../common");
const context_1 = require("../context");
const instruction_1 = __importDefault(require("./instruction"));
class StateFactory {
    // Builds the state namespace.
    static build(idl, coder, programId, idlErrors, provider) {
        if (idl.state === undefined) {
            return undefined;
        }
        // Fetches the state object from the blockchain.
        const state = async () => {
            const addr = await programStateAddress(programId);
            const accountInfo = await provider.connection.getAccountInfo(addr);
            if (accountInfo === null) {
                throw new Error(`Account does not exist ${addr.toString()}`);
            }
            // Assert the account discriminator is correct.
            const expectedDiscriminator = await coder_1.stateDiscriminator(idl.state.struct.name);
            if (expectedDiscriminator.compare(accountInfo.data.slice(0, 8))) {
                throw new Error("Invalid account discriminator");
            }
            return coder.state.decode(accountInfo.data);
        };
        // Namespace with all rpc functions.
        const rpc = {};
        const ix = {};
        idl.state.methods.forEach((m) => {
            const accounts = async (accounts) => {
                const keys = await stateInstructionKeys(programId, provider, m, accounts);
                return keys.concat(instruction_1.default.accountsArray(accounts, m.accounts));
            };
            const ixFn = async (...args) => {
                const [ixArgs, ctx] = context_1.splitArgsAndCtx(m, [...args]);
                return new web3_js_1.TransactionInstruction({
                    keys: await accounts(ctx.accounts),
                    programId,
                    data: coder.instruction.encodeState(m.name, common_1.toInstruction(m, ...ixArgs)),
                });
            };
            ixFn["accounts"] = accounts;
            ix[m.name] = ixFn;
            rpc[m.name] = async (...args) => {
                const [, ctx] = context_1.splitArgsAndCtx(m, [...args]);
                const tx = new web3_js_1.Transaction();
                if (ctx.instructions !== undefined) {
                    tx.add(...ctx.instructions);
                }
                tx.add(await ix[m.name](...args));
                try {
                    const txSig = await provider.send(tx, ctx.signers, ctx.options);
                    return txSig;
                }
                catch (err) {
                    let translatedErr = common_1.translateError(idlErrors, err);
                    if (translatedErr === null) {
                        throw err;
                    }
                    throw translatedErr;
                }
            };
        });
        state["rpc"] = rpc;
        state["instruction"] = ix;
        // Calculates the address of the program's global state object account.
        state["address"] = async () => programStateAddress(programId);
        // Subscription singleton.
        let sub = null;
        // Subscribe to account changes.
        state["subscribe"] = (commitment) => {
            if (sub !== null) {
                return sub.ee;
            }
            const ee = new eventemitter3_1.default();
            state["address"]().then((address) => {
                const listener = provider.connection.onAccountChange(address, (acc) => {
                    const account = coder.state.decode(acc.data);
                    ee.emit("change", account);
                }, commitment);
                sub = {
                    ee,
                    listener,
                };
            });
            return ee;
        };
        // Unsubscribe from account changes.
        state["unsubscribe"] = () => {
            if (sub !== null) {
                provider.connection
                    .removeAccountChangeListener(sub.listener)
                    .then(async () => {
                    sub = null;
                })
                    .catch(console.error);
            }
        };
        return state;
    }
}
exports.default = StateFactory;
// Calculates the deterministic address of the program's "state" account.
async function programStateAddress(programId) {
    let [registrySigner] = await web3_js_1.PublicKey.findProgramAddress([], programId);
    return web3_js_1.PublicKey.createWithSeed(registrySigner, "unversioned", programId);
}
// Returns the common keys that are prepended to all instructions targeting
// the "state" of a program.
async function stateInstructionKeys(programId, provider, m, accounts) {
    if (m.name === "new") {
        // Ctor `new` method.
        const [programSigner] = await web3_js_1.PublicKey.findProgramAddress([], programId);
        return [
            {
                pubkey: provider.wallet.publicKey,
                isWritable: false,
                isSigner: true,
            },
            {
                pubkey: await programStateAddress(programId),
                isWritable: true,
                isSigner: false,
            },
            { pubkey: programSigner, isWritable: false, isSigner: false },
            {
                pubkey: web3_js_1.SystemProgram.programId,
                isWritable: false,
                isSigner: false,
            },
            { pubkey: programId, isWritable: false, isSigner: false },
            {
                pubkey: web3_js_1.SYSVAR_RENT_PUBKEY,
                isWritable: false,
                isSigner: false,
            },
        ];
    }
    else {
        common_1.validateAccounts(m.accounts, accounts);
        return [
            {
                pubkey: await programStateAddress(programId),
                isWritable: true,
                isSigner: false,
            },
        ];
    }
}
//# sourceMappingURL=state.js.map