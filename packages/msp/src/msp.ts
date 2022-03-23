/**
 * Solana
 */
import { Commitment, Connection, ConnectionConfig, Keypair, PublicKey, Transaction, Signer, Finality, TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN, Idl, Program } from "@project-serum/anchor";

/**
 * MSP
 */
import { Stream, ListStreamParams, Treasury, TreasuryType, STREAM_STATUS } from "./types";
import { createProgram, getStream, getStreamCached, getTreasury, getValidTreasuryAllocation, listStreamActivity, listStreams, listStreamsCached } from "./utils";
import { Constants } from "./constants";
import { Beneficiary, listTreasuries, StreamBeneficiary } from ".";
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
    commitment: Commitment | string = "finalized"

  ) {

    this.commitment = commitment as Commitment;
    this.connection = new Connection(rpcUrl, this.commitment as Commitment || "finalized");
    this.program = createProgram(this.connection, walletAddress);
  }

  public async getStream (
    id: PublicKey,
    friendly: boolean = true

  ): Promise<any> {

    const program = createProgram(
      this.connection,
      Constants.FEE_TREASURY.toBase58()
    );

    return getStream(program, id, friendly);
  }

  public async refreshStream (
    streamInfo: any,
    hardUpdate: boolean = false,
    friendly: boolean = true

  ): Promise<any> {

    let copyStreamInfo = Object.assign({}, streamInfo);

    if (hardUpdate) {

      const program = createProgram(
        this.connection,
        Constants.FEE_TREASURY.toBase58()
      );

      const streamId = typeof copyStreamInfo.id === 'string' 
        ? new PublicKey(copyStreamInfo.id) 
        : copyStreamInfo.id as PublicKey; 

        return await getStream(program, streamId);
    }

    return getStreamCached(copyStreamInfo, friendly);
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

  /**
   * 
   * @param id The address of the stream
   * @param before The signature to start searching backwards from.
   * @param limit The max amount of elements to retrieve
   * @param commitment Commitment to query the stream activity
   * @param friendly The data will be displayed in a user readable format
   * @returns 
   */
  public async listStreamActivity (
    id: PublicKey,
    before: string,
    limit: number = 10,
    commitment?: Finality | undefined,
    friendly: boolean = true

  ): Promise<any[]> {

    let accountInfo = await this.connection.getAccountInfo(id, commitment);

    if (!accountInfo) {
      throw Error("Stream doesn't exists");
    }

    return listStreamActivity(
      this.program, 
      id,
      before,
      limit,
      commitment, 
      friendly
    );
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
    treasurer: PublicKey | undefined,
    friendly: boolean = true

  ): Promise<Treasury[]> {

    return listTreasuries(
      this.program,
      treasurer,
      friendly
    )
  }

  public async transfer (
    sender: PublicKey,
    beneficiary: PublicKey,
    mint: PublicKey,
    amount: number

  ): Promise<Transaction> {

    let ixs: TransactionInstruction[] = [];
    const senderToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint,
      sender,
      true
    );

    const senderTokenInfo = await this.connection.getAccountInfo(senderToken);

    if (!senderTokenInfo) {
      throw Error("Sender token account not found");
    }

    let beneficiaryToken = beneficiary;
    const beneficiaryAccountInfo = await this.connection.getAccountInfo(beneficiary);

    if (!beneficiaryAccountInfo || !beneficiaryAccountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
      
      beneficiaryToken = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        mint,
        beneficiary,
        true
      );

      const beneficiaryTokenAccountInfo = await this.connection.getAccountInfo(beneficiaryToken);

      if (!beneficiaryTokenAccountInfo) {
        ixs.push(
          Token.createAssociatedTokenAccountInstruction(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            mint,
            beneficiaryToken,
            beneficiary,
            sender
          )
        );
      }
    }

    ixs.push(
      Token.createTransferInstruction(
        TOKEN_PROGRAM_ID,
        senderToken,
        beneficiaryToken,
        sender,
        [],
        amount
      )
    );

    let tx = new Transaction().add(...ixs);
    tx.feePayer = sender;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || "finalized");
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async scheduledTransfer (
    treasurer: PublicKey,
    beneficiary: PublicKey,
    mint: PublicKey,
    amount: number,
    startUtc?: Date,
    streamName?: string,
    feePayedByTreasurer: boolean = false

  ): Promise<Transaction> {

    let ixs: TransactionInstruction[] = [];
    let txSigners: Signer[] = [];

    const now = new Date();
    const start = !startUtc || startUtc.getTime() < now.getTime() ? now : startUtc;
    const treasurerToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint,
      treasurer,
      true
    );

    const treasurerTokenInfo = await this.connection.getAccountInfo(treasurerToken);

    if (!treasurerTokenInfo) {
      throw Error("Treasurer token account doesn't exist");
    }

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
        true, // autoclose = true
        false, // sol fee payed by treasury
        {
          accounts: {
            payer: treasurer,
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
      mint,
      treasury,
      true
    );

    const feeTreasuryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint,
      Constants.FEE_TREASURY,
      true
    );

    // Add Funds
    ixs.push(
      this.program.instruction.addFunds(
        new BN(amount),
        {
          accounts: {
            payer: treasurer,
            contributor: treasurer,
            contributorToken: treasurerToken,
            contributorTreasuryToken: treasurerTreasuryToken,
            treasury: treasury,
            treasuryToken: treasuryToken,
            associatedToken: mint,
            treasuryMint: treasuryMint,
            feeTreasury: Constants.FEE_TREASURY,
            feeTreasuryToken: feeTreasuryToken,
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
    const startUtcInSeconds = parseInt((start.getTime() / 1000).toString());

    // Create Stream
    ixs.push(
      this.program.instruction.createStream(
        streamName,
        new BN(startUtcInSeconds),
        new BN(0), // rate amount units
        new BN(0), // rate interval in seconds
        new BN(amount), // allocation assigned
        new BN(amount), // cliff vest amount
        new BN(0), // cliff vest percent
        feePayedByTreasurer,
        {
          accounts: {
            payer: treasurer,
            initializer: treasurer,
            treasurer: treasurer,
            treasury: treasury,
            treasuryToken: treasuryToken,
            associatedToken: mint,
            beneficiary: beneficiary,
            stream: streamAccount.publicKey,
            feeTreasury: Constants.FEE_TREASURY,
            feeTreasuryToken: feeTreasuryToken,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY
          },
          signers: [streamAccount]
        }
      )
    );

    let tx = new Transaction().add(...ixs);
    tx.feePayer = treasurer;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || "finalized");
    tx.recentBlockhash = blockhash;
    
    if (txSigners.length) {
      tx.partialSign(...txSigners);
    }

    return tx;
  }

  public async streamPayment (
    treasurer: PublicKey,
    beneficiary: PublicKey,
    mint: PublicKey,
    streamName: string,
    allocationAssigned: number,
    rateAmount?: number,
    rateIntervalInSeconds?: number,
    startUtc?: Date,
    cliffVestAmount?: number,
    cliffVestPercent?: number,
    feePayedByTreasurer: boolean = false

  ): Promise<Transaction> {

    if (treasurer.equals(beneficiary)) {
      throw Error("Beneficiary can not be the same Treasurer");
    }
    
    let ixs: TransactionInstruction[] = [];
    let txSigners: Signer[] = [];

    const now = new Date();
    const start = !startUtc || startUtc.getTime() < Date.now() ? now : startUtc;
    const feeTreasuryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint,
      Constants.FEE_TREASURY,
      true
    );

    const cliffVestPercentValue = cliffVestPercent ? cliffVestPercent * Constants.CLIFF_PERCENT_NUMERATOR : 0;
    
    const slot = await this.connection.getSlot(this.commitment as Commitment || "finalized");
    const slotBuffer = new u64Number(slot).toBuffer();
    const treasurySeeds = [treasurer.toBuffer(), slotBuffer];
    const [treasury, treasuryBump] = await PublicKey.findProgramAddress(treasurySeeds, this.program.programId);
    const treasuryMintSeeds = [treasurer.toBuffer(), treasury.toBuffer(), slotBuffer];
    const [treasuryMint, treasuryMintBump] = await PublicKey.findProgramAddress(
      treasuryMintSeeds, 
      this.program.programId
    );

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
        true, // autoclose = true
        false, // sol fee payed by treasury
        {
          accounts: {
            payer: treasurer,
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

    // Get the treasurer token account
    const treasurerToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint,
      treasurer,
      true
    );

    // Get the treasury token account
    const treasuryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint,
      treasury,
      true
    );

    // Add Funds
    ixs.push(
      this.program.instruction.addFunds(
        new BN(allocationAssigned),
        {
          accounts: {
            payer: treasurer,
            contributor: treasurer,
            contributorToken: treasurerToken,
            contributorTreasuryToken: treasurerTreasuryToken,
            treasury: treasury,
            treasuryToken: treasuryToken,
            associatedToken: mint,
            treasuryMint: treasuryMint,
            feeTreasury: Constants.FEE_TREASURY,
            feeTreasuryToken: feeTreasuryToken,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY
          }
        }
      )
    )

    const streamAccount = Keypair.generate();
    txSigners.push(streamAccount);
    const startUtcInSeconds = parseInt((start.getTime() / 1000).toString());

    // Create Stream
    ixs.push(
      this.program.instruction.createStream(
        streamName,
        new BN(startUtcInSeconds),
        new BN(rateAmount ?? 0), // rate amount units
        new BN(rateIntervalInSeconds ?? 0), // rate interval in seconds
        new BN(allocationAssigned), // allocation assigned
        new BN(cliffVestAmount ?? 0), // cliff vest amount
        new BN((cliffVestPercent ?? 0) * 10_000), // cliff vest percent
        feePayedByTreasurer,
        {
          accounts: {
            payer: treasurer,
            initializer: treasurer,
            treasurer: treasurer,
            treasury: treasury,
            treasuryToken: treasuryToken,
            associatedToken: mint,
            beneficiary: beneficiary,
            stream: streamAccount.publicKey,
            feeTreasury: Constants.FEE_TREASURY,
            feeTreasuryToken: feeTreasuryToken,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY
          },
          signers: [streamAccount]
        }
      )
    );

    let tx = new Transaction().add(...ixs);
    tx.feePayer = treasurer;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || "finalized");
    tx.recentBlockhash = blockhash;
    
    if (txSigners.length) {
      tx.partialSign(...txSigners);
    }

    return tx;
  }

  public async createTreasury (
    payer: PublicKey,
    treasurer: PublicKey,
    associatedToken: PublicKey,
    label: string,
    type: TreasuryType,
    solFeePayedByTreasury: boolean = false

  ): Promise<Transaction> {

    const slot = await this.connection.getSlot(this.commitment as Commitment || "finalized");
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

    const treasuryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      treasury,
      true
    );

    let tx = this.program.transaction.createTreasury(
      new BN(slot),
      treasuryBump,
      treasuryMintBump,
      label,
      type,
      false, // autoclose = false
      solFeePayedByTreasury,
      {
        accounts: {
          payer: payer,
          treasurer: treasurer,
          treasury: treasury,
          treasuryMint: treasuryMint,
          treasuryToken: treasuryToken,
          associatedToken: associatedToken,
          feeTreasury: Constants.FEE_TREASURY,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY
        }
      }
    );

    tx.feePayer = treasurer;
    const { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || "finalized");
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async createStream (
    payer: PublicKey,
    treasurer: PublicKey,
    treasury: PublicKey,
    beneficiary: PublicKey,
    associatedToken: PublicKey,
    streamName: string,
    allocationAssigned: number,
    rateAmount?: number,
    rateIntervalInSeconds?: number,
    startUtc?: Date,
    cliffVestAmount?: number,
    cliffVestPercent?: number,
    feePayedByTreasurer?: boolean

  ): Promise<Transaction> {

    if (treasurer.equals(beneficiary)) {
      throw Error("Beneficiary can not be the same Treasurer");
    }

    const treasuryInfo = await getTreasury(this.program, treasury);

    if (!treasuryInfo) {
      throw Error("Treasury doesn't exist");
    }

    if (treasuryInfo.associatedToken !== associatedToken.toBase58()) {
      throw Error("Incorrect associated token address");
    }

    // Get the treasury token account
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

    const cliffVestPercentValue = cliffVestPercent ? cliffVestPercent * Constants.CLIFF_PERCENT_NUMERATOR : 0;
    const now = new Date();
    const startDate = startUtc && startUtc.getTime() >= now.getTime() ? startUtc : now;
    const startUtcInSeconds = parseInt((startDate.getTime() / 1000).toString());
    const streamAccount = Keypair.generate();

    // Create Stream
    let tx = this.program.transaction.createStream(
      streamName,
      new BN(startUtcInSeconds),
      new BN(rateAmount as number),
      new BN(rateIntervalInSeconds as number),
      new BN(allocationAssigned),
      new BN(cliffVestAmount as number),
      new BN(cliffVestPercentValue),
      feePayedByTreasurer ?? false,
      {
        accounts: {
          payer: payer,
          initializer: payer,
          treasurer: treasurer,
          treasury: treasury,
          treasuryToken: treasuryToken,
          associatedToken: associatedToken,
          beneficiary: beneficiary,
          stream: streamAccount.publicKey,
          feeTreasury: Constants.FEE_TREASURY,
          feeTreasuryToken: feeTreasuryToken,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY
        },
        signers: [streamAccount]
      }
    );

    tx.feePayer = payer;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || "finalized");
    tx.recentBlockhash = blockhash;
    tx.partialSign(...[streamAccount]);

    return tx;
  }

  public async createStreams (
    payer: PublicKey,
    treasurer: PublicKey,
    treasury: PublicKey,
    beneficiaries: Beneficiary[],
    associatedToken: PublicKey,
    allocationAssigned: number,
    rateAmount?: number,
    rateIntervalInSeconds?: number,
    startUtc?: Date,
    cliffVestAmount?: number,
    cliffVestPercent?: number,
    feePayedByTreasurer?: boolean

  ): Promise<Transaction[]> {

    const treasuryInfo = await getTreasury(this.program, treasury);

    if (!treasuryInfo) {
      throw Error("Treasury doesn't exist");
    }

    if (treasuryInfo.associatedToken !== associatedToken.toBase58()) {
      throw Error("Incorrect associated token address");
    }

    // Get the treasury token account
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

    const cliffVestPercentValue = cliffVestPercent ? cliffVestPercent * Constants.CLIFF_PERCENT_NUMERATOR : 0;
    const now = new Date();
    const startDate = startUtc && startUtc.getTime() >= now.getTime() ? startUtc : now;
    const startUtcInSeconds = parseInt((startDate.getTime() / 1000).toString());

    // Create Streams
    let txs: Transaction[] = [];

    for (let beneficiary of beneficiaries) {

      if (beneficiary.address.toBase58() === treasurer.toBase58()) { continue; }

      let streamAccount = Keypair.generate();
      let ix = this.program.instruction.createStream(
        beneficiary.streamName,
        new BN(startUtcInSeconds),
        new BN(rateAmount as number),
        new BN(rateIntervalInSeconds as number),
        new BN(allocationAssigned),
        new BN(cliffVestAmount as number),
        new BN(cliffVestPercentValue),
        feePayedByTreasurer ?? false,
        {
          accounts: {
            payer: payer,
            initializer: payer,
            treasurer: treasurer,
            treasury: treasury,
            treasuryToken: treasuryToken,
            associatedToken: associatedToken,
            beneficiary: beneficiary.address,
            stream: streamAccount.publicKey,
            feeTreasury: Constants.FEE_TREASURY,
            feeTreasuryToken: feeTreasuryToken,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY
          }
        }
      );

      let currentTx = new Transaction().add(ix);
      currentTx.feePayer = payer;
      let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || "finalized");
      currentTx.recentBlockhash = blockhash;
      currentTx.partialSign(streamAccount);
      txs.push(currentTx);
    }

    return txs;
  }

  public async fundStream (
    payer: PublicKey,
    contributor: PublicKey,
    treasury: PublicKey,
    stream: PublicKey,
    amount: number

  ): Promise<Transaction> {

    let ixs: TransactionInstruction[] = [];

    if (!amount) {
      throw Error("Amount should be greater than 0");
    }

    const treasuryInfo = await getTreasury(this.program, treasury);

    if (!treasuryInfo) {
      throw Error("Treasury account not found");
    }

    const streamInfo = await this.getStream(stream) as Stream;

    if (!streamInfo) {
      throw Error("Stream account not found");
    }

    if (treasuryInfo.associatedToken !== streamInfo.associatedToken) {
      throw Error("Invalid stream beneficiary associated token");
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

    const feeTreasuryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      Constants.FEE_TREASURY,
      true
    );

    ixs.push(
      this.program.instruction.addFunds(
        new BN(amount),
        {
          accounts: {
            payer: payer,
            contributor: contributor,
            contributorToken: contributorToken,
            contributorTreasuryToken: contributorTreasuryToken,
            treasury: treasury,
            treasuryToken: treasuryToken,
            associatedToken: associatedToken,
            treasuryMint: treasuryMint,
            feeTreasury: Constants.FEE_TREASURY,
            feeTreasuryToken: feeTreasuryToken,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY
          }
        }
      )
    );

    // calculate fee if are payed by treasury to deduct it from the amount
    let allocationAmountBn = new BN(amount);
    
    if (streamInfo.feePayedByTreasurer) {
      allocationAmountBn = await getValidTreasuryAllocation(
        this.program.provider.connection, 
        treasuryInfo,
        amount
      );
    }

    ixs.push(
      this.program.instruction.allocate(
        allocationAmountBn,
        {
          accounts: {
            payer: payer,
            treasurer: contributor,
            treasury: treasury,
            treasuryToken: treasuryToken,
            associatedToken: associatedToken,
            stream: stream,
            feeTreasury: Constants.FEE_TREASURY,
            feeTreasuryToken: feeTreasuryToken,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY
          }
        }
      )
    );

    let tx = new Transaction().add(...ixs);
    tx.feePayer = payer;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || "finalized");    
    tx.recentBlockhash = blockhash;

    return tx;
  } 

  public async addFunds (
    payer: PublicKey,
    contributor: PublicKey,
    treasury: PublicKey,
    associatedToken: PublicKey,
    amount: number

  ): Promise<Transaction> {

    if (!amount) {
      throw Error("Amount should be greater than 0");
    }

    const treasuryInfo = await getTreasury(this.program, treasury);

    if (!treasuryInfo) {
      throw Error("Treasury account not found");
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

    const feeTreasuryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      Constants.FEE_TREASURY,
      true
    );

    let tx = this.program.transaction.addFunds(
      new BN(amount),
      {
        accounts: {
          payer: payer,
          contributor: contributor,
          contributorToken: contributorToken,
          contributorTreasuryToken: contributorTreasuryToken,
          treasury: treasury,
          treasuryToken: treasuryToken,
          associatedToken: associatedToken,
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

    tx.feePayer = payer;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || "finalized");    
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async allocate (
    payer: PublicKey,
    treasurer: PublicKey,
    treasury: PublicKey,
    stream: PublicKey,
    amount: number

  ): Promise<Transaction> {

    if (!amount) {
      throw Error("Amount should be greater than 0");
    }

    const treasuryInfo = await getTreasury(this.program, treasury);

    if (!treasuryInfo) {
      throw Error("Treasury account not found");
    }

    if (treasuryInfo.treasurer !== treasurer.toBase58()) {
      throw Error("Invalid treasurer");
    }

    const streamInfo = await this.getStream(stream) as Stream;

    if (!streamInfo) {
      throw Error("Stream account not found");
    }

    if (treasuryInfo.associatedToken !== streamInfo.associatedToken) {
      throw Error("Invalid stream beneficiary associated token");
    }

    const associatedToken = new PublicKey(treasuryInfo.associatedToken as string);
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

    let tx = this.program.transaction.allocate(
      new BN(amount),
      {
        accounts: {
          payer: payer,
          treasurer: treasurer,
          treasury: treasury,
          treasuryToken: treasuryToken,
          associatedToken: associatedToken,
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

    tx.feePayer = payer;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || "finalized");    
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async withdraw (
    payer: PublicKey,
    stream: PublicKey,
    amount: number

  ): Promise<Transaction> {

    if (!amount) {
      throw Error("Amount should be greater than 0");
    }

    const streamInfo = await this.getStream(stream) as Stream;

    if (!streamInfo) {
      throw Error("Stream doesn't exist");
    }

    if (streamInfo.status === STREAM_STATUS.Schedule) {
      throw Error("Stream has not started");
    }

    if (streamInfo.withdrawableAmount === 0) {
      throw Error("Stream withdrawable amount is zero");
    }

    const beneficiary = new PublicKey(streamInfo.beneficiary as string);
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
          payer: payer,
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

    tx.feePayer = payer;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || "finalized");
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async pauseStream (
    payer: PublicKey,
    treasurer: PublicKey,
    stream: PublicKey

  ): Promise<Transaction> {

    const streamInfo = await this.getStream(stream) as Stream;

    if (!streamInfo) {
      throw Error("Stream doesn't exist");
    }

    const treasury = new PublicKey(streamInfo.treasury as string);
    const treasuryInfo = await this.getTreasury(treasury);

    if (!treasuryInfo) {
      throw Error("Treasury doesn't exist");
    }

    const associatedToken = new PublicKey(streamInfo.associatedToken as string);

    let tx = this.program.transaction.pauseStream(
      {
        accounts: {
          initializer: treasurer, // TODO: payer = payer, inititlizer = treasurer (change initializer to treasurer in MSP)
          treasury: treasury,
          associatedToken: associatedToken,
          stream: stream
        }
      }
    );

    tx.feePayer = payer;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || "finalized");
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async resumeStream (
    payer: PublicKey,
    treasurer: PublicKey,
    stream: PublicKey

  ): Promise<Transaction> {

    const streamInfo = await this.getStream(stream) as Stream;

    if (!streamInfo) {
      throw Error("Stream doesn't exist");
    }

    const treasury = new PublicKey(streamInfo.treasury as string);
    const treasuryInfo = await this.getTreasury(treasury);

    if (!treasuryInfo) {
      throw Error("Treasury doesn't exist");
    }

    const associatedToken = new PublicKey(streamInfo.associatedToken as string);

    let tx = this.program.transaction.resumeStream(
      {
        accounts: {
          initializer: treasurer, // TODO: payer = payer, inititlizer = treasurer (change initializer to treasurer in MSP)
          treasury: treasury,
          associatedToken: associatedToken,
          stream: stream
        }
      }
    );

    tx.feePayer = payer;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || "finalized");
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async closeStream (
    payer: PublicKey,
    destination: PublicKey,
    stream: PublicKey,
    autoCloseTreasury: boolean = false

  ): Promise<Transaction> {

    const streamInfo = await this.getStream(stream) as Stream;

    if (!streamInfo) {
      throw Error("Stream doesn't exist");
    }

    const treasury = new PublicKey(streamInfo.treasury as string);
    const treasuryInfo = await getTreasury(this.program, treasury);

    if (!treasuryInfo) {
      throw Error("Treasury doesn't exist");
    }

    if (streamInfo.associatedToken !== treasuryInfo.associatedToken) {
      throw Error("Invalid stream beneficiary associated token");
    }

    const treasurer = new PublicKey(streamInfo.treasurer as string);
    const beneficiary = new PublicKey(streamInfo.beneficiary as string);
    const associatedToken = new PublicKey(streamInfo.associatedToken as string);
    const beneficiaryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      beneficiary,
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

    let ixs: TransactionInstruction[] = [
      this.program.instruction.closeStream(
        {
          accounts: {
            payer: payer,
            treasurer: treasurer,
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
      )
    ];

    if (autoCloseTreasury) {

      const treasuryMint = new PublicKey(treasuryInfo.mint as string);
      const treasurerTreasuryToken = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        treasuryMint,
        treasurer,
        true
      );

      const destinationToken = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        associatedToken,
        destination,
        true
      );

      ixs.push(
        this.program.instruction.closeTreasury(
          {
            accounts: {
              payer: payer,
              treasurer: treasurer,
              treasurerTreasuryToken: treasurerTreasuryToken,
              destinationAuthority: destination,
              destinationTokenAccount: destinationToken,
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
        )
      );
    }

    let tx = new Transaction().add(...ixs);
    tx.feePayer = payer;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || "finalized");
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async closeTreasury (
    payer: PublicKey,
    destination: PublicKey,
    treasury: PublicKey   

  ): Promise<Transaction> {

    const treasuryInfo = await getTreasury(this.program, treasury);

    if (!treasuryInfo) {
      throw Error("Treasury not found");
    }

    const treasurer = new PublicKey(treasuryInfo.treasurer as string);
    const treasuryMint = new PublicKey(treasuryInfo.mint as string);
    const treasurerTreasuryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      treasuryMint,
      treasurer,
      true
    );

    let associatedToken = new PublicKey(Constants.WSOL_TOKEN_MINT);
    const treasuryAssociatedToken = treasuryInfo.associatedToken as string;

    if (treasuryAssociatedToken !== "") {
      associatedToken = new PublicKey(treasuryAssociatedToken);
    }

    const destinationToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      destination,
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

    let tx = this.program.transaction.closeTreasury(
      {
        accounts: {
          payer: payer,
          treasurer: treasurer,
          treasurerTreasuryToken: treasurerTreasuryToken,
          destinationAuthority: destination,
          destinationTokenAccount: destinationToken,
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

    tx.feePayer = payer;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || "finalized");
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async refreshTreasuryData (
    payer: PublicKey,
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

    tx.feePayer = payer;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || "finalized");
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async transferStream (
    beneficiary: PublicKey,
    newBeneficiary: PublicKey,
    stream: PublicKey

  ): Promise<Transaction> {

    const streamInfo = await this.getStream(stream) as Stream;

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
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || "finalized");
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async createStreamFromPda (
    payer: PublicKey,
    treasurer: PublicKey,
    treasury: PublicKey,
    beneficiary: PublicKey,
    associatedToken: PublicKey,
    stream: PublicKey,
    streamName: string,
    allocationAssigned: number,
    rateAmount?: number,
    rateIntervalInSeconds?: number,
    startUtc?: Date,
    cliffVestAmount?: number,
    cliffVestPercent?: number,
    feePayedByTreasurer?: boolean

  ): Promise<any> {

    if (treasurer.equals(beneficiary)) {
      throw Error("Beneficiary can not be the same Treasurer");
    }

    const treasuryInfo = await getTreasury(this.program, treasury);

    if (!treasuryInfo) {
      throw Error("Treasury doesn't exist");
    }

    if (treasuryInfo.associatedToken !== associatedToken.toBase58()) {
      throw Error("Incorrect associated token address");
    }

    // Get the treasury token account
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

    const cliffVestPercentValue = cliffVestPercent ? cliffVestPercent * Constants.CLIFF_PERCENT_NUMERATOR : 0;
    const now = new Date();
    const startDate = startUtc && startUtc.getTime() >= now.getTime() ? startUtc : now;
    const startUtcInSeconds = parseInt((startDate.getTime() / 1000).toString());

    // Create Stream
    let tx = this.program.transaction.createStream(
      streamName,
      new BN(startUtcInSeconds),
      new BN(rateAmount as number),
      new BN(rateIntervalInSeconds as number),
      new BN(allocationAssigned),
      new BN(cliffVestAmount as number),
      new BN(cliffVestPercentValue),
      feePayedByTreasurer ?? false,
      {
        accounts: {
          payer: payer,
          initializer: payer,
          treasurer: treasurer,
          treasury: treasury,
          treasuryToken: treasuryToken,
          associatedToken: associatedToken,
          beneficiary: beneficiary,
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

    tx.feePayer = payer;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || "finalized");
    tx.recentBlockhash = blockhash;

    return tx;
  }

  public async createStreamsFromPda (
    payer: PublicKey,
    treasurer: PublicKey,
    treasury: PublicKey,
    associatedToken: PublicKey,
    streams: StreamBeneficiary[],
    allocationAssigned: number,
    rateAmount?: number,
    rateIntervalInSeconds?: number,
    startUtc?: Date,
    cliffVestAmount?: number,
    cliffVestPercent?: number,
    feePayedByTreasurer?: boolean

  ): Promise<Transaction[]> {

    const treasuryInfo = await getTreasury(this.program, treasury);

    if (!treasuryInfo) {
      throw Error("Treasury doesn't exist");
    }

    if (treasuryInfo.associatedToken !== associatedToken.toBase58()) {
      throw Error("Incorrect associated token address");
    }

    // Get the treasury token account
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

    const cliffVestPercentValue = cliffVestPercent ? cliffVestPercent * Constants.CLIFF_PERCENT_NUMERATOR : 0;
    const now = new Date();
    const startDate = startUtc && startUtc.getTime() >= now.getTime() ? startUtc : now;
    const startUtcInSeconds = parseInt((startDate.getTime() / 1000).toString());

    // Create Streams
    let txs: Transaction[] = [];

    for (let stream of streams) {

      if (stream.beneficiary.toBase58() === treasurer.toBase58()) { continue; }

      let ix = this.program.instruction.createStream(
        stream.name,
        new BN(startUtcInSeconds),
        new BN(rateAmount as number),
        new BN(rateIntervalInSeconds as number),
        new BN(allocationAssigned),
        new BN(cliffVestAmount as number),
        new BN(cliffVestPercentValue),
        feePayedByTreasurer ?? false,
        {
          accounts: {
            payer: payer,
            initializer: payer,
            treasurer: treasurer,
            treasury: treasury,
            treasuryToken: treasuryToken,
            associatedToken: associatedToken,
            beneficiary: stream.beneficiary,
            stream: stream.address,
            feeTreasury: Constants.FEE_TREASURY,
            feeTreasuryToken: feeTreasuryToken,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY
          }
        }
      );

      let currentTx = new Transaction().add(ix);
      currentTx.feePayer = payer;
      let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || "finalized");
      currentTx.recentBlockhash = blockhash;
      txs.push(currentTx);
    }

    return txs;
  }

  public async treasuryWithdraw (
    payer: PublicKey,
    destination: PublicKey,
    treasury: PublicKey,
    amount: number

  ): Promise<Transaction> {

    const treasuryInfo = await getTreasury(this.program, treasury);

    if (!treasuryInfo) {
      throw Error("Treasury not found");
    }

    const treasurer = new PublicKey(treasuryInfo.treasurer as string);
    const associatedToken = new PublicKey(treasuryInfo.associatedToken as string);
    const destinationToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      destination,
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

    let tx = this.program.transaction.treasuryWithdraw(
      new BN(amount),
      {
        accounts: {
          payer: payer,
          treasurer: treasurer,
          destinationAuthority: destination,
          destinationTokenAccount: destinationToken,
          associatedToken: associatedToken,
          treasury: treasury,
          treasuryToken: treasuryToken,
          feeTreasury: Constants.FEE_TREASURY,
          feeTreasuryToken: feeTreasuryToken,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY
        }
      }
    );

    tx.feePayer = payer;
    let { blockhash } = await this.connection.getRecentBlockhash(this.commitment as Commitment || "finalized");
    tx.recentBlockhash = blockhash;

    return tx;
  }
}

