/**
 * Solana
 */
import { Commitment, Connection, ConnectionConfig, Keypair, PublicKey, Transaction, Signer, Finality } from "@solana/web3.js";
import { BN, Idl, Program, Provider } from "@project-serum/anchor";

/**
 * MSP
 */
import { StreamInfo, ListStreamParams, TreasuryInfo, TreasuryType, AllocationType } from "./types";
import { createProgram, getStream, getStreamCached, getTreasury, listStreamActivity, listStreams, listStreamsCached } from "./utils";
import { Constants } from "./constants";
import { MintLayout } from "@solana/spl-token";
import { listTreasuries } from ".";

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

  public oneTimePayment = async function (
    treasurer: PublicKey,
    beneficiary: PublicKey,
    associatedToken: PublicKey,
    amount: number,
    startUtc?: Date,
    streamName?: string

  ): Promise<Transaction> {

    throw Error('Not implemented');
  }

  public createTreasury = async function (
    treasurer: PublicKey,
    label: string,
    type: TreasuryType,
    autoClose: boolean = false

  ): Promise<Transaction> {

    throw Error('Not implemented');
  }

  public createStream = async function (
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
    rateCliffInSeconds?: number,
    cliffVestAmount?: number,
    cliffVestPercent?: number,
    autoPauseInSeconds?: number

  ): Promise<Transaction> {

    throw Error('Not implemented');
  }

  public addFunds = async function (
    contributor: PublicKey,
    treasury: PublicKey,
    stream: PublicKey | undefined,
    associatedToken: PublicKey,
    amount: number,
    allocationType: AllocationType

  ): Promise<Transaction> {

    throw Error('Not implemented');
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
