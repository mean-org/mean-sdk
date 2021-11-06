import { Connection, PublicKey } from "@solana/web3.js";
import { MARKETS as SERUM_MARKETS } from "@project-serum/serum/lib/tokens_and_markets";
import { getMultipleAccounts } from "../utils";
import { MARKET_STATE_LAYOUT_V2 } from "@project-serum/serum";
import { cloneDeep } from "lodash";
import { NATIVE_SOL_MINT, WRAPPED_SOL_MINT } from "../types";

export const startMarkets = () => {
  let markets: string[] = [];
  for (const market of SERUM_MARKETS) {
    const address = market.address.toBase58();
    if (!market.deprecated && !markets.includes(address)) {
      markets.push(address);
    }
  }
  return markets;
}

export const getMarkets = async (
  connection: Connection
) => {

  let markets: any = { };
  const marketAddresses = startMarkets();
  const marketInfos = await getMultipleAccounts(
    connection,
    marketAddresses.map((m) => new PublicKey(m)),
    connection.commitment
  );

  marketInfos.forEach((marketInfo) => {
    if (marketInfo) {
      const address = marketInfo.publicKey.toBase58();
      const data = marketInfo.account.data;

      if (address && data) {
        const decoded = MARKET_STATE_LAYOUT_V2.decode(data);
        markets[address] = decoded;
      }
    }
  });

  return markets;
}

export const getMarket = async (
  connection: Connection,
  from: string,
  to: string
  
): Promise<any> => {

  let marketInfo: any;
  const allMarkets = await getMarkets(connection);

  for (let address of Object.keys(allMarkets)) {

    let info = cloneDeep(allMarkets[address]);
    let fromAddress = from;
    let toAddress = to;

    if (fromAddress === NATIVE_SOL_MINT.toBase58()) {
      fromAddress = WRAPPED_SOL_MINT.toBase58();
    }

    if (toAddress === NATIVE_SOL_MINT.toBase58()) {
      toAddress = WRAPPED_SOL_MINT.toBase58();
    }

    if (
      (info.baseMint.toBase58() === fromAddress &&
        info.quoteMint.toBase58() === toAddress) ||
      (info.quoteMint.toBase58() === fromAddress &&
        info.baseMint.toBase58() === toAddress)
    ) {
      marketInfo = info;
      break;
    }
  }

  return marketInfo
};
