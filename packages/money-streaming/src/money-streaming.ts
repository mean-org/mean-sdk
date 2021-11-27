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
import { StreamInfo, ListStreamParams, StreamTermsInfo, StreamV1Info, TreasuryInfo, TreasuryV1Info } from "./types";
import { Errors } from "./errors";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  TOKEN_PROGRAM_ID

} from "@solana/spl-token";

import { Constants } from "./constants";
import { BN } from "bn.js";
import { addFundsInstruction, answerUpdateInstruction, closeStreamInstruction, createStreamInstruction, createTreasuryInstruction, pauseStreamInstruction, proposeUpdateInstruction, resumeStreamInstruction, withdrawInstruction } from "./instructions";
import { getMintAccount, getStream, getStreamCached, getStreamTerms, getTreasury, listStreamActivity, listStreams, listStreamsCached } from "./utils";

/**
 * API class with functions to interact with the Money Streaming Program using Solana Web3 JS API
 */
export class MoneyStreaming {

  private connection: Connection;
  private programId: PublicKey;
  private commitment: Commitment | ConnectionConfig | undefined;
  private mspOps: PublicKey;

  private mspOpsAddress: PublicKey = new PublicKey(
    "CLazQV1BhSrxfgRHko4sC8GYBU3DoHcX4xxRZd12Kohr"
  );
  private mspOpsDevAddress: PublicKey = new PublicKey(
    "BgxJuujLZDR27SS41kYZhsHkXx6CP2ELaVyg1qBxWYNU"
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

    if (typeof programId === "string") {
      this.mspOps = programId === Constants.MSP_PROGRAM.toBase58()
        ? this.mspOpsAddress
        : this.mspOpsDevAddress;
    } else {
      this.mspOps = programId === Constants.MSP_PROGRAM
        ? this.mspOpsAddress
        : this.mspOpsDevAddress;
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

  ): Promise<StreamInfo | StreamV1Info> {

    let copyStreamV1Info = Object.assign({}, streamInfo);
    const currentTime = Date.parse(new Date().toUTCString()) / 1000;

    if (hardUpdate) {

      const streamId = typeof copyStreamV1Info.id === 'string' 
        ? new PublicKey(copyStreamV1Info.id) 
        : copyStreamV1Info.id as PublicKey; 

        return await getStream(this.connection, streamId);
    }

    return getStreamCached(copyStreamV1Info, currentTime, friendly);
  }

  public async getTreasury(
    id: PublicKey,
    commitment?: Commitment | undefined,
    friendly: boolean = true

  ): Promise<TreasuryInfo | TreasuryV1Info> {

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

  }: ListStreamParams): Promise<(StreamInfo | StreamV1Info)[]> {
    
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
    streams: (StreamInfo | StreamV1Info)[],
    treasurer?: PublicKey | undefined,
    treasury?: PublicKey | undefined,
    beneficiary?: PublicKey | undefined,
    commitment?: Commitment | undefined,
    hardUpdate: boolean = false,
    friendly: boolean = true

  ): Promise<(StreamInfo | StreamV1Info)[]> {

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
          treasurerTreasuryPoolToken,
          treasury,
          treasuryPoolMint,
          this.mspOps,
          "",
          slot
        )
      );

      // Create stream account since the OTP is scheduled
      const streamAccount = Keypair.generate();
      txSigners.push(streamAccount);
      const startUtc = new Date();
      startUtc.setMinutes(startUtc.getMinutes() + startUtc.getTimezoneOffset());

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
          startUtc.getTime(),
          0,
          0,
          100,
          0
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
            PublicKey.default,
            associatedToken,
            treasury,
            treasuryToken,
            PublicKey.default,
            streamAccount.publicKey,
            this.mspOps,
            amount,
            true
          )
        );
      }
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
    label: string

  ): Promise<Transaction> {

    let ixs: TransactionInstruction[] = [];

    const signers: Array<Signer> = [];
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

    // Get the treasury pool treasurer token
    const treasurerTreasuryPoolToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      treasuryPoolMint,
      treasurer,
      true
    );

    const streamAccount = Keypair.generate(); 
    signers.push(streamAccount);   

    ixs.push(
      await createTreasuryInstruction(
        this.programId,
        treasurer,
        treasurerTreasuryPoolToken,
        treasury,
        treasuryPoolMint,
        this.mspOps,
        label,
        slot
      )
    );

    // Create treasury
    let tx = new Transaction().add(...ixs);
    tx.feePayer = treasurer;
    const { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || 'confirmed');
    tx.recentBlockhash = blockhash;
    tx.partialSign(...signers);

    return tx;
  }

  public async createStream(
    treasurer: PublicKey,
    treasury: PublicKey | undefined,
    beneficiary: PublicKey,
    beneficiaryMint: PublicKey,
    rateAmount?: number,
    rateIntervalInSeconds?: number,
    startUtc?: Date,
    streamName?: string,
    fundingAmount?: number,
    rateCliffInSeconds?: number,
    cliffVestAmount?: number,
    cliffVestPercent?: number,
    autoPauseInSeconds?: number

  ): Promise<Transaction> {

    let ixs: Array<TransactionInstruction> = new Array<TransactionInstruction>();
    let txSigners: Array<Signer> = new Array<Signer>(),
      treasuryToken: PublicKey = PublicKey.default,
      treasuryPoolMint: PublicKey = PublicKey.default,
      treasurerTreasuryPoolToken: PublicKey = PublicKey.default;

    if (!treasury) {

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
          treasurerTreasuryPoolToken,
          treasury,
          treasuryPoolMint,
          this.mspOps,
          "",
          slot
        )
      );
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
        beneficiaryMint,
        streamAccount.publicKey,
        this.mspOps,
        streamName || "",
        rateAmount || 0.0,
        rateIntervalInSeconds || 0,
        fundingAmount || 0,
        fundingAmount || 0,
        startDate.getTime(),
        rateCliffInSeconds || 0,
        cliffVestAmount || 0,
        cliffVestPercent || 100,
        autoPauseInSeconds || (rateAmount || 0) * (rateIntervalInSeconds || 0)
      )
    );

    if (fundingAmount && fundingAmount > 0) {
      // Get the treasurer token account
      const treasurerToken = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        beneficiaryMint,
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
        beneficiaryMint,
        treasury,
        true
      );

      ixs.push(
        await addFundsInstruction(
          this.programId,
          treasurer,
          treasurerToken,
          treasurerTreasuryPoolToken,
          beneficiaryMint,
          treasury,
          treasuryToken,
          treasuryPoolMint,
          streamAccount.publicKey,
          this.mspOps,
          fundingAmount,
          true
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

  public async addFunds(
    contributor: PublicKey,
    treasury: PublicKey,
    stream: PublicKey,
    amount: number,
    resume = false

  ): Promise<Transaction> {

    let ixs: TransactionInstruction[] = [];

    const treasuryInfo: any = getTreasury(this.connection, treasury);

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
    const contributorTreasuryToken = await Token.getAssociatedTokenAddress(
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
        contributorTreasuryToken,
        associatedToken,
        treasury,
        treasuryToken,
        treasuryPoolMint,
        stream,
        this.mspOps,
        amount,
        resume
      )
    );

    let tx = new Transaction().add(...ixs);
    tx.feePayer = contributor;
    let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment || "confirmed");    
    tx.recentBlockhash = hash.blockhash;

    return tx;
  }

  public async withdraw(
    stream: PublicKey,
    beneficiary: PublicKey,
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
    const beneficiaryMintKey = new PublicKey(
      streamInfo.associatedToken as string
    );

    const beneficiaryTokenKey = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      beneficiaryMintKey,
      beneficiary,
      true
    );

    const beneficiaryTokenAccountInfo = await this.connection.getAccountInfo(
      beneficiaryTokenKey
    );

    if (!beneficiaryTokenAccountInfo) {
      ixs.push(
        Token.createAssociatedTokenAccountInstruction(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          beneficiaryMintKey,
          beneficiaryTokenKey,
          beneficiary,
          beneficiary
        )
      );
    }

    const treasuryKey = new PublicKey(streamInfo.treasuryAddress as PublicKey);
    const treasuryTokenKey = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      beneficiaryMintKey,
      treasuryKey,
      true
    );

    const mspOpsTokenKey = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      beneficiaryMintKey,
      this.mspOps,
      true
    );

    const version: number = streamInfo.totalDeposits ? 0 : 1;

    ixs.push(
      await withdrawInstruction(
        this.programId,
        beneficiary,
        beneficiaryTokenKey,
        beneficiaryMintKey,
        treasuryKey,
        treasuryTokenKey,
        stream,
        mspOpsTokenKey,
        amount,
        version
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

    let tx = new Transaction().add(
      await pauseStreamInstruction(
        this.programId,
        initializer,
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

  public async resumeStream(
    initializer: PublicKey,
    stream: PublicKey

  ): Promise<Transaction> {

    let tx = new Transaction().add(
      await resumeStreamInstruction(
        this.programId,
        initializer,
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
    stream: PublicKey,
    initializer: PublicKey

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

    const streamKey = new PublicKey(streamInfo.id as string);
    const beneficiaryKey = new PublicKey(
      streamInfo.beneficiaryAddress as string
    );

    const beneficiaryMint = new PublicKey(
      streamInfo.associatedToken as string
    );

    const beneficiaryTokenKey = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      beneficiaryMint,
      beneficiaryKey,
      true
    );

    const beneficiaryTokenAccountInfo = await this.connection.getAccountInfo(
      beneficiaryTokenKey
    );

    if (!beneficiaryTokenAccountInfo) {
      tx.add(
        Token.createAssociatedTokenAccountInstruction(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          beneficiaryMint,
          beneficiaryTokenKey,
          beneficiaryKey,
          initializer
        )
      );
    }

    const treasurerKey = new PublicKey(streamInfo.treasurerAddress as string);
    const treasurerTokenKey = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      beneficiaryMint,
      treasurerKey,
      true
    );

    const treasuryKey = new PublicKey(streamInfo.treasuryAddress as string);
    const treasuryTokenKey = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      beneficiaryMint,
      treasuryKey,
      true
    );

    // Get the money streaming program operations token account or create a new one
    const mspOpsTokenKey = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      beneficiaryMint,
      this.mspOps,
      true
    );

    tx.add(
      // Close stream
      await closeStreamInstruction(
        this.programId,
        initializer,
        treasurerTokenKey,
        beneficiaryTokenKey,
        beneficiaryMint,
        treasuryKey,
        treasuryTokenKey,
        streamKey,
        this.mspOps,
        mspOpsTokenKey
      )
    );

    tx.feePayer = initializer;

    let hash = await this.connection.getRecentBlockhash(
      this.commitment as Commitment
    );

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
