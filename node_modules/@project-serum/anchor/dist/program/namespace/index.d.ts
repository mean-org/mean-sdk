import { PublicKey } from "@solana/web3.js";
import Coder from "../../coder";
import Provider from "../../provider";
import { Idl } from "../../idl";
import { StateNamespace } from "./state";
import { InstructionNamespace } from "./instruction";
import { TransactionNamespace } from "./transaction";
import { RpcNamespace } from "./rpc";
import { AccountNamespace } from "./account";
import { SimulateNamespace } from "./simulate";
export { StateNamespace } from "./state";
export { InstructionNamespace } from "./instruction";
export { TransactionNamespace, TxFn } from "./transaction";
export { RpcNamespace, RpcFn } from "./rpc";
export { AccountNamespace, AccountFn, ProgramAccount } from "./account";
export { SimulateNamespace } from "./simulate";
export default class NamespaceFactory {
    /**
     * Generates all namespaces for a given program.
     */
    static build(idl: Idl, coder: Coder, programId: PublicKey, provider: Provider): [
        RpcNamespace,
        InstructionNamespace,
        TransactionNamespace,
        AccountNamespace,
        StateNamespace,
        SimulateNamespace
    ];
}
//# sourceMappingURL=index.d.ts.map