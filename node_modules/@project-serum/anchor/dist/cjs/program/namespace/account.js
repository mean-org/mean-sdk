"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const camelcase_1 = __importDefault(require("camelcase"));
const eventemitter3_1 = __importDefault(require("eventemitter3"));
const bs58 = __importStar(require("bs58"));
const web3_js_1 = require("@solana/web3.js");
const coder_1 = require("../../coder");
const common_1 = require("../common");
// Tracks all subscriptions.
const subscriptions = new Map();
class AccountFactory {
    // Returns the generated accounts namespace.
    static build(idl, coder, programId, provider) {
        const accountFns = {};
        idl.accounts.forEach((idlAccount) => {
            const name = camelcase_1.default(idlAccount.name);
            // Fetches the decoded account from the network.
            const accountsNamespace = async (address) => {
                const accountInfo = await provider.connection.getAccountInfo(common_1.translateAddress(address));
                if (accountInfo === null) {
                    throw new Error(`Account does not exist ${address.toString()}`);
                }
                // Assert the account discriminator is correct.
                const discriminator = await coder_1.accountDiscriminator(idlAccount.name);
                if (discriminator.compare(accountInfo.data.slice(0, 8))) {
                    throw new Error("Invalid account discriminator");
                }
                return coder.accounts.decode(idlAccount.name, accountInfo.data);
            };
            // Returns the size of the account.
            // @ts-ignore
            accountsNamespace["size"] =
                coder_1.ACCOUNT_DISCRIMINATOR_SIZE + coder_1.accountSize(idl, idlAccount);
            // Returns an instruction for creating this account.
            // @ts-ignore
            accountsNamespace["createInstruction"] = async (signer, sizeOverride) => {
                // @ts-ignore
                const size = accountsNamespace["size"];
                return web3_js_1.SystemProgram.createAccount({
                    fromPubkey: provider.wallet.publicKey,
                    newAccountPubkey: signer.publicKey,
                    space: sizeOverride !== null && sizeOverride !== void 0 ? sizeOverride : size,
                    lamports: await provider.connection.getMinimumBalanceForRentExemption(sizeOverride !== null && sizeOverride !== void 0 ? sizeOverride : size),
                    programId,
                });
            };
            // Subscribes to all changes to this account.
            // @ts-ignore
            accountsNamespace["subscribe"] = (address, commitment) => {
                if (subscriptions.get(address.toString())) {
                    return subscriptions.get(address.toString()).ee;
                }
                const ee = new eventemitter3_1.default();
                address = common_1.translateAddress(address);
                const listener = provider.connection.onAccountChange(address, (acc) => {
                    const account = coder.accounts.decode(idlAccount.name, acc.data);
                    ee.emit("change", account);
                }, commitment);
                subscriptions.set(address.toString(), {
                    ee,
                    listener,
                });
                return ee;
            };
            // Unsubscribes to account changes.
            // @ts-ignore
            accountsNamespace["unsubscribe"] = (address) => {
                let sub = subscriptions.get(address.toString());
                if (!sub) {
                    console.warn("Address is not subscribed");
                    return;
                }
                if (subscriptions) {
                    provider.connection
                        .removeAccountChangeListener(sub.listener)
                        .then(() => {
                        subscriptions.delete(address.toString());
                    })
                        .catch(console.error);
                }
            };
            // Returns all instances of this account type for the program.
            // @ts-ignore
            accountsNamespace["all"] = async (filter) => {
                let bytes = await coder_1.accountDiscriminator(idlAccount.name);
                if (filter !== undefined) {
                    bytes = Buffer.concat([bytes, filter]);
                }
                // @ts-ignore
                let resp = await provider.connection._rpcRequest("getProgramAccounts", [
                    programId.toBase58(),
                    {
                        commitment: provider.connection.commitment,
                        filters: [
                            {
                                memcmp: {
                                    offset: 0,
                                    bytes: bs58.encode(bytes),
                                },
                            },
                        ],
                    },
                ]);
                if (resp.error) {
                    console.error(resp);
                    throw new Error("Failed to get accounts");
                }
                return (resp.result
                    // @ts-ignore
                    .map(({ pubkey, account: { data } }) => {
                    data = bs58.decode(data);
                    return {
                        publicKey: new web3_js_1.PublicKey(pubkey),
                        account: coder.accounts.decode(idlAccount.name, data),
                    };
                }));
            };
            // Function returning the associated address. Args are keys to associate.
            // Order matters.
            accountsNamespace["associatedAddress"] = async (...args) => {
                let seeds = [Buffer.from([97, 110, 99, 104, 111, 114])]; // b"anchor".
                args.forEach((arg) => {
                    seeds.push(common_1.translateAddress(arg).toBuffer());
                });
                const [assoc] = await web3_js_1.PublicKey.findProgramAddress(seeds, programId);
                return assoc;
            };
            // Function returning the associated account. Args are keys to associate.
            // Order matters.
            accountsNamespace["associated"] = async (...args) => {
                const addr = await accountsNamespace["associatedAddress"](...args);
                return await accountsNamespace(addr);
            };
            accountFns[name] = accountsNamespace;
        });
        return accountFns;
    }
}
exports.default = AccountFactory;
//# sourceMappingURL=account.js.map