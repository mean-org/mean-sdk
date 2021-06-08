"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Program = void 0;
const pako_1 = require("pako");
const idl_1 = require("../idl");
const coder_1 = __importDefault(require("../coder"));
const namespace_1 = __importDefault(require("./namespace"));
const __1 = require("../");
const utils_1 = require("../utils");
const event_1 = require("./event");
const common_1 = require("./common");
/**
 * ## Program
 *
 * Program provides the IDL deserialized client representation of an Anchor
 * program.
 *
 * This API is the one stop shop for all things related to communicating with
 * on-chain programs. Among other things, one can send transactions, fetch
 * deserialized accounts, decode instruction data, subscribe to account
 * changes, and listen to events.
 *
 * In addition to field accessors and methods, the object provides a set of
 * dynamically generated properties (internally referred to as namespaces) that
 * map one-to-one to program instructions and accounts. These namespaces
 * generally can be used as follows:
 *
 * ```javascript
 * program.<namespace>.<program-specific-field>
 * ```
 *
 * API specifics are namespace dependent. The examples used in the documentation
 * below will refer to the two counter examples found
 * [here](https://project-serum.github.io/anchor/ts/#examples).
 */
class Program {
    /**
     * @param idl       The interface definition.
     * @param programId The on-chain address of the program.
     * @param provider  The network and wallet context to use. If not provided
     *                  then uses [[getProvider]].
     */
    constructor(idl, programId, provider) {
        programId = common_1.translateAddress(programId);
        // Fields.
        this._idl = idl;
        this._programId = programId;
        this._provider = provider !== null && provider !== void 0 ? provider : __1.getProvider();
        this._coder = new coder_1.default(idl);
        // Dynamic namespaces.
        const [rpc, instruction, transaction, account, state, simulate,] = namespace_1.default.build(idl, this._coder, programId, this._provider);
        this.rpc = rpc;
        this.instruction = instruction;
        this.transaction = transaction;
        this.account = account;
        this.state = state;
        this.simulate = simulate;
    }
    /**
     * Address of the program.
     */
    get programId() {
        return this._programId;
    }
    /**
     * IDL defining the program's interface.
     */
    get idl() {
        return this._idl;
    }
    /**
     * Coder for serializing requests.
     */
    get coder() {
        return this._coder;
    }
    /**
     * Wallet and network provider.
     */
    get provider() {
        return this._provider;
    }
    /**
     * Generates a Program client by fetching the IDL from the network.
     *
     * In order to use this method, an IDL must have been previously initialized
     * via the anchor CLI's `anchor idl init` command.
     *
     * @param programId The on-chain address of the program.
     * @param provider  The network and wallet context.
     */
    static async at(address, provider) {
        const programId = common_1.translateAddress(address);
        const idl = await Program.fetchIdl(programId, provider);
        return new Program(idl, programId, provider);
    }
    /**
     * Fetches an idl from the blockchain.
     *
     * In order to use this method, an IDL must have been previously initialized
     * via the anchor CLI's `anchor idl init` command.
     *
     * @param programId The on-chain address of the program.
     * @param provider  The network and wallet context.
     */
    static async fetchIdl(address, provider) {
        provider = provider !== null && provider !== void 0 ? provider : __1.getProvider();
        const programId = common_1.translateAddress(address);
        const idlAddr = await idl_1.idlAddress(programId);
        const accountInfo = await provider.connection.getAccountInfo(idlAddr);
        // Chop off account discriminator.
        let idlAccount = idl_1.decodeIdlAccount(accountInfo.data.slice(8));
        const inflatedIdl = pako_1.inflate(idlAccount.data);
        return JSON.parse(utils_1.decodeUtf8(inflatedIdl));
    }
    /**
     * Invokes the given callback everytime the given event is emitted.
     *
     * @param eventName The PascalCase name of the event, provided by the IDL.
     * @param callback  The function to invoke whenever the event is emitted from
     *                  program logs.
     */
    addEventListener(eventName, callback) {
        const eventParser = new event_1.EventParser(this._coder, this._programId);
        return this._provider.connection.onLogs(this._programId, (logs, ctx) => {
            if (logs.err) {
                console.error(logs);
                return;
            }
            eventParser.parseLogs(logs.logs, (event) => {
                if (event.name === eventName) {
                    callback(event.data, ctx.slot);
                }
            });
        });
    }
    /**
     * Unsubscribes from the given event listener.
     */
    async removeEventListener(listener) {
        return this._provider.connection.removeOnLogsListener(listener);
    }
}
exports.Program = Program;
//# sourceMappingURL=index.js.map