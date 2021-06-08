import BN from "bn.js";
import * as web3 from "@solana/web3.js";
import Provider, { NodeWallet as Wallet } from "./provider";
import Coder from "./coder";
import { Idl } from "./idl";
import workspace from "./workspace";
import utils from "./utils";
import { Program } from "./program";
import { Address } from "./program/common";
import { ProgramAccount } from "./program/namespace";
import { Context, Accounts } from "./program/context";
declare function setProvider(provider: Provider): void;
declare function getProvider(): Provider;
export { workspace, Program, ProgramAccount, Context, Accounts, Coder, setProvider, getProvider, Provider, BN, web3, Idl, utils, Wallet, Address, };
//# sourceMappingURL=index.d.ts.map