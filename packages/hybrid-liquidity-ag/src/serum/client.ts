import { Market, Orderbook } from "@project-serum/serum";
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AccountMeta, Connection, PublicKey, Transaction } from "@solana/web3.js";
import { getMultipleAccounts } from "../utils";
import { NATIVE_SOL_MINT, SERUM_PROGRAM_ID_V3, WRAPPED_SOL_MINT } from "../types";
import { TokenAmount } from "../safe-math";
import { PROTOCOLS } from "../data";
import { ExchangeInfo, SERUM } from "../types";
import { getOutAmount, placeOrderTx } from "./swap";
import { SerumClient as Client } from "./types";

export class SerumClient implements Client {

  private connection: Connection;
  private marketAddress: string;
  private currentMarket: any;
  private currentOrderbooks: any;
  private exchangeInfo: ExchangeInfo | undefined;
  private exchangeAccounts: AccountMeta[];

  constructor(connection: Connection, marketAddress: string) {
    this.connection = connection;
    this.marketAddress = marketAddress;
    this.exchangeAccounts = [];
  }

  public get protocol() : PublicKey {
    return SERUM; 
  }

  public get accounts(): AccountMeta[] {
    return this.exchangeAccounts;
  }

  public get market() : any {
    return this.currentMarket; 
  }

  public get exchange() : ExchangeInfo | undefined {
    return this.exchangeInfo; 
  }

  public set exchange(exchangeInfo: ExchangeInfo | undefined) {
    this.exchangeInfo = exchangeInfo; 
  }

  public get orderbooks() : Orderbook[] {
    return this.currentOrderbooks; 
  }  

  public updateExchange = async (
    from: string,
    to: string,
    amount: number,
    slippage: number

  ): Promise<void> => {

    if (!this.marketAddress) {
      throw new Error("Unknown market");
    }

    await this.updateMarket();

    if (!this.currentMarket) {
      throw new Error('Serum market info not found');
    }

    await this.updateOrderbooks(this.currentMarket);

    const fromMint = from === this.currentMarket.baseMintAddress.toBase58() 
      ? this.currentMarket.baseMintAddress.toBase58() 
      : this.currentMarket.quoteMintAddress.toBase58();
    
    const fromDecimals = to === this.currentMarket.baseMintAddress.toBase58() 
      ? this.currentMarket._quoteSplTokenDecimals 
      : this.currentMarket._baseSplTokenDecimals;

    const toMint = to === this.currentMarket.quoteMintAddress.toBase58() 
      ? this.currentMarket.quoteMintAddress.toBase58() 
      : this.currentMarket.baseMintAddress.toBase58();
    
    const toDecimals = from === this.currentMarket.quoteMintAddress.toBase58() 
      ? this.currentMarket._baseSplTokenDecimals 
      : this.currentMarket._quoteSplTokenDecimals;

    const priceAmount = 1;
    // always calculate the price based on the unit
    const asks = (this.currentOrderbooks.filter((ob: any) => !ob.isBids)[0]).slab;
    const bids = (this.currentOrderbooks.filter((ob: any) => ob.isBids)[0]).slab;

    const { amountOut, amountOutWithSlippage, priceImpact } = getOutAmount(
      this.currentMarket,
      asks,
      bids,
      fromMint,
      toMint,
      priceAmount,
      slippage
    );

    const out = new TokenAmount(amountOut, toDecimals, false);
    const outWithSlippage = new TokenAmount(amountOutWithSlippage, toDecimals, false);
    const protocol = PROTOCOLS.filter(p => p.address === SERUM.toBase58())[0];

    this.exchange = {
      fromAmm: protocol.name,
      outPrice: !out.isNullOrZero() ? +out.fixed(): 1,
      priceImpact,
      amountIn: amount,
      amountOut: !out.isNullOrZero() ? (+out.fixed() * amount): 0,
      minAmountOut: +outWithSlippage.fixed() * amount,
      networkFees: 0.00001 + 3 * await Token.getMinBalanceRentForExemptAccount(this.connection) / (10 ** fromDecimals),
      protocolFees: 0.3 * amount / 100
    };

    await this.updateExchangeAccounts(from, to);    
  };

  public swapTx = async (
    owner: PublicKey,
    from: string,
    to: string,
    amountIn: number,
    amountOut: number,
    slippage: number,
    feeAddress: string,
    feeAmount: number
  ): Promise<Transaction> => {
    
    const fromMint = from === NATIVE_SOL_MINT.toBase58() ? WRAPPED_SOL_MINT.toBase58() : from;
    const fromAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      new PublicKey(fromMint),
      owner,
      true
    );
      
    const toMint = to === NATIVE_SOL_MINT.toBase58() ? WRAPPED_SOL_MINT.toBase58() : to;
    const toAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      new PublicKey(toMint),
      owner,
      true
    );

    const bids = (this.currentOrderbooks.filter((ob: any) => ob.isBids)[0]).slab;
    const asks = (this.currentOrderbooks.filter((ob: any) => !ob.isBids)[0]).slab;
    
    let { transaction, signers } = await placeOrderTx(
      this.connection,
      owner,
      this.currentMarket,
      asks,
      bids,
      new PublicKey(from),
      new PublicKey(to),
      fromAccount,
      toAccount,
      amountIn,
      amountOut,
      slippage,
      new PublicKey(feeAddress),
      feeAmount
    );

    transaction.feePayer = owner;
    const { blockhash } = await this.connection.getRecentBlockhash(this.connection.commitment);
    transaction.recentBlockhash = blockhash;

    if (signers.length) {
      transaction.partialSign(...signers);
    }

    return transaction;
  };

  private updateMarket = async (): Promise<void> => {

    if (!this.marketAddress) {
      throw new Error('Unknown market');
    }

    const serumProgramKey = new PublicKey(SERUM_PROGRAM_ID_V3);

    this.currentMarket = await Market.load(
      this.connection, 
      new PublicKey(this.marketAddress), 
      { }, 
      serumProgramKey
    );
  };

  private updateOrderbooks = async (market: Market): Promise<void> => {

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
  }

  private updateExchangeAccounts = async (from: string, to: string): Promise<void> => {

    try {
      //TODO: Implement
      this.exchangeAccounts = [] as AccountMeta[];
    } catch (_error) {
      throw _error;
    }
  }
}