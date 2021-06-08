import { TransactionSignature } from "@solana/web3.js";
import Provider from "../../provider";
import { IdlInstruction } from "../../idl";
import { TxFn } from "./transaction";
/**
 * Dynamically generated rpc namespace.
 */
export interface RpcNamespace {
    [key: string]: RpcFn;
}
/**
 * RpcFn is a single rpc method generated from an IDL.
 */
export declare type RpcFn = (...args: any[]) => Promise<TransactionSignature>;
export default class RpcFactory {
    static build(idlIx: IdlInstruction, txFn: TxFn, idlErrors: Map<number, string>, provider: Provider): RpcFn;
}
//# sourceMappingURL=rpc.d.ts.map