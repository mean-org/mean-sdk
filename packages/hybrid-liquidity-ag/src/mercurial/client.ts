import { AccountMeta, Connection, Keypair, PublicKey, Signer, Transaction } from "@solana/web3.js";
import { ExchangeInfo, LPClient, MERCURIAL } from "../types";
import { AMM_POOLS, PROTOCOLS } from "../data";
import { cloneDeep } from "lodash-es";
import { MercurialPoolInfo } from "./types";
import { ASSOCIATED_TOKEN_PROGRAM_ID, MintLayout, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { SIMULATION_USER, StableSwapNPool } from "@mercurial-finance/stable-swap-n-pool";
import { BN } from "bn.js";
import { USDC_MINT, USDT_MINT } from "../types";
import { SwapInstruction } from "@mercurial-finance/stable-swap-n-pool/dist/cjs/instructions";

export class MercurialClient implements LPClient {

  private connection: Connection;
  private currentPool: MercurialPoolInfo | undefined;
  private USDX_POW: number = 10 ** 6;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public get protocolAddress() : string {
    return MERCURIAL.toBase58(); 
  }

  public get hlaExchangeAccounts(): AccountMeta[] {
    return [];
  }
  
  public getPoolInfo = async (
    address: string

  ) => {

    try {

      const poolInfo = AMM_POOLS.filter(info => info.address === address)[0];

      if (!poolInfo) {
        throw new Error("Mercurial pool not found.");
      }

      const stablePool = await StableSwapNPool.load(
        this.connection,
        new PublicKey(poolInfo.address),
        SIMULATION_USER 
      );

      const tokenInfos = await this.connection.getMultipleAccountsInfo(
        poolInfo.tokenAddresses.map(t => new PublicKey(t)),
        this.connection.commitment
      );

      let tokens: any = {};
      let index = 0;

      for (let info of tokenInfos) {
        if (info) {
          const decoded = MintLayout.decode(info.data);
          tokens[poolInfo.tokenAddresses[index]] = decoded;
          index ++;
        }
      }

      const mercurialPool: MercurialPoolInfo = {
        name: poolInfo.name,
        stable: stablePool,
        protocol: MERCURIAL,
        simulatioUser: SIMULATION_USER,
        tokens
      };

      this.currentPool = mercurialPool;

      return this.currentPool;

    } catch (_error) {
      throw _error;
    }
  }

  public getExchangeInfo = async (
    from: string,
    to: string,
    amount: number,
    slippage: number

  ) => {

    const poolInfo = cloneDeep(this.currentPool);

    if (!poolInfo) {
      throw new Error("Mercurial pool not found.");
    }
      
    const fromMint = new PublicKey(from);
    const toMint = new PublicKey(to);
    const inAmount = amount === 0 ? 1 : amount;
    const inAmountBn = inAmount * this.USDX_POW;
    const outAmount = await poolInfo.stable.getOutAmount(fromMint, toMint, inAmountBn);
    const protocolFeeAmount = (outAmount * 0.0004) / (1 - 0.0004);
    const outPrice = inAmountBn / (outAmount + protocolFeeAmount);
    const minOutAmount = (outAmount + protocolFeeAmount) * (100 - slippage) / 100;
    const protocol = PROTOCOLS.filter(p => p.address === MERCURIAL.toBase58())[0];
    
    const exchange: ExchangeInfo = {
      fromAmm: protocol.name,
      outPrice: outPrice,
      priceImpact: 0,
      amountIn: amount,
      amountOut: (outAmount + protocolFeeAmount) / this.USDX_POW,
      minAmountOut: minOutAmount / this.USDX_POW,
      networkFees: 0,  
      protocolFees: protocolFeeAmount / this.USDX_POW
    };

    return exchange;    
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
    
    try {

      const poolInfo = cloneDeep(this.currentPool);

      if (!poolInfo) {
        throw new Error("Mercurial pool not found.");
      }

      let tx = new Transaction();
      let sig: Signer[] = [];

      const fromMint = from === USDC_MINT.toBase58() ? USDC_MINT : USDT_MINT;
      const toMint = to === USDC_MINT.toBase58() ? USDC_MINT : USDT_MINT;

      const fromAccount = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        fromMint,
        owner,
        true
      );

      const fromAccountInfo = await this.connection.getAccountInfo(fromAccount);

      if (!fromAccountInfo) {
        tx.add(
          Token.createAssociatedTokenAccountInstruction(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            fromMint,
            fromAccount,
            owner,
            owner
          )
        );
      }

      const toAccount = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        toMint,
        owner,
        true
      );

      const toAccountInfo = await this.connection.getAccountInfo(toAccount);

      if (!toAccountInfo) {
        tx.add(
          Token.createAssociatedTokenAccountInstruction(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            toMint,
            toAccount,
            owner,
            owner
          )
        );
      }

      const amountInBn = new BN(parseFloat(amountIn.toFixed(6)) * this.USDX_POW);
      const minimumAmountOut = amountOut * (100 - slippage) / 100;
      const minimumAmountOutBn = new BN(parseFloat(minimumAmountOut.toFixed(6)) * this.USDX_POW);
      const ephemeralKeypair = Keypair.generate();
      
      tx.add(
        Token.createApproveInstruction(
          TOKEN_PROGRAM_ID,
          fromAccount,
          ephemeralKeypair.publicKey,
          owner,
          [],
          amountInBn.toNumber()
        ),
        SwapInstruction.exchange(
          poolInfo.stable.poolAccount,
          poolInfo.stable.authority,
          ephemeralKeypair.publicKey,
          poolInfo.stable.tokenAccounts,
          fromAccount,
          toAccount,
          amountInBn.toNumber(),
          minimumAmountOutBn.toNumber()
        ),
        Token.createRevokeInstruction(
          TOKEN_PROGRAM_ID, 
          fromAccount, 
          owner, 
          []
        )
      );

      sig.push(ephemeralKeypair);
      const feeBnAmount = new BN(parseFloat(feeAmount.toFixed(6)) * this.USDX_POW);
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
          fromAccount,
          feeAccountToken,
          owner,
          [],
          feeBnAmount.toNumber()
        )
      );

      tx.feePayer = owner;
      const { blockhash } = await this.connection.getRecentBlockhash(this.connection.commitment);
      tx.recentBlockhash = blockhash;

      if (sig.length) {
        tx.partialSign(...sig);
      }

      return tx;

    } catch (_error) {
      throw _error;
    }

  };
}