import { PublicKey } from "@solana/web3.js";
import { IdlInstruction, IdlAccountItem } from "../../idl";
import Coder from "../../coder";
import { Accounts } from "../context";
/**
 * Dynamically generated instruction namespace.
 */
export interface InstructionNamespace {
    [key: string]: IxFn;
}
/**
 * Ix is a function to create a `TransactionInstruction` generated from an IDL.
 */
export declare type IxFn = IxProps & ((...args: any[]) => any);
declare type IxProps = {
    accounts: (ctx: Accounts) => any;
};
export default class InstructionNamespaceFactory {
    static build(idlIx: IdlInstruction, coder: Coder, programId: PublicKey): IxFn;
    static accountsArray(ctx: Accounts, accounts: IdlAccountItem[]): any;
}
export {};
//# sourceMappingURL=instruction.d.ts.map