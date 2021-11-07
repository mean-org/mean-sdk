import { Market, Orderbook } from "@project-serum/serum";
import { Client } from "../types";

export interface SerumClient extends Client {
  market: Market;
  orderbooks: Orderbook[];
}