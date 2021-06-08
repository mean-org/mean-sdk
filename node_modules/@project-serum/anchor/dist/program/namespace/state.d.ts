import EventEmitter from "eventemitter3";
import { PublicKey, Commitment } from "@solana/web3.js";
import Provider from "../../provider";
import { Idl } from "../../idl";
import Coder from "../../coder";
import { RpcNamespace, InstructionNamespace } from "./";
export declare type StateNamespace = () => Promise<any> | {
    address: () => Promise<PublicKey>;
    rpc: RpcNamespace;
    instruction: InstructionNamespace;
    subscribe: (commitment?: Commitment) => EventEmitter;
    unsubscribe: () => void;
};
export default class StateFactory {
    static build(idl: Idl, coder: Coder, programId: PublicKey, idlErrors: Map<number, string>, provider: Provider): StateNamespace | undefined;
}
//# sourceMappingURL=state.d.ts.map