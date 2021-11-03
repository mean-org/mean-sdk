import { Market, Orderbook } from "@project-serum/serum";
import { Client } from "../types";

export interface SerumClient extends Client {

  getMarketInfo(from: string, to: string): Promise<Market | undefined>
  getMarketOrderbooks(market: Market): Promise<Orderbook[]>

}