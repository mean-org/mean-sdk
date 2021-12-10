/**
 * Solana
 */
 import {
  Commitment,
  Connection,
  ConnectionConfig,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  Signer,
  TransactionInstruction,
  Finality

} from "@solana/web3.js";

/**
 * MSP
 */
import * as Layout from "./layout";
import { u64Number } from "./u64n";
import { StreamInfo, ListStreamParams, StreamTermsInfo, TreasuryInfo } from "./types";
import { Errors } from "./errors";
import {
  AccountLayout,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  TOKEN_PROGRAM_ID

} from "@solana/spl-token";

import { Constants } from "./constants";
import { BN } from "bn.js";
import { addFundsInstruction, answerUpdateInstruction, closeStreamInstruction, closeTreasuryInstruction, createStreamInstruction, createTreasuryInstruction, pauseStreamInstruction, proposeUpdateInstruction, resumeStreamInstruction, withdrawInstruction } from "./instructions";
import { getMintAccount, getStream, getStreamCached, getStreamTerms, getTreasury, listStreamActivity, listStreams, listStreamsCached } from "./utils";
import { AllocationType, listTreasuries, recoverFundsInstruction, TreasuryType, upgradeTreasuryInstruction } from ".";

/**
 * API class with functions to interact with the Money Streaming Program using Solana Web3 JS API
 */
export class MoneyStreaming {

  private connection: Connection;
  private programId: PublicKey;
  private commitment: Commitment | ConnectionConfig | undefined;
  private mspOps: PublicKey = new PublicKey(
    "3TD6SWY9M1mLY2kZWJNavPLhwXvcRsWdnZLRaMzERJBw"
  );

  /**
   * Create a Streaming API object
   *
   * @param cluster The solana cluster endpoint used for the connecton
   */
  constructor(
    rpcUrl: string,
    programId: PublicKey | string,
    commitment: Commitment | string = "confirmed"

  ) {
    this.commitment = commitment as Commitment;
    this.connection = new Connection(rpcUrl, this.commitment);

    if (typeof programId === "string") {
      this.programId = new PublicKey(programId);
    } else {
      this.programId = programId;
    }
  }

  public async getStream(
    id: PublicKey,
    commitment?: Commitment | undefined,
    friendly: boolean = true

  ): Promise<any> {
    return await getStream(this.connection, id, commitment, friendly);
  }

  public async refreshStream(
    streamInfo: any,
    hardUpdate: boolean = false,
    friendly: boolean = true

  ): Promise<StreamInfo> {

    let copyStreamInfo = Object.assign({}, streamInfo);
    const currentTime = Date.parse(new Date().toUTCString()) / 1000;

    if (hardUpdate) {

      const streamId = typeof copyStreamInfo.id === 'string' 
        ? new PublicKey(copyStreamInfo.id) 
        : copyStreamInfo.id as PublicKey; 

        return await getStream(this.connection, streamId);
    }

    return getStreamCached(copyStreamInfo, currentTime, friendly);
  }

  public async getTreasury(
    id: PublicKey,
    commitment?: Commitment | undefined,
    friendly: boolean = true

  ): Promise<TreasuryInfo> {

    return await getTreasury(
      this.connection,
      id,
      commitment,
      friendly
    );
  }

  public async listStreams({
    
    treasurer,
    treasury,
    beneficiary,
    commitment = "confirmed",
    friendly = true

  }: ListStreamParams): Promise<StreamInfo[]> {
    
    return await listStreams(
      this.connection,
      this.programId,
      treasurer,
      treasury,
      beneficiary,
      commitment,
      friendly
    );
  }

  public async refreshStreams(
    streams: StreamInfo[],
    treasurer?: PublicKey | undefined,
    treasury?: PublicKey | undefined,
    beneficiary?: PublicKey | undefined,
    commitment?: Commitment | undefined,
    hardUpdate: boolean = false,
    friendly: boolean = true

  ): Promise<StreamInfo[]> {

    if (hardUpdate) {

      return await listStreams(
        this.connection, 
        this.programId, 
        treasurer, 
        treasury,
        beneficiary,
        commitment, 
        friendly
      );
    }

    return listStreamsCached(
      streams,
      friendly
    );
  }

  public async listStreamActivity(
    id: PublicKey,
    commitment?: Finality | undefined,
    friendly: boolean = true

  ): Promise<any[]> {

    return await listStreamActivity(
      this.connection,
      id,
      commitment,
      friendly
    );
  }

  public async listTreasuries(
    treasurer: PublicKey,
    commitment?: Commitment | undefined,
    friendly: boolean = true

  ): Promise<TreasuryInfo[]> {

    return listTreasuries(
      this.programId,
      this.connection,
      treasurer,
      commitment,
      friendly
    );
  }

  public async oneTimePayment(
    treasurer: PublicKey,
    beneficiary: PublicKey,
    associatedToken: PublicKey,
    amount: number,
    startUtc?: Date,
    streamName?: string

  ): Promise<Transaction> {

    let ixs: TransactionInstruction[] = [];
    let txSigners: Array<Signer> = new Array<Signer>();

    const now = new Date();
    const start = !startUtc ? now : startUtc;
    const treasurerToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      treasurer,
      true
    );

    const treasurerTokenAccountInfo = await this.connection.getAccountInfo(
      treasurerToken
    );

    if (!treasurerTokenAccountInfo) {
      throw Error(Errors.AccountNotFound);
    }

    if (start.getTime() <= now.getTime()) {
      // Just create the beneficiary token account and transfer since the payment is not scheduled
      const beneficiaryToken = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        associatedToken,
        beneficiary,
        true
      );

      const beneficiaryTokenAccountInfo = await this.connection.getAccountInfo(
        beneficiaryToken
      );

      if (!beneficiaryTokenAccountInfo) {
        ixs.push(
          Token.createAssociatedTokenAccountInstruction(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            associatedToken,
            beneficiaryToken,
            beneficiary,
            treasurer
          )
        );
      }

      const beneficiaryMint = await getMintAccount(
        this.connection,
        associatedToken
      );

      const amountBn = new BN(amount * 10 ** beneficiaryMint.decimals);

      ixs.push(
        Token.createTransferInstruction(
          TOKEN_PROGRAM_ID,
          treasurerToken,
          beneficiaryToken,
          treasurer,
          [],
          amountBn.toNumber()
        )
      );

    } else {

      // Create the treasury account since the OTP is schedule
      const slot = await this.connection.getSlot(this.commitment as Commitment);
      const slotBuffer = new u64Number(slot).toBuffer();
      const treasurySeeds = [treasurer.toBuffer(), slotBuffer];

      const treasury = (
        await PublicKey.findProgramAddress(treasurySeeds, this.programId)
      )[0];

      const treasuryMintSeeds = [
        treasurer.toBuffer(),
        treasury.toBuffer(),
        slotBuffer,
      ];

      const treasuryPoolMint = (
        await PublicKey.findProgramAddress(treasuryMintSeeds, this.programId)
      )[0];

      // Get the treasury pool treasurer token
      const treasurerTreasuryPoolToken = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        treasuryPoolMint,
        treasurer,
        true
      );

      // Create treasury
      ixs.push(
        await createTreasuryInstruction(
          this.programId,
          treasurer,
          treasury,
          treasuryPoolMint,
          this.mspOps,
          "",
          TreasuryType.Open,
          slot
        )
      );

      if (amount && amount > 0) {
        // Get the treasury token account
        const treasuryToken = await Token.getAssociatedTokenAddress(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          associatedToken,
          treasury,
          true
        );

        ixs.push(
          await addFundsInstruction(
            this.programId,
            treasurer,
            treasurerToken,
            treasurerTreasuryPoolToken,
            treasury,
            treasuryToken,
            associatedToken,
            treasuryPoolMint,
            undefined,
            this.mspOps,
            amount,
            AllocationType.All
          )
        );
      }

      // Create stream account since the OTP is scheduled
      const streamAccount = Keypair.generate();
      txSigners.push(streamAccount);

      // Create stream contract
      ixs.push(
        await createStreamInstruction(
          this.programId,
          treasurer,
          treasury as PublicKey,
          beneficiary,
          associatedToken,
          streamAccount.publicKey,
          this.mspOps,
          streamName || "",
          0,
          0,
          amount || 0,
          amount || 0,
          start.getTime(),
          0,
          0,
          100,
          0
        )
      );
    }

    let tx = new Transaction().add(...ixs);
    tx.feePayer = treasurer;
    let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment || 'confirmed');
    tx.recentBlockhash = hash.blockhash;

    if (txSigners.length) {
      tx.partialSign(...txSigners);
    }

    return tx;
  }

  public async createTreasury(
    treasurer: PublicKey,
    label: string,
    type: TreasuryType

  ): Promise<Transaction> {

    let ixs: TransactionInstruction[] = [];

    const slot = await this.connection.getSlot(this.commitment as Commitment || 'confirmed');
    const slotBuffer = new u64Number(slot).toBuffer();
    const treasurySeeds = [treasurer.toBuffer(), slotBuffer];

    // Treasury Pool PDA
    const treasury = (
      await PublicKey.findProgramAddress(treasurySeeds, this.programId)
    )[0];

    const treasuryPoolMintSeeds = [
      treasurer.toBuffer(),
      treasury.toBuffer(),
      slotBuffer
    ];

    // Treasury Pool Mint PDA
    const treasuryPoolMint = (
      await PublicKey.findProgramAddress(treasuryPoolMintSeeds, this.programId)
    )[0];

    ixs.push(
      await createTreasuryInstruction(
        this.programId,
        treasurer,
        treasury,
        treasuryPoolMint,
        this.mspOps,
        label,
        type,
        slot
      )
    );

    // Create treasury
    let tx = new Transaction().add(...ixs);
    tx.feePayer = treasurer;
    const { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || 'confirmed');
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async createStream(
    treasurer: PublicKey,
    treasury: PublicKey | undefined,
    beneficiary: PublicKey,
    associatedToken: PublicKey,
    rateAmount?: number,
    rateIntervalInSeconds?: number,
    startUtc?: Date,
    streamName?: string,
    allocation?: number,
    allocationReserved?: number,
    rateCliffInSeconds?: number,
    cliffVestAmount?: number,
    cliffVestPercent?: number,
    autoPauseInSeconds?: number

  ): Promise<Transaction> {

    let ixs: Array<TransactionInstruction> = new Array<TransactionInstruction>();
    let txSigners: Array<Signer> = new Array<Signer>(),
      treasuryToken: PublicKey = PublicKey.default,
      treasuryPoolMint: PublicKey = PublicKey.default,
      treasurerTreasuryPoolToken: PublicKey = PublicKey.default,
      treasuryType: TreasuryType = TreasuryType.Open;

    if (treasury) {

      const treasuryInfo: any = await getTreasury(
        this.connection,
        treasury
      );

      if (!treasuryInfo) {
        throw Error(Errors.AccountNotFound);
      }

      if (treasuryInfo.associatedTokenAddress !== associatedToken.toBase58()) {
        throw Error(Errors.TokensDoNotMatch);
      }

      treasuryPoolMint = new PublicKey(treasuryInfo.mintAddress);
      treasuryType = treasuryInfo.treasury_type === 0 ? TreasuryType.Open : TreasuryType.Lock;

    } else {

      const slot = await this.connection.getSlot(this.commitment as Commitment);
      const blockHeightBuffer = new u64Number(slot).toBuffer();
      const treasurySeeds = [treasurer.toBuffer(), blockHeightBuffer];

      treasury = (
        await PublicKey.findProgramAddress(treasurySeeds, this.programId)
      )[0];

      const treasuryMintSeeds = [
        treasurer.toBuffer(),
        treasury.toBuffer(),
        blockHeightBuffer,
      ];

      treasuryPoolMint = (
        await PublicKey.findProgramAddress(treasuryMintSeeds, this.programId)
      )[0];

      // Get the treasury pool treasurer token
      treasurerTreasuryPoolToken = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        treasuryPoolMint,
        treasurer,
        true
      );

      // Create treasury
      ixs.push(
        await createTreasuryInstruction(
          this.programId,
          treasurer,
          treasury,
          treasuryPoolMint,
          this.mspOps,
          "",
          treasuryType,
          slot
        )
      );

      if (allocation && allocation > 0) {
        // Get the treasurer token account
        const treasurerToken = await Token.getAssociatedTokenAddress(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          associatedToken,
          treasurer,
          true
        );
  
        // Get the treasurer treasury token account
        treasurerTreasuryPoolToken = await Token.getAssociatedTokenAddress(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          treasuryPoolMint,
          treasurer,
          true
        );
  
        // Get the treasury token account
        treasuryToken = await Token.getAssociatedTokenAddress(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          associatedToken,
          treasury,
          true
        );
  
        ixs.push(
          await addFundsInstruction(
            this.programId,
            treasurer,
            treasurerToken,
            treasurerTreasuryPoolToken,
            treasury,
            treasuryToken,
            associatedToken,
            treasuryPoolMint,
            undefined,
            this.mspOps,
            allocation,
            AllocationType.All
          )
        );
      }  
    }

    const streamAccount = Keypair.generate();
    txSigners.push(streamAccount);
    const startDate = startUtc ? startUtc : new Date();

    // Create stream contract
    ixs.push(
      await createStreamInstruction(
        this.programId,
        treasurer,
        treasury,
        beneficiary,
        associatedToken,
        streamAccount.publicKey,
        this.mspOps,
        streamName || "",
        rateAmount || 0.0,
        rateIntervalInSeconds || 0,
        allocation ? allocation : 0,
        allocationReserved ? allocationReserved : 0,
        startDate.getTime(),
        rateCliffInSeconds || 0,
        cliffVestAmount || 0,
        cliffVestPercent || 100,
        autoPauseInSeconds || (rateAmount || 0) * (rateIntervalInSeconds || 0)
      )
    );

    let tx = new Transaction().add(...ixs);
    tx.feePayer = treasurer;
    let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment || 'confirmed');
    tx.recentBlockhash = hash.blockhash;

    if (txSigners.length) {
      tx.partialSign(...txSigners);
    }

    return tx;
  }

  public async addFunds(
    contributor: PublicKey,
    treasury: PublicKey,
    stream: PublicKey | undefined,
    associatedToken: PublicKey,
    amount: number,
    allocationType: AllocationType

  ): Promise<Transaction> {

    let ixs: TransactionInstruction[] = [];

    const treasuryInfo: any = await getTreasury(
      this.connection,
      treasury
    );

    if (!treasuryInfo) {
      throw Error(`${Errors.AccountNotFound}: Treasury account not found`);
    }

    const treasuryPoolMint = new PublicKey(treasuryInfo.mintAddress as string);
    const contributorToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      contributor,
      true
    ); 

    const treasuryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      treasury,
      true
    );

    const contributorTreasuryPoolToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      treasuryPoolMint,
      contributor,
      true
    );

    ixs.push(
      await addFundsInstruction(
        this.programId,
        contributor,
        contributorToken,
        contributorTreasuryPoolToken,
        treasury,
        treasuryToken,
        associatedToken,
        treasuryPoolMint,
        stream,
        this.mspOps,
        amount,
        allocationType
      )
    );

    let tx = new Transaction().add(...ixs);
    tx.feePayer = contributor;
    let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment || "confirmed");    
    tx.recentBlockhash = hash.blockhash;

    return tx;
  }

  public async recoverFunds(
    contributor: PublicKey,
    treasury: PublicKey,
    amount: number

  ): Promise<Transaction> {

    let ixs: TransactionInstruction[] = [];

    const treasuryInfo: any = getTreasury(
      this.connection, 
      treasury
    );

    if (!treasuryInfo) {
      throw Error(`${Errors.AccountNotFound}: Treasury account not found`);
    }

    const associatedToken = new PublicKey(treasuryInfo.associatedTokenAddress as string);
    const treasuryPoolMint = new PublicKey(treasuryInfo.mintAddress as string);
    const contributorToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      contributor,
      true
    ); 

    const treasuryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      treasury,
      true
    );

    // Get the money streaming program operations token account or create a new one
    const contributorTreasuryPoolToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      treasuryPoolMint,
      contributor,
      true
    );

    //
    const mspOpsToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      this.mspOps,
      true
    );

    ixs.push(
      await recoverFundsInstruction(
        this.programId,
        contributor,
        contributorToken,
        contributorTreasuryPoolToken,
        associatedToken,
        treasury,
        treasuryToken,
        treasuryPoolMint,
        this.mspOps,
        mspOpsToken,
        amount
      )
    );

    let tx = new Transaction().add(...ixs);
    tx.feePayer = contributor;
    let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment || "confirmed");    
    tx.recentBlockhash = hash.blockhash;

    return tx;
  }

  public async withdraw(
    beneficiary: PublicKey,
    stream: PublicKey,
    amount: number

  ): Promise<Transaction> {

    let ixs: TransactionInstruction[] = [];
    let streamInfo: any = await getStream(
      this.connection,
      stream,
      this.commitment
    );

    if (!streamInfo || !beneficiary.equals(new PublicKey(streamInfo.beneficiaryAddress as string))) {
      throw Error(Errors.AccountNotFound);
    }

    // Check for the beneficiary associated token account
    const associatedToken = new PublicKey(streamInfo.associatedToken as string);
    const beneficiaryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      beneficiary,
      true
    );

    const beneficiaryTokenAccountInfo = await this.connection.getAccountInfo(beneficiaryToken);

    if (!beneficiaryTokenAccountInfo) {
      ixs.push(
        Token.createAssociatedTokenAccountInstruction(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          associatedToken,
          beneficiaryToken,
          beneficiary,
          beneficiary
        )
      );
    }

    const treasury = new PublicKey(streamInfo.treasuryAddress as PublicKey);
    const treasuryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      treasury,
      true
    );

    const mspOpsToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      this.mspOps,
      true
    );

    ixs.push(
      await withdrawInstruction(
        this.programId,
        beneficiary,
        beneficiaryToken,
        associatedToken,
        treasury,
        treasuryToken,
        stream,
        this.mspOps,
        mspOpsToken,
        amount
      )
    );

    let tx = new Transaction().add(...ixs);
    tx.feePayer = beneficiary;

    let hash = await this.connection.getRecentBlockhash(
      this.commitment as Commitment
    );

    tx.recentBlockhash = hash.blockhash;

    return tx;
  }

  public async pauseStream(
    initializer: PublicKey,
    stream: PublicKey

  ): Promise<Transaction> {

    const streamInfo = await getStream(
      this.connection,
      stream
    );

    if (!streamInfo) {
      throw Error("Error: Stream account not found");
    }

    const treasury = new PublicKey(streamInfo.treasuryAddress as string);
    const associatedToken = new PublicKey(streamInfo.associatedToken as string);

    let tx = new Transaction().add(
      await pauseStreamInstruction(
        this.programId,
        initializer,
        treasury,
        associatedToken,
        stream,
        this.mspOps
      )
    );

    tx.feePayer = initializer;
    let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
    tx.recentBlockhash = hash.blockhash;

    return tx;
  }

  public async resumeStream(
    initializer: PublicKey,
    stream: PublicKey

  ): Promise<Transaction> {

    const streamInfo = await getStream(
      this.connection,
      stream
    );

    if (!streamInfo) {
      throw Error("Error: Stream account not found");
    }

    const treasury = new PublicKey(streamInfo.treasuryAddress as string);
    const associatedToken = new PublicKey(streamInfo.associatedToken as string);

    let tx = new Transaction().add(
      await resumeStreamInstruction(
        this.programId,
        initializer,
        treasury,
        associatedToken,
        stream,
        this.mspOps
      )
    );

    tx.feePayer = initializer;

    let hash = await this.connection.getRecentBlockhash(
      this.commitment as Commitment
    );
    
    tx.recentBlockhash = hash.blockhash;

    return tx;
  }

  public async closeStream(
    initializer: PublicKey,
    stream: PublicKey,
    autoCloseTreasury: boolean = false

  ): Promise<Transaction> {

    let tx = new Transaction();
    let streamInfo = await getStream(
      this.connection,
      stream,
      this.commitment
    );

    if (!streamInfo) {
      throw Error(`${Errors.AccountNotFound}: Stream address not found`);
    }

    const streamAddress = new PublicKey(stream);
    const beneficiary = new PublicKey(streamInfo.beneficiaryAddress as string);
    const associatedToken = new PublicKey(streamInfo.associatedToken as string);

    const beneficiaryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      beneficiary,
      true
    );

    const treasurer = new PublicKey(streamInfo.treasurerAddress as string);
    const treasurerToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      treasurer,
      true
    );

    const treasury = new PublicKey(streamInfo.treasuryAddress as string);
    const treasuryInfo = await getTreasury(
      this.connection,
      treasury
    );

    if (!treasuryInfo) {
      throw Error(Errors.AccountNotFound);
    }

    const treasuryPoolMint = new PublicKey(treasuryInfo.mintAddress as string);
    const trasurerTreasuryPoolToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      treasuryPoolMint,
      treasurer,
      true
    );

    const treasuryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      treasury,
      true
    );

    // Get the money streaming program operations token account or create a new one
    const mspOpsToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      this.mspOps,
      true
    );

    tx.add(
      // Close stream
      await closeStreamInstruction(
        this.programId,
        initializer,
        treasurer,
        treasurerToken,
        trasurerTreasuryPoolToken,
        beneficiary,
        beneficiaryToken,
        associatedToken,
        treasury,
        treasuryToken,
        treasuryPoolMint,
        streamAddress,
        this.mspOps,
        mspOpsToken,
        autoCloseTreasury
      )
    );

    tx.feePayer = initializer;
    let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment || 'confirmed');
    tx.recentBlockhash = hash.blockhash;

    return tx;
  }

  public async closeTreasury(
    treasurer: PublicKey,
    treasury: PublicKey

  ): Promise<Transaction> {

    let tx = new Transaction();
    let treasuryInfo = await getTreasury(
      this.connection,
      treasury
    );

    if (!treasuryInfo) {
      throw Error(`${Errors.AccountNotFound}: Treasury address not found`);
    }

    let associatedToken: any;
    let treasuryToken: any;
    let treasurerToken: any;
    let mspOpsToken: any;
    let treasuryPoolMint = new PublicKey(treasuryInfo.mintAddress);
    
    if (treasuryInfo.associatedTokenAddress) {

      associatedToken = new PublicKey(treasuryInfo.associatedTokenAddress);
      treasuryToken = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        associatedToken,
        treasury,
        true
      );

    } else {

      const tokenAccountsResult = await this.connection.getTokenAccountsByOwner(
        treasury, { 
          programId: TOKEN_PROGRAM_ID 
        }
      );

      if (tokenAccountsResult.value && tokenAccountsResult.value.length) {
        const tokenAccount = AccountLayout.decode(tokenAccountsResult.value[0].account.data);
        associatedToken = new PublicKey(tokenAccount.mint);
        treasuryToken = await Token.getAssociatedTokenAddress(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          associatedToken,
          treasury,
          true
        );
      }
    }

    if (associatedToken) {

      treasurerToken = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        associatedToken,
        treasurer,
        true
      );

      // Get the money streaming program operations token account or create a new one
      mspOpsToken = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        associatedToken,
        this.mspOps,
        true
      );
    }

    const treasurerTreasuryPoolToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      treasuryPoolMint,
      treasurer,
      true
    );

    tx.add(
      // Close stream
      await closeTreasuryInstruction(
        this.programId,
        treasurer,
        treasurerToken ?? PublicKey.default,
        treasurerTreasuryPoolToken,
        associatedToken ?? PublicKey.default,
        treasury,
        treasuryToken ?? PublicKey.default,
        treasuryPoolMint,
        this.mspOps,
        mspOpsToken ?? PublicKey.default
      )
    );

    tx.feePayer = treasurer;
    let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment || 'confirmed');
    tx.recentBlockhash = hash.blockhash;

    return tx;
  }

  public async proposeUpdate(
    stream: PublicKey,
    proposedBy: PublicKey,
    streamName?: string,
    associatedToken?: PublicKey,
    rateAmount?: number,
    rateIntervalInSeconds?: number,
    rateCliffInSeconds?: number,
    cliffVestAmount?: number,
    cliffVestPercent?: number,
    autoPauseInSeconds?: number

  ): Promise<Transaction> {

    let ixs: TransactionInstruction[] = [];
    // Create stream terms account
    const streamTermsAccount = Keypair.generate();
    const streamTermsMinimumBalance = await this.connection.getMinimumBalanceForRentExemption(
      Layout.streamTermsLayout.span
    );

    ixs.push(
      SystemProgram.createAccount({
        fromPubkey: proposedBy,
        newAccountPubkey: streamTermsAccount.publicKey,
        lamports: streamTermsMinimumBalance,
        space: Layout.streamTermsLayout.span,
        programId: this.programId,
      })
    );

    let streamInfo: any = await getStream(
      this.connection,
      stream,
      this.commitment
    );

    let initializer: PublicKey = proposedBy,
      counterparty: string | PublicKey | undefined;

    if (initializer.toBase58() === streamInfo.treasurerAddress) {
      initializer = new PublicKey(streamInfo.treasurerAddress as string);
      counterparty = new PublicKey(streamInfo.beneficiaryAddress as string);
    } else if (initializer.toBase58() === streamInfo.beneficiaryAddress) {
      initializer = new PublicKey(streamInfo.beneficiaryAddress as string);
      counterparty = new PublicKey(streamInfo.treasurerAddress as string);
    } else {
      throw Error(Errors.InvalidInitializer);
    }

    ixs.push(
      await proposeUpdateInstruction(
        this.programId,
        streamInfo,
        streamTermsAccount.publicKey,
        initializer,
        counterparty,
        this.mspOps,
        streamName,
        associatedToken,
        rateAmount,
        rateIntervalInSeconds,
        rateCliffInSeconds,
        cliffVestAmount,
        cliffVestPercent,
        autoPauseInSeconds || (rateAmount || 0) * (rateIntervalInSeconds || 0)
      )
    );

    let tx = new Transaction().add(...ixs);
    tx.feePayer = proposedBy;

    let hash = await this.connection.getRecentBlockhash(
      this.commitment as Commitment
    );

    tx.recentBlockhash = hash.blockhash;
    tx.partialSign(streamTermsAccount);

    return tx;
  }

  public async answerUpdate(
    stream: PublicKey,
    answeredBy: PublicKey,
    approve: true

  ): Promise<Transaction> {

    const streamInfo = await getStream(
      this.connection,
      stream,
      this.commitment
    );

    const streamTerms = await getStreamTerms(
      this.programId,
      this.connection,
      new PublicKey(streamInfo.id as string)
    );

    let initializer: PublicKey = answeredBy,
      counterparty: string | PublicKey | undefined;

    if (initializer.toBase58() === streamInfo.treasurerAddress) {
      initializer = new PublicKey(streamInfo.treasurerAddress as string);
      counterparty = new PublicKey(streamInfo.beneficiaryAddress as string);
    } else if (initializer.toBase58() === streamInfo.beneficiaryAddress) {
      initializer = new PublicKey(streamInfo.beneficiaryAddress as string);
      counterparty = new PublicKey(streamInfo.treasurerAddress as string);
    } else {
      throw new Error(Errors.InvalidInitializer);
    }

    let tx = new Transaction().add(
      await answerUpdateInstruction(
        this.programId,
        streamTerms as StreamTermsInfo,
        initializer,
        counterparty,
        this.mspOps,
        approve
      )
    );

    tx.feePayer = answeredBy;

    let hash = await this.connection.getRecentBlockhash(
      this.commitment as Commitment
    );

    tx.recentBlockhash = hash.blockhash;

    return tx;
  }

}
