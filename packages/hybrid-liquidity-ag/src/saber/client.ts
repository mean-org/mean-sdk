import { AccountMeta, Connection, PublicKey, SYSVAR_CLOCK_PUBKEY, Transaction } from "@solana/web3.js";
import { AMM_POOLS, PROTOCOLS } from "../data";
import { ExchangeInfo, LPClient, SABER } from "../types";
import { deserializeMint, deserializeAccount, Token as SaberToken , TokenAmount } from "@saberhq/token-utils";
import { SLPInfo } from "./types";
import { getMultipleAccounts } from "../utils";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, Token, u64 } from "@solana/spl-token";
import { SLPools } from "./pool";

import { 
  StableSwap, 
  StableSwapConfig, 
  decodeSwap, 
  loadProgramAccount, 
  findSwapAuthorityKey,
  makeExchange,
  loadExchangeInfo,
  calculateSwapPrice,
  calculateEstimatedSwapOutputAmount,

} from "@saberhq/stableswap-sdk";

import { BN } from "bn.js";

export class SaberClient implements LPClient {

  private connection: Connection;
  private poolAddress: string;
  private saberSwap: any;
  private currentPool: any;
  private exchangeInfo: ExchangeInfo | undefined;
  private exchangeAccounts: AccountMeta[];

  constructor(connection: Connection, poolAddress: string) {
    this.connection = connection;
    this.poolAddress = poolAddress;
    this.exchangeAccounts = [];
  }

  public get protocol() : PublicKey {
    return SABER; 
  }

  public get accounts(): AccountMeta[] {
    return this.exchangeAccounts || [];
  }

  public get pool() : any {
    return this.currentPool; 
  }

  public get exchange() : ExchangeInfo | undefined {
    return this.exchangeInfo; 
  }

  public updateExchange = async (
    from: string,
    to: string,
    amount: number,
    slippage: number

  ): Promise<void> => {
    
    if (!this.poolAddress) {
      throw new Error("Unknown pool");
    }

    await this.updatePoolInfo();

    if (!this.currentPool) {
      throw new Error("Saber pool not found.");
    }

    const invert = (from === this.currentPool.tokens[1] && to === this.currentPool.tokens[0]);
    const tokenA = !invert ? this.currentPool.mints[from] : this.currentPool.mints[to];
    const tokenB = !invert ? this.currentPool.mints[to] : this.currentPool.mints[from];

    const basicExchange = makeExchange({
      swapAccount: new PublicKey(this.currentPool.ammAddress),
      lpToken: new PublicKey(this.currentPool.address),
      tokenA: tokenA as SaberToken,
      tokenB: tokenB as SaberToken
    });

    if (!basicExchange) {
      throw new Error('Exchange not available');
    }

    const exchangeInfo = await loadExchangeInfo(
      this.connection,
      basicExchange,
      this.saberSwap,
    );

    if (!exchangeInfo) {
      throw new Error('Exchange not available');
    }

    const amountIn = amount === 0 ? 1 : amount;
    const fromAmount = new TokenAmount(tokenA as SaberToken, 10 ** tokenA.decimals);
    const swapOutput = calculateEstimatedSwapOutputAmount(exchangeInfo, fromAmount);
    const swapPrice = calculateSwapPrice(exchangeInfo);
    const protocol = PROTOCOLS.filter(p => p.address === SABER.toBase58())[0];
    const outAmount = !invert
      ? +swapOutput
          .outputAmountBeforeFees
          .toFixed(tokenB.decimals, undefined, 1)
      : +swapOutput
          .outputAmountBeforeFees
          .invert()
          .toFixed(tokenB.decimals, undefined, 1);

    const minOutAmount = !invert
      ? +swapOutput
          .outputAmount
          .toFixed(tokenB.decimals, undefined, 1)
      : +swapOutput
          .outputAmount
          .invert()
          .toFixed(tokenB.decimals, undefined, 1);

    const minOutAmountWithSlippage = minOutAmount * (100 - slippage) / 100;

    const price = !invert 
      ? +swapPrice
          .asFraction
          .toFixed(tokenB.decimals, undefined, 1)
      : +swapPrice
          .invert()
          .asFraction
          .toFixed(tokenB.decimals, undefined, 1);
    
    this.exchangeInfo = {
      fromAmm: protocol.name,
      outPrice: price,
      priceImpact: 0,
      amountIn: amount,
      amountOut: amount === 0 ? 0 : outAmount * amountIn,
      minAmountOut: amount === 0 ? 0 : minOutAmountWithSlippage * amountIn,
      networkFees: amount === 0 ? 0 : +swapOutput
        .fee
        .toFixed(tokenA.decimals, undefined, 1),

      protocolFees: amount === 0 ? 0 : +swapOutput
        .lpFee
        .toFixed(tokenA.decimals, undefined, 1)

    } as ExchangeInfo;

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

    if (!this.currentPool) {
      throw new Error("Saber pool not found.");
    }
    
    const tx = new Transaction();
    const tokenA = this.currentPool.mints[from];
    const tokenB = this.currentPool.mints[to];
    const fromMint = new PublicKey(from);
    const toMint = new PublicKey(to);

    const fromTokenAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      fromMint,
      owner,
      true
    );

    const toTokenAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      toMint,
      owner,
      true
    );

    const toTokenAccountInfo = await this.connection.getAccountInfo(toTokenAccount);

    if (!toTokenAccountInfo) {      
      tx.add(
        Token.createAssociatedTokenAccountInstruction(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          toMint,
          toTokenAccount,
          owner,
          owner
        )
      );
    }

    const saberPool = SLPools.filter(p => p.address === this.currentPool.address)[0];

    if (!saberPool) {
      throw new Error("Saber pool not found.");
    }

    const amountWithSlippage = amountOut * (100 - slippage) / 100;
    const swapArgs = {
      userAuthority: owner,
      userSource: fromTokenAccount,
      poolSource: this.currentPool.reserves[fromMint.toBase58()].address,
      poolDestination: this.currentPool.reserves[toMint.toBase58()].address,
      userDestination: toTokenAccount,
      amountIn: new u64(parseFloat(amountIn.toFixed(tokenA.decimals)) * 10 ** tokenA.decimals),
      minimumAmountOut: new u64(parseFloat(amountWithSlippage.toFixed(tokenA.decimals)) * 10 ** tokenB.decimals)
    };

    tx.add(
      this.saberSwap.swap(swapArgs)
    );

    const feeBnAmount = new BN(parseFloat(feeAmount.toFixed(tokenA.decimals)) * 10 ** tokenA.decimals);
    // Transfer fees
    const feeAccount = new PublicKey(feeAddress);
    const feeAccountToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      fromMint,
      feeAccount,
      true
    );

    const feeAccountTokenInfo = await this.connection.getAccountInfo(feeAccountToken);

    if (!feeAccountTokenInfo) {
      tx.add(
        Token.createAssociatedTokenAccountInstruction(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          fromMint,
          feeAccountToken,
          feeAccount,
          owner
        )
      );
    }

    tx.add(
      Token.createTransferInstruction(
        TOKEN_PROGRAM_ID,
        fromTokenAccount,
        feeAccountToken,
        owner,
        [],
        feeBnAmount.toNumber()
      )
    );

    tx.feePayer = owner;
    const { blockhash } = await this.connection.getRecentBlockhash(this.connection.commitment);
    tx.recentBlockhash = blockhash;

    return tx; 
  };

  private updatePoolInfo = async () => {

    try {

      if (!this.poolAddress) {
        throw new Error("Unknown pool");
      }
  
      const poolInfo = AMM_POOLS.filter(info => info.address === this.poolAddress)[0];
  
      if (!poolInfo) {
        throw new Error("Saber pool not found.");
      }
  
      const swapAccountData = await loadProgramAccount(
        this.connection,
        new PublicKey(poolInfo.ammAddress),
        SABER
      );
  
      const swapState = decodeSwap(swapAccountData);
  
      const [authority] = await findSwapAuthorityKey(
        new PublicKey(poolInfo.ammAddress),
        SABER
      );
  
      const config = {
        authority,
        swapAccount: new PublicKey(poolInfo.ammAddress),
        swapProgramID: SABER,
        tokenProgramID: TOKEN_PROGRAM_ID
        
      } as StableSwapConfig
  
      this.saberSwap = new StableSwap(config, swapState);
      const saberPool = SLPools.filter(p => p.address === poolInfo.address)[0];
  
      if (!saberPool) {
        throw new Error("Saber pool not found.");
      }
  
      // Mints accounts
      const mintsMap: any = {};
      const mintInfos = await getMultipleAccounts(
        this.connection,
        saberPool.mints.map(a => new PublicKey(a)),
        this.connection.commitment
      );
  
      mintInfos.forEach((value, index) => {
        if (value) {
          const data = value.account.data;
          const decoded = deserializeMint(data);
          const token = SaberToken.fromMint(
            value.publicKey,
            decoded.decimals,
            { chainId: 101 }
          );
          mintsMap[saberPool.tokens[index]] = token;
        }
      });
  
      // Reserves accounts
      const reservesMap: any = {};
      const reserveInfos = await getMultipleAccounts(
        this.connection,
        saberPool.reserves.map(a => new PublicKey(a)),
        this.connection.commitment
      );
  
      reserveInfos.forEach((value, index) => {
        if (value) {
          const data = value.account.data;
          const decoded = deserializeAccount(data);
          reservesMap[saberPool.tokens[index]] = Object.assign({ 
            address: value.publicKey 
          }, decoded);
        }
      });
  
      this.currentPool = {
        name: saberPool.name,
        address: saberPool.address,
        ammAddress: saberPool.ammAddress,
        programId: saberPool.programId,
        tokens: saberPool.tokens,
        mints: mintsMap,
        reserves: reservesMap
  
      } as SLPInfo;

    } catch (error) {
      throw error;
    }
  }

  private updateExchangeAccounts = async (
    from: string,
    to: string

  ): Promise<void> => {

    try {

      if (!this.currentPool || !this.saberSwap) {
        return undefined;
      }

      const saberPool = this.currentPool as SLPInfo;
      const saberSwap = this.saberSwap as StableSwap;
      const fromMint = new PublicKey(from);
      const toMint = new PublicKey(to);

      let inputReserveAccount = saberSwap.state.tokenA.reserve;
      let outputReserveAccount = saberSwap.state.tokenB.reserve;
      let adminFeeAccount = saberSwap.state.tokenB.adminFeeAccount;

      if (
        saberSwap.state.tokenA.mint.equals(toMint) && 
        saberSwap.state.tokenB.mint.equals(fromMint)) 
      {
        inputReserveAccount = saberSwap.state.tokenB.reserve;
        outputReserveAccount = saberSwap.state.tokenA.reserve;
        adminFeeAccount = saberSwap.state.tokenA.adminFeeAccount;
      }

      this.exchangeAccounts = [
        { pubkey: new PublicKey(saberPool.address), isSigner: false, isWritable: false },
        { pubkey: saberSwap.config.swapProgramID, isSigner: false, isWritable: false },
        { pubkey: saberSwap.config.swapAccount, isSigner: false, isWritable: false },
        { pubkey: saberSwap.config.authority, isSigner: false, isWritable: false },
        { pubkey: inputReserveAccount, isSigner: false, isWritable: true },
        { pubkey: outputReserveAccount, isSigner: false, isWritable: true },
        { pubkey: adminFeeAccount, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }
      ];

    } catch (_error) {
      throw _error;
    }
  }

}