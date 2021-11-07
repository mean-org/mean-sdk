import { 
  AccountMeta,
  Connection, 
  Keypair, 
  LAMPORTS_PER_SOL, 
  PublicKey, 
  Signer, 
  SystemProgram, 
  Transaction

} from "@solana/web3.js";

import { getOrca, Orca, OrcaPoolConfig, OrcaPoolToken, ORCA_TOKEN_SWAP_ID, U64Utils } from "@orca-so/sdk";
import { LPClient, ExchangeInfo, ORCA } from "../types";
import { AccountLayout, ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AMM_POOLS, PROTOCOLS } from "../data";
import { cloneDeep } from "lodash";
import Decimal from "decimal.js";
import { NATIVE_SOL_MINT, WRAPPED_SOL_MINT } from "../types";
import { TokenSwap } from "@solana/spl-token-swap";
import BN from "bn.js";
import { getAmmPools } from "../utils";
import { CDNTokenListResolutionStrategy } from "@solana/spl-token-registry";

export class OrcaClient implements LPClient {

  private connection: Connection;
  private orcaSwap: Orca;
  private currentPool: any;
  private exchangeInfo: ExchangeInfo | undefined;
  private exchangeAccounts: AccountMeta[];

  constructor(connection: Connection) {
    this.connection = connection;
    this.orcaSwap = getOrca(this.connection);
    this.exchangeAccounts = [];
  }

  public get protocol() : PublicKey {
    return ORCA; 
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

  ): Promise<void> => {

    const ammPool = getAmmPools(
      from, 
      to, 
      ORCA.toBase58()
    );
    
    if (!ammPool || ammPool.length === 0) {
      throw new Error("Amm pool info not found.");
    }

    await this.updatePoolInfo(ammPool[0].address);

    if (!this.currentPool) {
      throw new Error("Orca pool not found.");
    }
 
    let tokenA = this.currentPool.getTokenA() as OrcaPoolToken;
    let tokenB = this.currentPool.getTokenB() as OrcaPoolToken;
    let tradeToken = cloneDeep(tokenA);

    if (from === tokenB.mint.toBase58() || to === tokenA.mint.toBase58()) {
      tradeToken = cloneDeep(tokenB);
    }

    const decimalTradeAmount = new Decimal(1);
    const decimalSlippage = new Decimal(slippage / 10);
    const quote = await this.currentPool.getQuote(tradeToken, decimalTradeAmount, decimalSlippage);
    const protocol = PROTOCOLS.filter(p => p.address === ORCA.toBase58())[0];
    const recentBlockhash = await this.connection.getRecentBlockhash("recent");
    const lamportsPerSignatureFee = recentBlockhash.feeCalculator.lamportsPerSignature;
    const maxLamportsPerSignatureFee = 3 * lamportsPerSignatureFee;
    const allTokenAccountsBalance = 2 * await this.connection.getMinimumBalanceForRentExemption(AccountLayout.span);
    const networkFees = (quote.getNetworkFees().toNumber() + maxLamportsPerSignatureFee + allTokenAccountsBalance);

    this.exchangeInfo = {
      fromAmm: protocol.name,
      outPrice: quote.getRate().toNumber(),
      priceImpact: quote.getPriceImpact().toNumber(),
      amountIn: amount,
      amountOut: quote.getExpectedOutputAmount().toNumber() * amount,
      minAmountOut: quote.getMinOutputAmount().toNumber() * amount,
      networkFees: amount === 0 ? 0 : networkFees / LAMPORTS_PER_SOL,
      protocolFees: amount === 0 ? 0 : quote.getLPFees().toNumber() * amount
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

    if (!this.currentPool) {
      throw Error("Orca pool not found");
    }

    const fromMint = from === NATIVE_SOL_MINT.toBase58() ? WRAPPED_SOL_MINT : new PublicKey(from);
    const toMint = to === NATIVE_SOL_MINT.toBase58() ? WRAPPED_SOL_MINT : new PublicKey(to);

    let inputToken = this.currentPool.getTokenA() as OrcaPoolToken;
    let outputToken = this.currentPool.getTokenB() as OrcaPoolToken;
    let tradeToken = cloneDeep(inputToken);

    if (fromMint.equals(outputToken.mint)) {
      tradeToken = cloneDeep(outputToken);
      outputToken = cloneDeep(inputToken);
    }
    
    let tx = new Transaction();
    let sig: Signer[] = [];
    let fromWrapAccount: Keypair | undefined = undefined;

    if (from === NATIVE_SOL_MINT.toBase58()) {

      fromWrapAccount = Keypair.generate();
      const minimumWrappedAccountBalance = await Token.getMinBalanceRentForExemptAccount(this.connection);

      tx.add(
        SystemProgram.createAccount({
          fromPubkey: owner,
          newAccountPubkey: fromWrapAccount.publicKey,
          lamports: minimumWrappedAccountBalance + amountIn * LAMPORTS_PER_SOL,
          space: AccountLayout.span,
          programId: TOKEN_PROGRAM_ID,
        }),
        Token.createInitAccountInstruction(
          TOKEN_PROGRAM_ID,
          WRAPPED_SOL_MINT,
          fromWrapAccount.publicKey,
          owner
        )
      );

      sig.push(fromWrapAccount);
    }

    const fromTokenAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      fromMint,
      owner,
      true
    );

    let toWrapAccount: Keypair | undefined;

    if (to === NATIVE_SOL_MINT.toBase58()) {

      const minimumWrappedAccountBalance = await Token.getMinBalanceRentForExemptAccount(this.connection);
      toWrapAccount = Keypair.generate();

      tx.add(
        SystemProgram.createAccount({
          fromPubkey: owner,
          newAccountPubkey: toWrapAccount.publicKey,
          lamports: minimumWrappedAccountBalance,
          space: AccountLayout.span,
          programId: TOKEN_PROGRAM_ID,
        }),
        Token.createInitAccountInstruction(
          TOKEN_PROGRAM_ID,
          WRAPPED_SOL_MINT,
          toWrapAccount.publicKey,
          owner
        )
      );

      sig.push(toWrapAccount);
    }

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
      )
    }

    const minimumOutAmount = amountOut * (100 - slippage) / 100;
    const userTransferAuthority = Keypair.generate();

    tx.add(
      Token.createApproveInstruction(
        TOKEN_PROGRAM_ID,
        fromWrapAccount !== undefined ? fromWrapAccount.publicKey : fromTokenAccount,
        userTransferAuthority.publicKey,
        owner,
        [],
        amountIn * 10 ** tradeToken.scale
      )
    );

    sig.push(userTransferAuthority);

    const [authorityForPoolAddress] = await PublicKey.findProgramAddress(
      [this.currentPool.poolParams.address.toBuffer()],
      ORCA_TOKEN_SWAP_ID
    );
  
    tx.add(
      TokenSwap.swapInstruction(
        this.currentPool.poolParams.address,
        authorityForPoolAddress,
        userTransferAuthority.publicKey,
        fromWrapAccount !== undefined ? fromWrapAccount.publicKey : fromTokenAccount,
        tradeToken.addr,
        outputToken.addr,
        toWrapAccount !== undefined ? toWrapAccount.publicKey : toTokenAccount,
        this.currentPool.poolParams.poolTokenMint,
        this.currentPool.poolParams.feeAccount,
        null,
        ORCA_TOKEN_SWAP_ID,
        TOKEN_PROGRAM_ID,
        U64Utils.toTokenU64(new Decimal(amountIn), tradeToken, "amountIn"),
        U64Utils.toTokenU64(new Decimal(minimumOutAmount), outputToken, "minimumAmountOut")
      )
    );

    // Transfer fees
    const feeAccount = new PublicKey(feeAddress);
    const feeBnAmount = new BN(parseFloat(feeAmount.toFixed(tradeToken.scale)) * 10 ** tradeToken.scale);

    if (from === NATIVE_SOL_MINT.toBase58()) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: owner,
          toPubkey: feeAccount,
          lamports: feeBnAmount.toNumber()
        })
      );

    } else {

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
          fromWrapAccount !== undefined ? fromWrapAccount.publicKey : fromTokenAccount,
          feeAccountToken,
          owner,
          [],
          feeBnAmount.toNumber()
        )
      );
    }

    if (fromWrapAccount) {
      tx.add(
        Token.createCloseAccountInstruction(
          TOKEN_PROGRAM_ID,
          fromWrapAccount.publicKey,
          owner,
          owner,
          []
        )
      );
    }

    if (toWrapAccount) {
      tx.add(
        Token.createCloseAccountInstruction(
          TOKEN_PROGRAM_ID,
          toWrapAccount.publicKey,
          owner,
          owner,
          []
        )
      );
    }

    tx.feePayer = owner;
    const { blockhash } = await this.connection.getRecentBlockhash(this.connection.commitment);
    tx.recentBlockhash = blockhash;

    if (sig.length) {
      tx.partialSign(...sig);
    }

    return tx;
  };

  private updatePoolInfo = async (address: string) => {

    const poolInfo = AMM_POOLS.filter(info => info.address === address)[0];

    if (!poolInfo) {
      throw new Error("Orca pool not found.");
    }

    const poolConfig = Object.entries(OrcaPoolConfig).filter(c => c[1] === poolInfo.address)[0];
    this.currentPool = this.orcaSwap.getPool(poolConfig[1]);
  }

  private updateExchangeAccounts = async (from: string, to: string): Promise<void> => {

    try {

      if (!this.currentPool) {
        throw Error("Orca pool not found");
      }

      const [authorityForPoolAddress] = await PublicKey.findProgramAddress(
        [this.currentPool.poolParams.address.toBuffer()],
        ORCA_TOKEN_SWAP_ID
      );

      const fromAddress = from === NATIVE_SOL_MINT.toBase58() ? WRAPPED_SOL_MINT.toBase58() : from; 
      const toAddress = to === NATIVE_SOL_MINT.toBase58() ? WRAPPED_SOL_MINT.toBase58() : to;

      this.exchangeAccounts = [
        { pubkey: this.currentPool.poolParams.poolTokenMint, isSigner: false, isWritable: true },
        { pubkey: ORCA_TOKEN_SWAP_ID, isSigner: false, isWritable: false },   
        { pubkey: this.currentPool.poolParams.address, isSigner: false, isWritable: false },   
        { pubkey: authorityForPoolAddress, isSigner: false, isWritable: false },
        { pubkey: this.currentPool.poolParams.tokens[fromAddress].addr, isSigner: false, isWritable: true },
        { pubkey: this.currentPool.poolParams.tokens[toAddress].addr, isSigner: false, isWritable: true },
        { pubkey: this.currentPool.poolParams.feeAccount, isSigner: false, isWritable: true }

      ] as AccountMeta[];

    } catch (_error) {
      throw _error;
    }
  }
}
