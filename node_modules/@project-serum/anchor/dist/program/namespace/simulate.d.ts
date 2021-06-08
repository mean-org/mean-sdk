import { PublicKey } from "@solana/web3.js";
import Provider from "../../provider";
import { IdlInstruction } from "../../idl";
import { TxFn } from "./transaction";
import Coder from "../../coder";
import { Idl } from "../../idl";
/**
 * Dynamically generated simualte namespace.
 */
export interface SimulateNamespace {
    [key: string]: SimulateFn;
}
/**
 * RpcFn is a single rpc method generated from an IDL.
 */
export declare type SimulateFn = (...args: any[]) => Promise<SimulateResponse>;
declare type SimulateResponse = {
    events: Event[];
    raw: string[];
};
export default class SimulateFactory {
    static build(idlIx: IdlInstruction, txFn: TxFn, idlErrors: Map<number, string>, provider: Provider, coder: Coder, programId: PublicKey, idl: Idl): SimulateFn;
}
export {};
//# sourceMappingURL=simulate.d.ts.map