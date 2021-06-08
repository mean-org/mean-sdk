import EventEmitter from "eventemitter3";
import { PublicKey, SystemProgram, Transaction, TransactionInstruction, SYSVAR_RENT_PUBKEY, } from "@solana/web3.js";
import { stateDiscriminator } from "../../coder";
import { translateError, toInstruction, validateAccounts, } from "../common";
import { splitArgsAndCtx } from "../context";
import InstructionNamespaceFactory from "./instruction";
export default class StateFactory {
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
            const expectedDiscriminator = await stateDiscriminator(idl.state.struct.name);
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
                return keys.concat(InstructionNamespaceFactory.accountsArray(accounts, m.accounts));
            };
            const ixFn = async (...args) => {
                const [ixArgs, ctx] = splitArgsAndCtx(m, [...args]);
                return new TransactionInstruction({
                    keys: await accounts(ctx.accounts),
                    programId,
                    data: coder.instruction.encodeState(m.name, toInstruction(m, ...ixArgs)),
                });
            };
            ixFn["accounts"] = accounts;
            ix[m.name] = ixFn;
            rpc[m.name] = async (...args) => {
                const [, ctx] = splitArgsAndCtx(m, [...args]);
                const tx = new Transaction();
                if (ctx.instructions !== undefined) {
                    tx.add(...ctx.instructions);
                }
                tx.add(await ix[m.name](...args));
                try {
                    const txSig = await provider.send(tx, ctx.signers, ctx.options);
                    return txSig;
                }
                catch (err) {
                    let translatedErr = translateError(idlErrors, err);
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
            const ee = new EventEmitter();
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
// Calculates the deterministic address of the program's "state" account.
async function programStateAddress(programId) {
    let [registrySigner] = await PublicKey.findProgramAddress([], programId);
    return PublicKey.createWithSeed(registrySigner, "unversioned", programId);
}
// Returns the common keys that are prepended to all instructions targeting
// the "state" of a program.
async function stateInstructionKeys(programId, provider, m, accounts) {
    if (m.name === "new") {
        // Ctor `new` method.
        const [programSigner] = await PublicKey.findProgramAddress([], programId);
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
                pubkey: SystemProgram.programId,
                isWritable: false,
                isSigner: false,
            },
            { pubkey: programId, isWritable: false, isSigner: false },
            {
                pubkey: SYSVAR_RENT_PUBKEY,
                isWritable: false,
                isSigner: false,
            },
        ];
    }
    else {
        validateAccounts(m.accounts, accounts);
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