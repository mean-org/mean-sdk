// import { StableSwapNPool } from "@mercurial-finance/stable-swap-n-pool";
import { PublicKey } from "@solana/web3.js";
import { TokenInfo } from "../types";

export interface MercurialPoolInfo {
  name: string,
  stable: any, //StableSwapNPool,
  protocol: PublicKey,
  simulatioUser: PublicKey;
  tokens: TokenInfo[]
}
