/**
 * Solana
 */
import { Commitment, Connection, ConnectionConfig, Keypair, PublicKey, Transaction, Signer, Finality, TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { BN, Idl, Program, Provider } from "@project-serum/anchor";

/**
 * MSP
 */
import { StreamInfo, ListStreamParams, TreasuryInfo, TreasuryType, AllocationType } from "./types";
import { getMintAccount, createProgram, getStream, getStreamCached, getTreasury, listStreamActivity, listStreams, listStreamsCached } from "./utils";
import { Constants } from "./constants";
import { ASSOCIATED_TOKEN_PROGRAM_ID, MintLayout, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { listTreasuries } from ".";
import { u64Number } from "./u64n";

/**
 * API class with functions to interact with the Money Streaming Program using Solana Web3 JS API
 */
export class MSP {

  private connection: Connection;
  private program: Program<Idl>;
  private commitment: Commitment | ConnectionConfig | undefined;

  /**
   * Create a Streaming API object
   *
   * @param cluster The solana cluster endpoint used for the connecton
   */
  constructor(
    rpcUrl: string,
    wallet: any,
    commitment: Commitment | string = "confirmed"

  ) {

    this.commitment = commitment as Commitment;
    this.connection = new Connection(rpcUrl, this.commitment);
    this.program = createProgram(this.connection, wallet);
  }

  public async getStream (
    id: PublicKey,
    commitment?: Commitment | undefined,
    friendly: boolean = true

  ): Promise<any> {

    let accountInfo = await this.program.account.Stream.getAccountInfo(id, commitment);

    if (!accountInfo) {
      throw Error("Stream doesn't exists");
    }

    return getStream(this.program, id, commitment, friendly);
  }

  public async refreshStream (
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

        return await getStream(this.program, streamId);
    }

    return getStreamCached(copyStreamInfo, currentTime, friendly);
  }

  public async listStreams ({
    treasurer,
    treasury,
    beneficiary,
    commitment = "confirmed",
    friendly = true

  }: ListStreamParams): Promise<StreamInfo[]> {

    return listStreams(
      this.program,
      treasurer,
      treasury,
      beneficiary,
      commitment,
      friendly
    );
  }

  public async refreshStreams (
    streamInfoList: StreamInfo[],
    treasurer?: PublicKey | undefined,
    treasury?: PublicKey | undefined,
    beneficiary?: PublicKey | undefined,
    commitment?: Commitment | undefined,
    hardUpdate: boolean = false,
    friendly: boolean = true

  ): Promise<StreamInfo[]> {

    if (hardUpdate) {
      return await listStreams(
        this.program, 
        treasurer, 
        treasury,
        beneficiary,
        commitment, 
        friendly
      );
    }

    return listStreamsCached(streamInfoList, friendly);
  }

  public async listStreamActivity (
    id: PublicKey,
    commitment?: Finality | undefined,
    friendly: boolean = true

  ): Promise<any[]> {

    let accountInfo = await this.program.account.Stream.getAccountInfo(id, commitment);

    if (!accountInfo) {
      throw Error("Stream doesn't exists");
    }

    return listStreamActivity(this.program, id, commitment, friendly);
  }

  public async getTreasury (
    id: PublicKey,
    commitment?: Commitment | undefined,
    friendly: boolean = true

  ): Promise<TreasuryInfo> {

    let accountInfo = await this.program.account.Treasury.getAccountInfo(id, commitment);

    if (!accountInfo) {
      throw Error("Treasury doesn't exists");
    }

    return getTreasury(this.program, id, commitment, friendly);
  }

  public async listTreasuries (
    treasurer: PublicKey,
    commitment?: Commitment | undefined,
    friendly: boolean = true

  ): Promise<TreasuryInfo[]> {

    return listTreasuries(
      this.program,
      treasurer,
      commitment,
      friendly
    )
  }

  public async oneTimePayment (
    treasurer: PublicKey,
    beneficiary: PublicKey,
    associatedToken: PublicKey,
    amount: number,
    startUtc?: Date,
    streamName?: string

  ): Promise<Transaction> {

    let ixs: TransactionInstruction[] = [];
    let txSigners: Signer[] = [];

    const now = new Date();
    const start = !startUtc ? now : startUtc;
    const treasurerToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      treasurer,
      true
    );

    const treasurerTokenInfo = await this.program.provider.connection.getAccountInfo(treasurerToken);

    if (!treasurerTokenInfo) {
      throw Error("Treasury doesn't exist");
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

      const beneficiaryMint = await getMintAccount(this.program.provider.connection, associatedToken);
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
      const [treasury, treasuryBump] = await PublicKey.findProgramAddress(treasurySeeds, this.program.programId);
      const treasuryMintSeeds = [treasurer.toBuffer(), treasury.toBuffer(), slotBuffer];
      const [treasuryMint, treasuryMintBump] = await PublicKey.findProgramAddress(treasuryMintSeeds, this.program.programId);
      // Get the treasury pool treasurer token
      const treasurerTreasuryToken = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        treasuryMint,
        treasurer,
        true
      );

      // Create treasury
      ixs.push(
        this.program.instruction.createTreasury(
          slot,
          treasuryBump,
          treasuryMintBump,
          streamName,
          TreasuryType.Open,
          true,
          {
            accounts: {
              treasurer: treasurer,
              treasury: treasury,
              treasuryMint: treasuryMint,
              feeTreasury: Constants.FEE_TREASURY,
              msp: this.program.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
              rent: SYSVAR_RENT_PUBKEY
            }
          }
        )
      );

      // Get the treasury token account
      const treasuryToken = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        associatedToken,
        treasury,
        true
      );

      ixs.push(
        this.program.instruction.addFunds(
          amount,
          0,
          PublicKey.default,
          {
            accounts: {
              contributor: treasurer,
              contributorToken: treasurerToken,
              contributorTreasuryToken: treasurerTreasuryToken,
              treasury: treasury,
              treasuryToken: treasuryToken,
              associatedToken: associatedToken,
              treasuryMint: treasuryMint,
              stream: PublicKey.default,
              feeTreasury: Constants.FEE_TREASURY,
              msp: this.program.programId,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
              rent: SYSVAR_RENT_PUBKEY
            }
          }
        )
      );

      // Create stream account since the OTP is scheduled
      const streamAccount = Keypair.generate();
      txSigners.push(streamAccount);
      // Create stream contract
      ixs.push(
        this.program.instruction.createStream(
          streamName,
          start.getTime(),
          0,
          0,
          amount,
          0,
          amount,
          100,
          {
            accounts: {
              initializer: treasurer,
              treasurer: treasurer,
              treasury: treasury,
              associatedToken: associatedToken,
              beneficiary: beneficiary,
              stream: streamAccount.publicKey,
              feeTreasury: Constants.FEE_TREASURY,
              msp: this.program.programId,
              systemProgram: SystemProgram.programId,
              rent: SYSVAR_RENT_PUBKEY
            },
            signers: [streamAccount]
          }
        )
      );
    }

    let tx = new Transaction().add(...ixs);
    tx.feePayer = treasurer;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || 'confirmed');
    tx.recentBlockhash = blockhash;
    
    if (txSigners.length) {
      tx.partialSign(...txSigners);
    }

    return tx;
  }

  public async createTreasury (
    treasurer: PublicKey,
    label: string,
    type: TreasuryType,
    autoClose: boolean = false

  ): Promise<Transaction> {

    const slot = await this.program.provider.connection.getSlot(this.commitment as Commitment || 'confirmed');
    const slotBuffer = new u64Number(slot).toBuffer();
    const treasurySeeds = [treasurer.toBuffer(), slotBuffer];
    // Treasury Pool PDA
    const [treasury, treasuryBump] = await PublicKey.findProgramAddress(treasurySeeds, this.program.programId);
    const treasuryPoolMintSeeds = [treasurer.toBuffer(), treasury.toBuffer(), slotBuffer];
    // Treasury Pool Mint PDA
    const [treasuryMint, treasuryMintBump] = await PublicKey.findProgramAddress(
      treasuryPoolMintSeeds, 
      this.program.programId
    );

    let tx = this.program.transaction.createTreasury(
      slot,
      treasuryBump,
      treasuryMintBump,
      label,
      type,
      autoClose,
      {
        accounts: {
          treasurer: treasurer,
          treasury: treasury,
          treasuryMint: treasuryMint,
          feeTreasury: Constants.FEE_TREASURY,
          msp: this.program.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY
        },
        signers: []
      }
    );

    tx.feePayer = treasurer;
    const { blockhash } = await this.program.provider.connection.getRecentBlockhash(this.commitment as Commitment || 'confirmed');
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async createStream (
    treasurer: PublicKey,
    treasury: PublicKey | undefined,
    beneficiary: PublicKey,
    associatedToken: PublicKey,
    streamName: string,
    allocationAssigned: number,
    allocationReserved?: number,
    rateAmount?: number,
    rateIntervalInSeconds?: number,
    startUtc?: Date,
    cliffVestAmount?: number,
    cliffVestPercent?: number

  ): Promise<Transaction> {

    let ixs: Array<TransactionInstruction> = new Array<TransactionInstruction>();
    let treasuryToken: PublicKey = PublicKey.default,
      treasuryMint: PublicKey = PublicKey.default,
      treasurerTreasuryToken: PublicKey = PublicKey.default,
      treasuryType: TreasuryType = TreasuryType.Open;

    if (treasury) {

      const treasuryInfo = await getTreasury(this.program, treasury, "recent");

      if (!treasuryInfo) {
        throw Error("Treasury doesn't exist");
      }

      if (treasuryInfo.associatedToken !== associatedToken.toBase58()) {
        throw Error("Incorrect associated token address");
      }

      treasuryMint = new PublicKey(treasuryInfo.mint as string);
      treasuryType = treasuryInfo.treasuryType;

    } else {

      const slot = await this.connection.getSlot(this.commitment as Commitment);
      const slotBuffer = new u64Number(slot).toBuffer();
      const treasurySeeds = [treasurer.toBuffer(), slotBuffer];
      const [treasuryAddress, treasuryBump] = await PublicKey.findProgramAddress(treasurySeeds, this.program.programId);
      treasury = treasuryAddress;
      const treasuryMintSeeds = [treasurer.toBuffer(), treasury.toBuffer(), slotBuffer];
      const [treasuryMintAddress, treasuryMintBump] = await PublicKey.findProgramAddress(
        treasuryMintSeeds, 
        this.program.programId
      );
      treasuryMint = treasuryMintAddress;
      // Get the treasury pool treasurer token
      treasurerTreasuryToken = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        treasuryMint,
        treasurer,
        true
      );

      // Create treasury
      ixs.push(
        this.program.instruction.createTreasury(
          slot,
          treasuryBump,
          treasuryMintBump,
          streamName,
          TreasuryType.Open,
          true,
          {
            accounts: {
              treasurer: treasurer,
              treasury: treasury,
              treasuryMint: treasuryMint,
              feeTreasury: Constants.FEE_TREASURY,
              msp: this.program.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
              rent: SYSVAR_RENT_PUBKEY
            }
          }
        )
      );

      if (allocationAssigned && allocationAssigned > 0) {
        // Get the treasurer token account
        const treasurerToken = await Token.getAssociatedTokenAddress(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          associatedToken,
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
  
        // Add Funds
        ixs.push(
          this.program.instruction.addFunds(
            allocationAssigned,
            allocationReserved === 0 ? 0 : 1,
            PublicKey.default,
            {
              accounts: {
                contributor: treasurer,
                contributorToken: treasurerToken,
                contributorTreasuryToken: treasurerTreasuryToken,
                treasury: treasury,
                treasuryToken: treasuryToken,
                associatedToken: associatedToken,
                treasuryMint: treasuryMint,
                stream: PublicKey.default,
                feeTreasury: Constants.FEE_TREASURY,
                msp: this.program.programId,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY
              }
            }
          )
        )
      }  
    }

    const streamAccount = Keypair.generate();
    const startDate = startUtc ? startUtc : new Date();

    // Create Stream
    let tx = this.program.transaction.createStream(
      streamName,
      startDate.getTime(),
      rateAmount,
      rateIntervalInSeconds,
      allocationAssigned,
      allocationReserved,
      cliffVestAmount,
      cliffVestPercent,
      {
        accounts: {
          initializer: treasurer,
          treasurer: treasurer,
          treasury: treasury,
          associatedToken: associatedToken,
          beneficiary: beneficiary,
          stream: streamAccount.publicKey,
          feeTreasury: Constants.FEE_TREASURY,
          msp: this.program.programId,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY
        },
        signers: [streamAccount],
        preInstructions: ixs
      }
    );

    tx.feePayer = treasurer;
    let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment || 'confirmed');
    tx.recentBlockhash = hash.blockhash;
    tx.partialSign(...[streamAccount]);

    return tx;
  }

  public async addFunds (
    contributor: PublicKey,
    treasury: PublicKey,
    stream: PublicKey | undefined,
    amount: number,
    allocationType: AllocationType

  ): Promise<Transaction> {

    const treasuryInfo = await getTreasury(this.program, treasury, "recent");

    if (!treasuryInfo) {
      throw Error("Treasury account not found");
    }

    const associatedToken = new PublicKey(treasuryInfo.associatedToken as string);
    const treasuryMint = new PublicKey(treasuryInfo.mint as string);
    const contributorToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      contributor,
      true
    );

    const contributorTokenInfo = this.program.provider.connection.getAccountInfo(contributorToken, "recent");

    if (!contributorTokenInfo) {
      throw Error("Contributor token account doesn't exist");
    }

    const contributorTreasuryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      treasuryMint,
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

    let tx = this.program.transaction.addFunds(
      amount,
      allocationType,
      !stream ? PublicKey.default : stream,
      {
        accounts: {
          contributor: contributor,
          contributorToken: contributorToken,
          contributorTreasuryToken: contributorTreasuryToken,
          treasury: treasury,
          treasuryToken: treasuryToken,
          associatedToken: associatedToken,
          treasuryMint: treasuryMint,
          stream: !stream ? PublicKey.default : stream,
          feeTreasury: Constants.FEE_TREASURY,
          msp: this.program.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY
        },
        signers: []
      }
    );

    tx.feePayer = contributor;
    let { blockhash } = await this.program.provider.connection.getRecentBlockhash(this.commitment as Commitment || "confirmed");    
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public withdraw = async function (
    beneficiary: PublicKey,
    stream: PublicKey,
    amount: number

  ): Promise<Transaction> {

    throw Error('Not implemented');
  }

  public pauseStream = async function (
    initializer: PublicKey,
    stream: PublicKey

  ): Promise<Transaction> {

    throw Error('Not implemented');
  }

  public resumeStream = async function (
    initializer: PublicKey,
    stream: PublicKey

  ): Promise<Transaction> {

    throw Error('Not implemented');
  }

  public closeStream = async function (
    initializer: PublicKey,
    stream: PublicKey,
    autoCloseTreasury: boolean = false

  ): Promise<Transaction> {

    throw Error('Not implemented');
  }

  public closeTreasury = async function (
    treasurer: PublicKey,
    treasury: PublicKey

  ): Promise<Transaction> {

    throw Error('Not implemented');
  }
}
