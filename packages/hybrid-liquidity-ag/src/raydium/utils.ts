import { Connection, PublicKey } from "@solana/web3.js";
import { AMM_INFO_LAYOUT_V4, MINT_LAYOUT } from "../layouts";
import { LP_TOKENS, NATIVE_SOL, TOKENS } from "./tokens";
import { TokenInfo } from "./types";
import { LIQUIDITY_POOLS } from "./pools";
import { MARKET_STATE_LAYOUT_V2 } from "@project-serum/serum";
import { getMultipleAccounts } from "../utils";

export const getTokenByMintAddress = (address: string): TokenInfo | null => {

  if (address === NATIVE_SOL.address) {
    return Object.assign({}, NATIVE_SOL);
  }

  let token = null;

  for (const symbol of Object.keys(TOKENS)) {
    const info = Object.assign({}, TOKENS[symbol]);

    if (info.address === address) {
      token = info;
    }
  }

  return token;
}

export const createAmmAuthority = async (programId: PublicKey) => {

  const seeds = [
    new Uint8Array(
      Buffer.from("amm authority".replace("\u00A0", " "), "utf-8")
    ),
  ];

  const [publicKey, nonce] = await PublicKey.findProgramAddress(
    seeds,
    programId
  );

  return { publicKey, nonce };
}

export const getAddressForWhat = (address: string) => {
  for (const pool of LIQUIDITY_POOLS) {
    for (const [key, value] of Object.entries(pool)) {
      if (key === 'lp') {
        if (value.address === address) {
          return { key: 'lpMintAddress', lpMintAddress: pool.lp.address, version: pool.version }
        }
      } else if (value === address) {
        return { key, lpMintAddress: pool.lp.address, version: pool.version }
      }
    }
  }

  return {}
}

export const getMarket = async (
  connection: Connection,
  address: string
) => {

  let market: any = {};
  const marketInfo = await connection.getAccountInfo(new PublicKey(address));

  if (!marketInfo) {
    throw new Error('Serum market not found');
  }

  if (marketInfo && marketInfo.data) {
    market= MARKET_STATE_LAYOUT_V2.decode(marketInfo.data);
  }

  return { marketId: address, marketInfo: market };
}

export const getPool = async (
  connection: Connection,
  address: string

) => {

  let poolAmm: any;
  let filteredPool = LIQUIDITY_POOLS.filter(info => info.lp.address === address)[0];

  if (!filteredPool) {
    throw new Error('Raydium pool not found');
  }

  const poolAmmInfo = await connection.getAccountInfo(new PublicKey(filteredPool.ammId));

  if (poolAmmInfo && poolAmmInfo.data) {
    poolAmm = AMM_INFO_LAYOUT_V4.decode(poolAmmInfo.data);
  }

  return { ammId: filteredPool.ammId, ammInfo: poolAmm };
}
  
export const getLpMintListDecimals = async (
  connection: any,
  mintAddressInfos: string[]

): Promise<{ [name: string]: number }> => {

  const reLpInfoDict: { [name: string]: number } = {};
  const mintList = [] as PublicKey[];
  
  mintAddressInfos.forEach((item) => {
    let lpInfo = Object
      .values(LP_TOKENS)
      .find((itemLpToken) => itemLpToken.address === item);
      
    if (!lpInfo) {
      mintList.push(new PublicKey(item));
      lpInfo = { decimals: null };
    }
    reLpInfoDict[item] = lpInfo.decimals;
  });
  
  const mintAll = await getMultipleAccounts(connection, mintList, connection.commitment);

  for (let mintIndex = 0; mintIndex < mintAll.length; mintIndex += 1) {
    const itemMint = mintAll[mintIndex];
  
    if (itemMint) {
      const mintLayoutData = MINT_LAYOUT.decode(Buffer.from(itemMint.account.data));
      reLpInfoDict[mintList[mintIndex].toString()] = mintLayoutData.decimals;
    }
  }

  const reInfo: { [name: string]: number } = {};
  
  for (const key of Object.keys(reLpInfoDict)) {
    if (reLpInfoDict[key] !== null) {
      reInfo[key] = reLpInfoDict[key];
    }
  }

  return reInfo;
}