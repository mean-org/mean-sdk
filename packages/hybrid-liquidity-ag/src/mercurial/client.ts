import { AccountMeta, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Signer, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { ExchangeInfo, LPClient, MERCURIAL } from "../types";
import { AMM_POOLS, PROTOCOLS } from "../data";
import { MercurialPoolInfo } from "./types";
import { AccountLayout, ASSOCIATED_TOKEN_PROGRAM_ID, MintLayout, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { findLogAndParse, GetDyUnderlying, SIMULATION_USER, StableSwapNPool } from "@mercurial-finance/stable-swap-n-pool";
import { USDC_MINT, USDT_MINT } from "../types";
import { SwapInstruction } from "@mercurial-finance/stable-swap-n-pool/dist/cjs/instructions";
import { getAmmPools } from "../utils";
import { BN } from "bn.js";
import { AmmPoolInfo } from "..";

export class MercurialClient implements LPClient {

  private connection: Connection;
  private poolAddress: string;
  private currentPool: MercurialPoolInfo | undefined;
  private USDX_POW: number = 10 ** 6;
  private exchangeInfo: ExchangeInfo | undefined;
  private exchangeAccounts: AccountMeta[];

  constructor(connection: Connection, poolAddress: string) {
    this.connection = connection;
    this.poolAddress = poolAddress;
    this.exchangeAccounts = [];
  }

  public get protocol() : PublicKey {
    return MERCURIAL; 
  }

  public get accounts(): AccountMeta[] {
    return this.exchangeAccounts;
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

  ) => {

    if (!this.poolAddress) {
      throw Error("Unknown pool");
    }

    await this.updatePoolInfo();

    if (!this.currentPool) {
      throw new Error("Mercurial pool not found.");
    }
      
    const fromMint = new PublicKey(from);
    const toMint = new PublicKey(to);
    const inAmount = amount === 0 ? 1 : amount;
    const inAmountBn = inAmount * this.USDX_POW;
    const outAmount = await this.getOutAmount(fromMint, toMint, inAmountBn);
    const protocolFeeAmount = (outAmount * 0.0004) / (1 - 0.0004);
    const outPrice = inAmountBn / (outAmount + protocolFeeAmount);
    const minOutAmount = (outAmount + protocolFeeAmount) * (100 - slippage) / 100;
    const protocol = PROTOCOLS.filter(p => p.address === MERCURIAL.toBase58())[0];
    
    this.exchangeInfo = {
      fromAmm: protocol.name,
      outPrice: outPrice,
      priceImpact: 0,
      amountIn: amount,
      amountOut: (outAmount + protocolFeeAmount) / this.USDX_POW,
      minAmountOut: minOutAmount / this.USDX_POW,
      networkFees: 0.00005 + 2 * await Token.getMinBalanceRentForExemptAccount(this.connection) / LAMPORTS_PER_SOL,  
      protocolFees: protocolFeeAmount / this.USDX_POW

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
    
    try {

      if (!this.currentPool) {
        throw Error("Mercurial pool not found");
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
          this.currentPool.stable.poolAccount,
          this.currentPool.stable.authority,
          ephemeralKeypair.publicKey,
          this.currentPool.stable.tokenAccounts,
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

  private updatePoolInfo = async () => {

    try {

      if (!this.poolAddress) {
        throw new Error("Unknown pool");
      }

      const poolInfo = AMM_POOLS.filter(info => info.address === this.poolAddress)[0];

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

    } catch (_error) {
      throw _error;
    }
  }

  private updateExchangeAccounts = async (from: string, to: string): Promise<void> => {

    try {
      //TODO: Implement
      this.exchangeAccounts = [] as AccountMeta[];
    } catch (_error) {
      throw _error;
    }
  }

  private async getOutAmount(
    sourceTokenMint: PublicKey, 
    destinationTokenMint: PublicKey, 
    inAmount: number

  ): Promise<number> {
    
    const kp1 = Keypair.generate();
    const kp2 = Keypair.generate();
    const balanceNeeded = await Token.getMinBalanceRentForExemptAccount(this.connection)

    // We use new fresh token accounts so we don't need the user to have any to simulate
    const instructions: TransactionInstruction[] = [
      SystemProgram.createAccount({
        fromPubkey: SIMULATION_USER,
        newAccountPubkey: kp1.publicKey,
        lamports: balanceNeeded,
        space: AccountLayout.span,
        programId: TOKEN_PROGRAM_ID
      }),
      Token.createInitAccountInstruction(
        TOKEN_PROGRAM_ID, 
        sourceTokenMint, 
        kp1.publicKey, 
        SIMULATION_USER
      ),
      SystemProgram.createAccount({
        fromPubkey: SIMULATION_USER,
        newAccountPubkey: kp2.publicKey,
        lamports: balanceNeeded,
        space: AccountLayout.span,
        programId: TOKEN_PROGRAM_ID
      }),
      Token.createInitAccountInstruction(
        TOKEN_PROGRAM_ID, 
        destinationTokenMint, 
        kp2.publicKey, 
        SIMULATION_USER
      ),
      SwapInstruction.exchange(
        this.currentPool?.stable.poolAccount as PublicKey,
        this.currentPool?.stable.authority as PublicKey,
        SIMULATION_USER,
        this.currentPool?.stable.tokenAccounts as PublicKey[],
        kp1.publicKey,
        kp2.publicKey,
        inAmount,
        0
      )
    ]

    const tx = new Transaction().add(...instructions);
    tx.feePayer = SIMULATION_USER;
    const { blockhash } = await this.connection.getRecentBlockhash('recent');
    tx.recentBlockhash = blockhash;
    tx.partialSign(...[kp1, kp2]);
    const { value } = await this.connection.simulateTransaction(tx.compileMessage());

    return findLogAndParse<GetDyUnderlying>(value?.logs, 'GetDyUnderlying').dy
  }
}