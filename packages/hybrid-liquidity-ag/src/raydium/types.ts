import { TokenAmount } from "./safe-math";

export interface Tokens {
  [key: string]: any
  [index: number]: any
}

export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  totalSupply?: TokenAmount;
  referrer?: string;
  details?: string;
  docs?: object;
  socials?: object;
  tokenAccountAddress?: string;
  balance?: TokenAmount;
  readonly logoURI?: string;
  tags: string[];
}

export interface LiquidityPoolInfo {
  name: string;
  coin: TokenInfo;
  pc: TokenInfo;
  lp: TokenInfo;
  version: number;
  programId: string;
  ammId: string;
  ammAuthority: string;
  ammOpenOrders: string;
  ammTargetOrders: string;
  ammQuantities: string;
  poolCoinTokenAccount: string;
  poolPcTokenAccount: string;
  poolWithdrawQueue: string;
  poolTempLpTokenAccount: string;
  serumProgramId: string;
  serumMarket: string;
  serumBids?: string;
  serumAsks?: string;
  serumEventQueue?: string;
  serumCoinVaultAccount: string;
  serumPcVaultAccount: string;
  serumVaultSigner: string;
  official: boolean;
}
