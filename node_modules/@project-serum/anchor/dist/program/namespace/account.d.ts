/// <reference types="node" />
import EventEmitter from "eventemitter3";
import { Signer, PublicKey, TransactionInstruction, Commitment } from "@solana/web3.js";
import Provider from "../../provider";
import { Idl } from "../../idl";
import Coder from "../../coder";
import { Address } from "../common";
/**
 * Accounts is a dynamically generated object to fetch any given account
 * of a program.
 */
export interface AccountNamespace {
    [key: string]: AccountFn;
}
/**
 * Account is a function returning a deserialized account, given an address.
 */
export declare type AccountFn<T = any> = AccountProps & ((address: PublicKey) => T);
/**
 * Non function properties on the acccount namespace.
 */
declare type AccountProps = {
    size: number;
    all: (filter?: Buffer) => Promise<ProgramAccount<any>[]>;
    subscribe: (address: Address, commitment?: Commitment) => EventEmitter;
    unsubscribe: (address: Address) => void;
    createInstruction: (signer: Signer) => Promise<TransactionInstruction>;
    associated: (...args: PublicKey[]) => Promise<any>;
    associatedAddress: (...args: PublicKey[]) => Promise<PublicKey>;
};
/**
 * @hidden
 *
 * Deserialized account owned by a program.
 */
export declare type ProgramAccount<T = any> = {
    publicKey: PublicKey;
    account: T;
};
export default class AccountFactory {
    static build(idl: Idl, coder: Coder, programId: PublicKey, provider: Provider): AccountNamespace;
}
export {};
//# sourceMappingURL=account.d.ts.map