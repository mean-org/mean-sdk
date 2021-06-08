import { Transaction } from "@solana/web3.js";
import { IdlInstruction } from "../../idl";
import { IxFn } from "./instruction";
/**
 * Dynamically generated transaction namespace.
 */
export interface TransactionNamespace {
    [key: string]: TxFn;
}
/**
 * Tx is a function to create a `Transaction` generate from an IDL.
 */
export declare type TxFn = (...args: any[]) => Transaction;
export default class TransactionFactory {
    static build(idlIx: IdlInstruction, ixFn: IxFn): TxFn;
}
//# sourceMappingURL=transaction.d.ts.map