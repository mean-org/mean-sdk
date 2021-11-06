import { AccountMeta, Connection, PublicKey, Transaction } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { LPClient, ExchangeInfo, RAYDIUM } from "../types";
import { getSwapOutAmount, getSwapTx } from "./swap";
import { createAmmAuthority, getAddressForWhat, getLpMintListDecimals, getMarket, getPool, getTokenByMintAddress } from "./utils";
import { LiquidityPoolInfo } from "./types";
import { LIQUIDITY_POOL_PROGRAM_ID_V4, NATIVE_SOL_MINT, SERUM_PROGRAM_ID_V3, WRAPPED_SOL_MINT } from "../types";
import { LP_TOKENS, TOKENS } from "./tokens";
import { cloneDeep } from "lodash-es";
import { TokenAmount } from "../safe-math";
import { getMultipleAccounts } from "../utils";
import { ACCOUNT_LAYOUT, AMM_INFO_LAYOUT, AMM_INFO_LAYOUT_V3, AMM_INFO_LAYOUT_V4, MINT_LAYOUT } from "../layouts";
import { OpenOrders } from "@project-serum/serum";
import { BN } from "bn.js";
import { PROTOCOLS } from "../data";

export class RaydiumClient implements LPClient {
  
  private connection: Connection;
  private currentPool: any;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public get protocolAddress(): string {
    return RAYDIUM.toBase58();
  }

  public get hlaExchangeAccounts(): AccountMeta[] {
    return [];
  }

  public getPoolInfo = async (
    address: string
  
  ) => {

    if (this.currentPool && this.currentPool.address === address) {
      return this.currentPool;
    }
  
    const { ammId, ammInfo } = await getPool(this.connection, address);
  
    if (!ammInfo) {
      throw new Error('Raydium pool not found');
    }
  
    let liquidityPool: any = {};
    const lpMintAddressList = [ammInfo.lpMintAddress.toBase58()];
    const lpMintDecimal = (await getLpMintListDecimals(this.connection, lpMintAddressList))[0];
    
    const fromCoin = ammInfo.coinMintAddress.equals(WRAPPED_SOL_MINT)
      ? NATIVE_SOL_MINT.toBase58()
      : ammInfo.coinMintAddress.toString();
      
    const toCoin = ammInfo.pcMintAddress.equals(WRAPPED_SOL_MINT)
      ? NATIVE_SOL_MINT.toBase58()
      : ammInfo.pcMintAddress.toString();
    
    let coin = Object
      .values(TOKENS)
      .find((item) => item.address === fromCoin);
    
    if (!coin) {
      TOKENS[`unknow-${ammInfo.coinMintAddress.toString()}`] = {
        symbol: 'unknown',
        name: 'unknown',
        address: ammInfo.coinMintAddress.toString(),
        decimals: ammInfo.coinDecimals.toNumber(),
        cache: true,
        tags: []
      }
      coin = TOKENS[`unknow-${ammInfo.coinMintAddress.toString()}`];
    }
  
    if (!coin.tags.includes('unofficial')) {
      coin.tags.push('unofficial');
    }
  
    let pc = Object
      .values(TOKENS)
      .find((item) => item.address === toCoin);
  
    if (!pc) {
      TOKENS[`unknow-${ammInfo.pcMintAddress.toString()}`] = {
        symbol: 'unknown',
        name: 'unknown',
        address: ammInfo.pcMintAddress.toString(),
        decimals: ammInfo.pcDecimals.toNumber(),
        cache: true,
        tags: []
      }
      pc = TOKENS[`unknow-${ammInfo.pcMintAddress.toString()}`];
    }
    
    if (!pc.tags.includes('unofficial')) {
      pc.tags.push('unofficial');
    }
  
    if (coin.address === WRAPPED_SOL_MINT.toBase58()) {
      coin.symbol = 'SOL'
      coin.name = 'SOL'
      coin.address = NATIVE_SOL_MINT.toBase58()
    }
  
    if (pc.address === WRAPPED_SOL_MINT.toBase58()) {
      pc.symbol = 'SOL'
      pc.name = 'SOL'
      pc.address = NATIVE_SOL_MINT.toBase58()
    }
    
    const lp = Object.values(LP_TOKENS).find((item) => item.address === ammInfo.lpMintAddress) ?? {
      symbol: `${coin.symbol}-${pc.symbol}`,
      name: `${coin.symbol}-${pc.symbol}`,
      coin,
      pc,
      address: ammInfo.lpMintAddress.toBase58(),
      decimals: lpMintDecimal
    };
  
    const { publicKey } = await createAmmAuthority(new PublicKey(LIQUIDITY_POOL_PROGRAM_ID_V4));
    const { marketInfo } = await getMarket(this.connection, ammInfo.serumMarket.toBase58());
    const serumVaultSigner = await PublicKey.createProgramAddress(
      [ammInfo.serumMarket.toBuffer(), marketInfo.vaultSignerNonce.toArrayLike(Buffer, 'le', 8)],
      new PublicKey(SERUM_PROGRAM_ID_V3)
    );
  
    const itemLiquidity: LiquidityPoolInfo = {
      name: `${coin.symbol}-${pc.symbol}`,
      coin,
      pc,
      lp,
      version: 4,
      programId: LIQUIDITY_POOL_PROGRAM_ID_V4.toBase58(),
      ammId,
      ammAuthority: publicKey.toString(),
      ammOpenOrders: ammInfo.ammOpenOrders.toString(),
      ammTargetOrders: ammInfo.ammTargetOrders.toString(),
      ammQuantities: NATIVE_SOL_MINT.toBase58(),
      poolCoinTokenAccount: ammInfo.poolCoinTokenAccount.toString(),
      poolPcTokenAccount: ammInfo.poolPcTokenAccount.toString(),
      poolWithdrawQueue: ammInfo.poolWithdrawQueue.toString(),
      poolTempLpTokenAccount: ammInfo.poolTempLpTokenAccount.toString(),
      serumProgramId: SERUM_PROGRAM_ID_V3.toBase58(),
      serumMarket: ammInfo.serumMarket.toString(),
      serumBids: marketInfo.bids.toString(),
      serumAsks: marketInfo.asks.toString(),
      serumEventQueue: marketInfo.eventQueue.toString(),
      serumCoinVaultAccount: marketInfo.baseVault.toString(),
      serumPcVaultAccount: marketInfo.quoteVault.toString(),
      serumVaultSigner: serumVaultSigner.toString(),
      official: false
    };
  
    const publicKeys = [
      new PublicKey(itemLiquidity.poolCoinTokenAccount),
      new PublicKey(itemLiquidity.poolPcTokenAccount),
      new PublicKey(itemLiquidity.ammOpenOrders),
      new PublicKey(itemLiquidity.ammId),
      new PublicKey(lp.address)
    ];
  
    const poolInfo = cloneDeep(itemLiquidity);
    poolInfo.coin.balance = new TokenAmount(0, coin.decimals);
    poolInfo.pc.balance = new TokenAmount(0, pc.decimals);
    liquidityPool = poolInfo;
  
    const multipleInfo = await getMultipleAccounts(
      this.connection, 
      publicKeys, 
      this.connection.commitment
    );
  
    multipleInfo.forEach((info) => {
      if (info) {
        const address = info.publicKey.toBase58();
        const data = Buffer.from(info.account.data);
        const { key, lpMintAddress, version } = getAddressForWhat(address);
  
        if (key && lpMintAddress) {
          const poolInfo = liquidityPool;
  
          switch (key) {
            case 'poolCoinTokenAccount': {
              const parsed = ACCOUNT_LAYOUT.decode(data);
              // quick fix: Number can only safely store up to 53 bits
              poolInfo.coin.balance.wei = poolInfo.coin.balance.wei.plus(parseFloat(parsed.amount.toString()));
              break;
            }
            case 'poolPcTokenAccount': {
              const parsed = ACCOUNT_LAYOUT.decode(data);
              poolInfo.pc.balance.wei = poolInfo.pc.balance.wei.plus(parseFloat(parsed.amount.toString()));
              break;
            }
            case 'ammOpenOrders': {
              const OPEN_ORDERS_LAYOUT = OpenOrders.getLayout(new PublicKey(poolInfo.serumProgramId));
              const parsed = OPEN_ORDERS_LAYOUT.decode(data);
              const { baseTokenTotal, quoteTokenTotal } = parsed;
              poolInfo.coin.balance.wei = poolInfo.coin.balance.wei.plus(parseFloat(baseTokenTotal.toString()));
              poolInfo.pc.balance.wei = poolInfo.pc.balance.wei.plus(parseFloat(quoteTokenTotal.toString()));
              break;
            }
            case 'ammId': {
              let parsed;
              if (version === 2) {
                parsed = AMM_INFO_LAYOUT.decode(data);
              } else if (version === 3) {
                parsed = AMM_INFO_LAYOUT_V3.decode(data);
              } else {
                parsed = AMM_INFO_LAYOUT_V4.decode(data);
                const { swapFeeNumerator, swapFeeDenominator } = parsed;
                poolInfo.fees = {
                  swapFeeNumerator: parseFloat(swapFeeNumerator.toString()),
                  swapFeeDenominator: parseFloat(swapFeeDenominator.toString())
                };
              }
  
              const { status, needTakePnlCoin, needTakePnlPc } = parsed;
              poolInfo.status = new BN(status).toNumber();
              poolInfo.coin.balance.wei = poolInfo.coin.balance.wei.minus(parseFloat(needTakePnlCoin.toString()));
              poolInfo.pc.balance.wei = poolInfo.pc.balance.wei.minus(parseFloat(needTakePnlPc.toString()));
              break;
            }
            // getLpSupply
            case 'lpMintAddress': {
              const parsed = MINT_LAYOUT.decode(data);
              poolInfo.lp.totalSupply = new TokenAmount(parseFloat(parsed.supply.toString()), poolInfo.lp.decimals);
              break;
            }
          }
        }
      }
    });
  
    this.currentPool = liquidityPool;

    return this.currentPool;
  }

  public getExchangeInfo = async (
    from: string,
    to: string,
    amount: number,
    slippage: number

  ): Promise<ExchangeInfo> => {

    const poolInfo = cloneDeep(this.currentPool);

    if (!poolInfo) {
      throw new Error('Raydium pool info not found');
    }

    if (from === WRAPPED_SOL_MINT.toBase58()) {
      from = NATIVE_SOL_MINT.toBase58()
    }

    if (to === WRAPPED_SOL_MINT.toBase58()) {
      to = NATIVE_SOL_MINT.toBase58();
    }

    const fromMint = from === poolInfo.coin.address ? poolInfo.coin.address : poolInfo.pc.address;
    const toMint = to === poolInfo.pc.address ? poolInfo.pc.address : poolInfo.coin.address;
    const { 
      amountOut, 
      amountOutWithSlippage, 
      priceImpact

    } = getSwapOutAmount(
      poolInfo, 
      fromMint, 
      toMint,
      '1', 
      slippage
    );

    const protocol = PROTOCOLS.filter(p => p.address === RAYDIUM.toBase58())[0];
    const amountIn = new BN(amount * 10 ** poolInfo.coin.decimals);
    const amountInWithFees = amountIn
      .muln(poolInfo.fees.swapFeeDenominator - poolInfo.fees.swapFeeNumerator)
      .divn(poolInfo.fees.swapFeeDenominator);

    const exchangeInfo: ExchangeInfo = {
      fromAmm: protocol.name,
      outPrice: !amountOut.isNullOrZero() ? +amountOut.fixed(): 0,
      priceImpact,
      amountIn: amount,
      amountOut: +amountOut.fixed() * amount,
      minAmountOut: +amountOutWithSlippage.fixed() * amount,
      networkFees: 0.02,
      protocolFees: amountIn.sub(amountInWithFees).toNumber() / (10 ** poolInfo.coin.decimals)
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

    const poolInfo = cloneDeep(this.currentPool);

    if (!poolInfo) {
      throw new Error('Raydium pool info not found');
    }

    if (from === WRAPPED_SOL_MINT.toBase58()) {
      from = NATIVE_SOL_MINT.toBase58()
    }

    if (to === WRAPPED_SOL_MINT.toBase58()) {
      to = NATIVE_SOL_MINT.toBase58();
    }

    const fromMintToken = getTokenByMintAddress(from);
    const toMintToken = getTokenByMintAddress(to);
    const fromDecimals = fromMintToken ? fromMintToken.decimals : 6;
    const fromMint = from === NATIVE_SOL_MINT.toBase58() ? WRAPPED_SOL_MINT : new PublicKey(from);

    const fromAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      fromMint,
      owner,
      true
    );

    const toDecimals = toMintToken ? toMintToken.decimals : 6;
    const toMint = to === NATIVE_SOL_MINT.toBase58() ? WRAPPED_SOL_MINT : new PublicKey(to);
    const toAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      toMint,
      owner,
      true
    );

    const toSwapAmount = amountOut * (100 - slippage) / 100;
    
    let { transaction, signers } = await getSwapTx(
      this.connection,
      owner,
      poolInfo,
      fromMint,
      toMint,
      fromAccount,
      toAccount,
      new BN(parseFloat(amountIn.toFixed(fromDecimals)) * 10 ** fromDecimals),
      new BN(parseFloat(toSwapAmount.toFixed(toDecimals)) * 10 ** toDecimals),
      new PublicKey(feeAddress),
      new BN(parseFloat(feeAmount.toFixed(fromDecimals)) * 10 ** fromDecimals)
    );

    transaction.feePayer = owner;
    const { blockhash } = await this.connection.getRecentBlockhash(this.connection.commitment);
    transaction.recentBlockhash = blockhash;

    if (signers.length) {
      transaction.partialSign(...signers);
    }

    return transaction;
  };
}
