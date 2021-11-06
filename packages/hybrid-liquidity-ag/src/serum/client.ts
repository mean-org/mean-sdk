import { Market, Orderbook } from "@project-serum/serum";
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { cloneDeep } from "lodash";
import { getMultipleAccounts } from "../utils";
import { NATIVE_SOL_MINT, SERUM_PROGRAM_ID_V3, WRAPPED_SOL_MINT } from "../types";
import { TokenAmount } from "../safe-math";
import { PROTOCOLS } from "../data";
import { ExchangeInfo, SERUM } from "../types";
import { getOutAmount, placeOrderTx } from "./swap";
import { SerumClient as Client } from "./types";
import { getMarket } from "./utils";
import BN from "bn.js";

export class SerumClient implements Client {

  private connection: Connection;
  private currentMarket: any;
  private currentOrderbooks: any;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public get protocolAddress(): string {
    return SERUM.toBase58();
  }

  public getExchangeInfo = async (
    from: string,
    to: string,
    amount: number,
    slippage: number

  ): Promise<ExchangeInfo> => {
    
    const market = cloneDeep(this.currentMarket);

    if (!market) {
      throw new Error('Serum market info not found');
    }

    const fromMint = from === market.baseMintAddress.toBase58() 
      ? market.baseMintAddress.toBase58() 
      : market.quoteMintAddress.toBase58();

    const toMint = to === market.quoteMintAddress.toBase58() 
      ? market.quoteMintAddress.toBase58() 
      : market.baseMintAddress.toBase58();
    
    const toDecimals = from === market.quoteMintAddress.toBase58() 
      ? market._baseSplTokenDecimals : market._quoteSplTokenDecimals;

    const priceAmount = 1;
    // always calculate the price based on the unit
    const bids = (this.currentOrderbooks.filter((ob: any) => ob.isBids)[0]).slab;
    const asks = (this.currentOrderbooks.filter((ob: any) => !ob.isBids)[0]).slab;

    const { amountOut, amountOutWithSlippage, priceImpact } = getOutAmount(
      market,
      asks,
      bids,
      fromMint,
      toMint,
      priceAmount.toString(),
      slippage
    );

    const out = new TokenAmount(amountOut, toDecimals, false);
    const outWithSlippage = new TokenAmount(amountOutWithSlippage, toDecimals, false);
    const protocol = PROTOCOLS.filter(p => p.address === SERUM.toBase58())[0];

    const exchangeInfo: ExchangeInfo = {
      fromAmm: protocol.name,
      outPrice: !out.isNullOrZero() ? +out.fixed(): 1,
      priceImpact,
      amountIn: amount,
      amountOut: !out.isNullOrZero() ? (+out.fixed() * amount): 0,
      minAmountOut: +outWithSlippage.fixed() * amount,
      networkFees: 0,
      protocolFees: 0.3 * amount / 100
    };

    return exchangeInfo;
  };

  public getTokens = (): Promise<Map<string, any>> => {
    throw new Error("Method not implemented.");
  };

  public getSwap = async (
    owner: PublicKey,
    from: string,
    to: string,
    amountIn: number,
    amountOut: number,
    slippage: number,
    feeAddress: string,
    feeAmount: number
  ): Promise<Transaction> => {
    
    const market = cloneDeep(this.currentMarket);

    if (!market) {
      throw new Error('Raydium pool info not found');
    }

    const fromMint = from === NATIVE_SOL_MINT.toBase58() ? WRAPPED_SOL_MINT.toBase58() : from;
    const fromDecimals = fromMint === market.baseMintAddress.toBase58() 
      ? market._baseSplTokenDecimals : market._quoteSplTokenDecimals;

    const fromAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      new PublicKey(from),
      owner,
      true
    );
      
    const toAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      new PublicKey(to),
      owner,
      true
    );

    const bids = (this.currentOrderbooks.filter((ob: any) => ob.isBids)[0]).slab;
    const asks = (this.currentOrderbooks.filter((ob: any) => !ob.isBids)[0]).slab;
    
    let { transaction, signers } = await placeOrderTx(
      this.connection,
      owner,
      market, // poolInfo,
      asks,
      bids,
      new PublicKey(from),
      new PublicKey(to),
      fromAccount,
      toAccount,
      new BN(amountIn * 10 ** fromDecimals),
      slippage,
      new PublicKey(feeAddress),
      new BN(feeAmount * 10 ** fromDecimals)
    );

    transaction.feePayer = owner;
    const { blockhash } = await this.connection.getRecentBlockhash(this.connection.commitment);
    transaction.recentBlockhash = blockhash;

    if (signers.length) {
      transaction.partialSign(...signers);
    }

    return transaction;
  };

  public getMarketInfo = async (
    from: string,
    to: string
    
  ): Promise<Market | undefined> => {

    const marketInfo = await getMarket(
      this.connection,
      from,
      to
    );

    if (!marketInfo) {
      throw new Error('Serum Market not found');
    }

    if (this.currentMarket && this.currentMarket.address.equals(marketInfo.ownAddress)) {
      return this.currentMarket;
    }

    if (marketInfo) {
      const serumProgramKey = new PublicKey(SERUM_PROGRAM_ID_V3);
      this.currentMarket = await Market.load(
        this.connection, 
        marketInfo.ownAddress, { }, 
        serumProgramKey
      );
    }

    return this.currentMarket;
  };

  public getMarketOrderbooks = async (
    market: Market

  ): Promise<Orderbook[]> => {

    const accounts = await getMultipleAccounts(
      this.connection, 
      [market.bidsAddress, market.asksAddress], 
      'confirmed'
    );

    if (!accounts || !accounts.length) {
      throw new Error('Orderbooks not found');
    }

    const orderBooks = [];

    for (let info of accounts) {
      if (info) {
        const data = info.account.data;
        const orderbook = Orderbook.decode(market, data);
        orderBooks.push(orderbook);
      }        
    }

    this.currentOrderbooks = orderBooks;

    return orderBooks;
  }
}