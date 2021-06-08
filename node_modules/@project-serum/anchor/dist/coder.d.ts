/// <reference types="node" />
import { Idl, IdlTypeDef } from "./idl";
import { Event } from "./program/event";
/**
 * Number of bytes of the account discriminator.
 */
export declare const ACCOUNT_DISCRIMINATOR_SIZE = 8;
/**
 * Namespace for state method function signatures.
 */
export declare const SIGHASH_STATE_NAMESPACE = "state";
/**
 * Namespace for global instruction function signatures (i.e. functions
 * that aren't namespaced by the state or any of its trait implementations).
 */
export declare const SIGHASH_GLOBAL_NAMESPACE = "global";
/**
 * Coder provides a facade for encoding and decoding all IDL related objects.
 */
export default class Coder {
    /**
     * Instruction coder.
     */
    readonly instruction: InstructionCoder;
    /**
     * Account coder.
     */
    readonly accounts: AccountsCoder;
    /**
     * Types coder.
     */
    readonly types: TypesCoder;
    /**
     * Coder for state structs.
     */
    readonly state: StateCoder;
    /**
     * Coder for events.
     */
    readonly events: EventCoder;
    constructor(idl: Idl);
    sighash(nameSpace: string, ixName: string): Buffer;
}
/**
 * Encodes and decodes program instructions.
 */
declare class InstructionCoder {
    /**
     * Instruction args layout. Maps namespaced method
     */
    private ixLayout;
    constructor(idl: Idl);
    /**
     * Encodes a program instruction.
     */
    encode(ixName: string, ix: any): Buffer;
    /**
     * Encodes a program state instruction.
     */
    encodeState(ixName: string, ix: any): Buffer;
    private _encode;
    private static parseIxLayout;
}
/**
 * Encodes and decodes account objects.
 */
declare class AccountsCoder {
    /**
     * Maps account type identifier to a layout.
     */
    private accountLayouts;
    constructor(idl: Idl);
    encode<T = any>(accountName: string, account: T): Promise<Buffer>;
    decode<T = any>(accountName: string, ix: Buffer): T;
}
/**
 * Encodes and decodes user defined types.
 */
declare class TypesCoder {
    /**
     * Maps account type identifier to a layout.
     */
    private layouts;
    constructor(idl: Idl);
    encode<T = any>(accountName: string, account: T): Buffer;
    decode<T = any>(accountName: string, ix: Buffer): T;
}
declare class EventCoder {
    /**
     * Maps account type identifier to a layout.
     */
    private layouts;
    /**
     * Maps base64 encoded event discriminator to event name.
     */
    private discriminators;
    constructor(idl: Idl);
    decode(log: string): Event | null;
}
declare class StateCoder {
    private layout;
    constructor(idl: Idl);
    encode<T = any>(name: string, account: T): Promise<Buffer>;
    decode<T = any>(ix: Buffer): T;
}
export declare function accountDiscriminator(name: string): Promise<Buffer>;
export declare function stateDiscriminator(name: string): Promise<Buffer>;
export declare function eventDiscriminator(name: string): Buffer;
export declare function accountSize(idl: Idl, idlAccount: IdlTypeDef): number | undefined;
export {};
//# sourceMappingURL=coder.d.ts.map