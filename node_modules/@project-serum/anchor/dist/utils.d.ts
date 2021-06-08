/// <reference types="node" />
import { sha256 } from "crypto-hash";
import { PublicKey, AccountInfo, Connection } from "@solana/web3.js";
import { idlAddress } from "./idl";
export declare const TOKEN_PROGRAM_ID: PublicKey;
declare function getMultipleAccounts(connection: Connection, publicKeys: PublicKey[]): Promise<Array<null | {
    publicKey: PublicKey;
    account: AccountInfo<Buffer>;
}>>;
export declare function decodeUtf8(array: Uint8Array): string;
declare const utils: {
    bs58: import("base-x").BaseConverter;
    sha256: typeof sha256;
    getMultipleAccounts: typeof getMultipleAccounts;
    idlAddress: typeof idlAddress;
};
export default utils;
//# sourceMappingURL=utils.d.ts.map