import { AccountMeta, PublicKey, Transaction } from "@solana/web3.js"

export const HLA_PROGRAM = new PublicKey(
  'B6gLd2uyVQLZMdC1s9C4WR7ZP9fMhJNh7WZYcsibuzN3'
);

export const HLA_OPS = new PublicKey(
  'FZMd4pn9FsvMC55D4XQfaexJvKBtQpVuqMk5zuonLRDX'
);

export const MSP_OPS = new PublicKey(
  'CLazQV1BhSrxfgRHko4sC8GYBU3DoHcX4xxRZd12Kohr'
);

export const SERUM_PROGRAM_ID_V2 = new PublicKey(
  'EUqojwWA2rd19FZrzeBncJsm38Jm1hEhE3zsmX3bRc2o'
);

export const SERUM_PROGRAM_ID_V3 = new PublicKey(
  '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'
);

export const LIQUIDITY_POOL_PROGRAM_ID_V2 = new PublicKey(
  'RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr'
);

export const LIQUIDITY_POOL_PROGRAM_ID_V3 = new PublicKey(
  '27haf8L6oxUeXrHrgEgsexjSY5hbVUWEmvv9Nyxg8vQv'
);

export const LIQUIDITY_POOL_PROGRAM_ID_V4 = new PublicKey(
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'
);

export const RAYDIUM = new PublicKey(
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'
);

export const ORCA = new PublicKey(
  '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP'
);

export const SABER = new PublicKey(
  'SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ'
);

export const MERCURIAL = new PublicKey(
  "MERLuDFBMmsHnsBPZw2sDQZHvXFMwp8EdjudcU2HKky"
);

export const SERUM = new PublicKey(
  "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"
);

export const SWAP_PROGRAM_ID = new PublicKey(
  "SwaPpA9LAaLfeLi3a68M4DjnLqgtticKg6CnyNwgAC8"
);

export const NATIVE_SOL_MINT = new PublicKey(
  "11111111111111111111111111111111"
);

export const WRAPPED_SOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);

export const SRM_MINT = new PublicKey(
  "SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt"
);

export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

export const USDT_MINT = new PublicKey(
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
);

export const NATIVE_SOL: TokenInfo = {
  symbol: 'SOL',
  name: 'Native SOL',
  address: NATIVE_SOL_MINT.toString(),
  decimals: 9,
  logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  chainId: 0
}

export type ChainInfo = {
  id: number;
  name: string;
}

export type TokenInfo = {
  chainId: number,
  address: string,
  name: string,
  symbol: string,
  decimals: number,
  logoURI: string
}

export type ProtocolInfo = {
  address: string,
  name: string
}

export type AmmPoolInfo = {
  chainId: number,
  name: string,
  address: string,
  protocolAddress: string,
  ammAddress: string,
  tokenAddresses: string[]
}

export type ExchangeInfo = {
  fromAmm: string | undefined,
  amountIn: number | undefined,
  amountOut: number | undefined,
  minAmountOut: number | undefined,
  outPrice: number | undefined,
  priceImpact: number | undefined
  protocolFees: number,
  networkFees: number
}

export type FeesInfo = {
  protocol: number,
  network: number,
  aggregator: number,
  total: number
}

export type HlaInfo = {
  exchangeRate: number,
  protocolFees: number,
  aggregatorPercentFees: number,
  remainingAccounts: AccountMeta[]
}

export interface Client {

  protocol: PublicKey;
  exchange: ExchangeInfo | undefined;

  updateExchange: (
    from: string,
    to: string,
    amount: number,
    slippage: number

  ) => Promise<void>

  swapTx(
    owner: PublicKey,
    from: string, 
    to: string, 
    amountIn: number,
    amountOut: number,
    slippage: number,
    feeAddress: string,
    feeAmount: number

  ): Promise<Transaction>
}

export interface LPClient extends Client {
  pool: any;
  accounts: AccountMeta[];
}
