/**
 * Solana
 */
import { Commitment, Connection, ConnectionConfig, Keypair, PublicKey, Transaction, Signer, Finality, TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { AccountLayout, ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN, Idl, Program, Provider } from "@project-serum/anchor";

/**
 * MSP
 */
import { Stream, ListStreamParams, Treasury, TreasuryType, AllocationType } from "./types";
import { createProgram, getStream, getStreamCached, getTreasury, listStreamActivity, listStreams, listStreamsCached } from "./utils";
import { Constants } from "./constants";
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
    walletAddress: string,
    commitment: Commitment | string = "confirmed"

  ) {

    this.commitment = commitment as Commitment;
    this.connection = new Connection(rpcUrl, this.commitment);
    this.program = createProgram(this.connection, walletAddress);
  }

  public async getStream (
    id: PublicKey,
    commitment?: Commitment | undefined,
    friendly: boolean = true

  ): Promise<any> {

    let accountInfo = await this.connection.getAccountInfo(id, commitment);

    if (!accountInfo) {
      throw Error("Stream doesn't exists");
    }

    return getStream(this.program, id, commitment, friendly);
  }

  public async refreshStream (
    streamInfo: any,
    hardUpdate: boolean = false,
    friendly: boolean = true

  ): Promise<Stream> {

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
    friendly = true

  }: ListStreamParams): Promise<Stream[]> {

    return listStreams(
      this.program,
      treasurer,
      treasury,
      beneficiary,
      friendly
    );
  }

  public async refreshStreams (
    streamInfoList: Stream[],
    treasurer?: PublicKey | undefined,
    treasury?: PublicKey | undefined,
    beneficiary?: PublicKey | undefined,
    hardUpdate: boolean = false,
    friendly: boolean = true

  ): Promise<Stream[]> {

    if (hardUpdate) {
      return await listStreams(
        this.program, 
        treasurer, 
        treasury,
        beneficiary,
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

    let accountInfo = await this.connection.getAccountInfo(id, commitment);

    if (!accountInfo) {
      throw Error("Stream doesn't exists");
    }

    return listStreamActivity(this.program, id, commitment, friendly);
  }

  public async getTreasury (
    id: PublicKey,
    commitment?: Commitment | undefined,
    friendly: boolean = true

  ): Promise<Treasury> {

    let accountInfo = await this.program.account.treasury.getAccountInfo(id, commitment);

    if (!accountInfo) {
      throw Error("Treasury doesn't exists");
    }

    return getTreasury(this.program, id, friendly);
  }

  public async listTreasuries (
    treasurer: PublicKey,
    friendly: boolean = true

  ): Promise<Treasury[]> {

    return listTreasuries(
      this.program,
      treasurer,
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

    const treasurerTokenInfo = await this.connection.getAccountInfo(treasurerToken);

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

      ixs.push(
        Token.createTransferInstruction(
          TOKEN_PROGRAM_ID,
          treasurerToken,
          beneficiaryToken,
          treasurer,
          [],
          amount
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
          new BN(slot),
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
          new BN(amount),
          AllocationType.Specific,
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
              stream: Keypair.generate().publicKey, //TODO: Change
              feeTreasury: Constants.FEE_TREASURY,
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
          new BN(start.getTime()),
          new BN(0),
          new BN(0),
          new BN(amount),
          new BN(0),
          new BN(amount),
          new BN(100 * 10_000),
          {
            accounts: {
              initializer: treasurer,
              treasurer: treasurer,
              treasury: treasury,
              associatedToken: associatedToken,
              beneficiary: beneficiary,
              stream: streamAccount.publicKey,
              feeTreasury: Constants.FEE_TREASURY,
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

    const slot = await this.connection.getSlot(this.commitment as Commitment || 'confirmed');
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
      new BN(slot),
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
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY
        },
        signers: []
      }
    );

    tx.feePayer = treasurer;
    const { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || 'confirmed');
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async createStream (
    initializer: PublicKey,
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
      treasurerTreasuryToken: PublicKey = PublicKey.default;

    const cliffVestPercentValue = cliffVestPercent ? cliffVestPercent * Constants.CLIFF_PERCENT_NUMERATOR : 0;

    if (treasury) {

      const treasuryInfo = await getTreasury(this.program, treasury);

      if (!treasuryInfo) {
        throw Error("Treasury doesn't exist");
      }

      if (treasuryInfo.associatedToken !== associatedToken.toBase58()) {
        throw Error("Incorrect associated token address");
      }

      treasuryMint = new PublicKey(treasuryInfo.mint as string);

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
          new BN(slot),
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
            new BN(allocationAssigned),
            AllocationType.Specific,
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
                stream: Keypair.generate().publicKey, //TODO: change 
                feeTreasury: Constants.FEE_TREASURY,
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
    const now = new Date();
    const startDate = startUtc && startUtc.getTime() >= now.getTime() ? startUtc : now;

    // Create Stream
    let tx = this.program.transaction.createStream(
      streamName,
      new BN(startDate.getTime()),
      new BN(rateAmount as number),
      new BN(rateIntervalInSeconds as number),
      new BN(allocationAssigned),
      new BN(allocationReserved as number),
      new BN(cliffVestAmount as number),
      new BN(cliffVestPercentValue),
      {
        accounts: {
          initializer: initializer,
          treasurer: treasurer,
          treasury: treasury,
          associatedToken: associatedToken,
          beneficiary: beneficiary,
          stream: streamAccount.publicKey,
          feeTreasury: Constants.FEE_TREASURY,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY
        },
        signers: [streamAccount],
        preInstructions: ixs
      }
    );

    tx.feePayer = initializer;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || 'confirmed');
    tx.recentBlockhash = blockhash;
    tx.partialSign(...[streamAccount]);

    return tx;
  }

  public async addFunds (
    contributor: PublicKey,
    treasury: PublicKey,
    associatedToken: PublicKey,
    stream: PublicKey | undefined,
    amount: number,
    allocationType: AllocationType

  ): Promise<Transaction> {

    if (!amount) {
      throw Error("Amount should be greater than 0");
    }

    const treasuryInfo = await getTreasury(this.program, treasury);

    if (!treasuryInfo) {
      throw Error("Treasury account not found");
    }

    if (treasuryInfo.associatedToken && treasuryInfo.associatedToken !== associatedToken.toBase58()) {
      throw Error("Invalid treasury associated token");
    }

    const treasuryMint = new PublicKey(treasuryInfo.mint as string);
    const contributorToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      contributor,
      true
    );

    const contributorTokenInfo = this.connection.getAccountInfo(contributorToken, "recent");

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
      new BN(amount),
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
          stream: !stream ? Keypair.generate().publicKey : stream, //TODO: Change
          feeTreasury: Constants.FEE_TREASURY,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY
        }
      }
    );

    tx.feePayer = contributor;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || "confirmed");    
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async withdraw (
    beneficiary: PublicKey,
    stream: PublicKey,
    amount: number

  ): Promise<Transaction> {

    if (!amount) {
      throw Error("Amount should be greater than 0");
    }

    let streamInfo: any = await getStream(this.program, stream, "recent");

    if (!streamInfo) {
      throw Error("Stream doesn't exists");
    }

    if (!beneficiary.equals(new PublicKey(streamInfo.beneficiary as string))) {
      throw Error("Incorrect stream beneficiary");
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

    const treasury = new PublicKey(streamInfo.treasury as PublicKey);
    const treasuryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      treasury,
      true
    );

    const feeTreasuryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      Constants.FEE_TREASURY,
      true
    );

    let tx = this.program.transaction.withdraw(
      new BN(amount),
      {
        accounts: {
          beneficiary: beneficiary,
          beneficiaryToken: beneficiaryToken,
          associatedToken: associatedToken,
          treasury: treasury,
          treasuryToken: treasuryToken,
          stream: stream,
          feeTreasury: Constants.FEE_TREASURY,
          feeTreasuryToken: feeTreasuryToken,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY
        }
      }
    );

    tx.feePayer = beneficiary;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment);
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async pauseStream (
    initializer: PublicKey,
    stream: PublicKey

  ): Promise<Transaction> {

    const streamInfo = await getStream(this.program, stream);

    if (!streamInfo) {
      throw Error("Stream doesn't exist");
    }

    const treasury = new PublicKey(streamInfo.treasury as string);
    const associatedToken = new PublicKey(streamInfo.associatedToken as string);

    let tx = this.program.transaction.pauseStream(
      {
        accounts: {
          initializer: initializer,
          treasury: treasury,
          associatedToken: associatedToken,
          stream: stream
        }
      }
    );

    tx.feePayer = initializer;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment);
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async resumeStream (
    initializer: PublicKey,
    stream: PublicKey

  ): Promise<Transaction> {

    const streamInfo = await getStream(this.program, stream);

    if (!streamInfo) {
      throw Error("Stream doesn't exist");
    }

    const treasury = new PublicKey(streamInfo.treasury as string);
    const associatedToken = new PublicKey(streamInfo.associatedToken as string);

    let tx = this.program.transaction.resumeStream(
      {
        accounts: {
          initializer: initializer,
          treasury: treasury,
          associatedToken: associatedToken,
          stream: stream
        }
      }
    );

    tx.feePayer = initializer;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment);
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async closeStream (
    initializer: PublicKey,
    stream: PublicKey,
    autoCloseTreasury: boolean = false

  ): Promise<Transaction> {

    let streamInfo = await getStream(this.program, stream, "recent");

    if (!streamInfo) {
      throw Error("Stream doesn't exist");
    }

    const beneficiary = new PublicKey(streamInfo.beneficiary as string);
    const associatedToken = new PublicKey(streamInfo.associatedToken as string);
    const beneficiaryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      beneficiary,
      true
    );

    const treasurer = new PublicKey(streamInfo.treasurer as string);
    const treasurerToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      treasurer,
      true
    );

    const treasury = new PublicKey(streamInfo.treasury as string);
    const treasuryInfo = await getTreasury(this.program, treasury);

    if (!treasuryInfo) {
      throw Error("Treasury doesn't exist");
    }

    const treasuryMint = new PublicKey(treasuryInfo.mint as string);
    const treasurerTreasuryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      treasuryMint,
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
    const feeTreasuryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      Constants.FEE_TREASURY,
      true
    );

    let tx = this.program.transaction.closeStream(
      autoCloseTreasury,
      {
        accounts: {
          initializer: initializer,
          treasurer: treasurer,
          treasurerToken: treasurerToken,
          treasurerTreasuryToken: treasurerTreasuryToken,
          beneficiary: beneficiary,
          beneficiaryToken: beneficiaryToken,
          associatedToken: associatedToken,
          treasury: treasury,
          treasuryToken: treasuryToken,
          treasuryMint: treasuryMint,
          stream: stream,
          feeTreasury: Constants.FEE_TREASURY,
          feeTreasuryToken: feeTreasuryToken,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY
        }
      }
    );

    tx.feePayer = initializer;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || 'confirmed');
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async closeTreasury (
    treasurer: PublicKey,
    treasury: PublicKey

  ): Promise<Transaction> {

    let treasuryInfo = await getTreasury(this.program, treasury);

    if (!treasuryInfo) {
      throw Error("Treasury doesn't exist");
    }

    let associatedToken: any;
    let treasuryToken: any;
    let treasurerToken: any;
    let feeTreasuryToken: any;
    let treasuryMint = new PublicKey(treasuryInfo.mint as string);
    
    if (treasuryInfo.associatedToken) {

      associatedToken = new PublicKey(treasuryInfo.associatedToken as string);
      treasuryToken = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        associatedToken,
        treasury,
        true
      );

    } else {

      const tokenAccountsResult = await this.connection.getTokenAccountsByOwner(
        treasury, { programId: TOKEN_PROGRAM_ID }
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
      feeTreasuryToken = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        associatedToken,
        Constants.FEE_TREASURY,
        true
      );
    }

    const treasurerTreasuryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      treasuryMint,
      treasurer,
      true
    );

    let tx = this.program.transaction.closeTreasury(
      {
        accounts: {
          treasurer: treasurer,
          treasurerToken: treasurerToken,
          treasurerTreasuryToken: treasurerTreasuryToken,
          associatedToken: associatedToken,
          treasury: treasury,
          treasuryToken: treasuryToken,
          treasuryMint: treasuryMint,
          feeTreasury: Constants.FEE_TREASURY,
          feeTreasuryToken: feeTreasuryToken,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY
        }
      }
    );

    tx.feePayer = treasurer;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || 'confirmed');
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async refreshTreasuryData (
    treasurer: PublicKey,
    treasury: PublicKey

  ): Promise<Transaction> {

    const treasuryInfo = await getTreasury(this.program, treasury);

    if (!treasuryInfo) {
      throw Error("Treasury doesn't exist");
    }

    const associatedToken = new PublicKey(treasuryInfo.associatedToken as string);
    const treasuryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      treasury,
      true
    );

    // get treasury streams amount
    const memcmpFilters = [{ memcmp: { offset: 8 + 170, bytes: treasury.toBase58() }}];
    const totalStreams = (await this.program.account.stream.all(memcmpFilters)).length;

    let tx = this.program.transaction.refreshTreasuryData(
      new BN(totalStreams),
      {
        accounts: {
          treasurer: treasurer,
          associatedToken: associatedToken,
          treasury: treasury,
          treasuryToken: treasuryToken
        }
      }
    );

    tx.feePayer = treasurer;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment);
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async transferStream (
    beneficiary: PublicKey,
    newBeneficiary: PublicKey,
    stream: PublicKey

  ): Promise<Transaction> {

    const streamInfo = await getStream(this.program, stream);

    if (!streamInfo) {
      throw Error("Stream doesn't exist");
    }

    const beneficiaryAddress = new PublicKey(streamInfo.beneficiary as string);

    if (!beneficiary.equals(beneficiaryAddress)) {
      throw Error("Not authorized");
    }

    let tx = this.program.transaction.transferStream(
      newBeneficiary,
      {
        accounts: {
          beneficiary: beneficiaryAddress,
          stream: stream,
          feeTreasury: Constants.FEE_TREASURY,
          systemProgram: SystemProgram.programId
        }
      }
    );

    tx.feePayer = beneficiary;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment);
    tx.recentBlockhash = blockhash;

    return tx;
  }
}