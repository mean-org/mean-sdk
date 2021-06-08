"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const camelcase_1 = __importDefault(require("camelcase"));
const common_1 = require("../common");
const state_1 = __importDefault(require("./state"));
const instruction_1 = __importDefault(require("./instruction"));
const transaction_1 = __importDefault(require("./transaction"));
const rpc_1 = __importDefault(require("./rpc"));
const account_1 = __importDefault(require("./account"));
const simulate_1 = __importDefault(require("./simulate"));
class NamespaceFactory {
    /**
     * Generates all namespaces for a given program.
     */
    static build(idl, coder, programId, provider) {
        const idlErrors = common_1.parseIdlErrors(idl);
        const rpc = {};
        const instruction = {};
        const transaction = {};
        const simulate = {};
        const state = state_1.default.build(idl, coder, programId, idlErrors, provider);
        idl.instructions.forEach((idlIx) => {
            const ixItem = instruction_1.default.build(idlIx, coder, programId);
            const txItem = transaction_1.default.build(idlIx, ixItem);
            const rpcItem = rpc_1.default.build(idlIx, txItem, idlErrors, provider);
            const simulateItem = simulate_1.default.build(idlIx, txItem, idlErrors, provider, coder, programId, idl);
            const name = camelcase_1.default(idlIx.name);
            instruction[name] = ixItem;
            transaction[name] = txItem;
            rpc[name] = rpcItem;
            simulate[name] = simulateItem;
        });
        const account = idl.accounts
            ? account_1.default.build(idl, coder, programId, provider)
            : {};
        return [rpc, instruction, transaction, account, state, simulate];
    }
}
exports.default = NamespaceFactory;
//# sourceMappingURL=index.js.map