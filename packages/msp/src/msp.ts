/**
 * Solana
 */
import { Commitment, Connection, ConnectionConfig, Keypair, PublicKey, Transaction, Signer, Finality } from "@solana/web3.js";
import { BN, Idl, Program, Provider } from "@project-serum/anchor";

/**
 * MSP
 */
import { StreamInfo, ListStreamParams, TreasuryInfo, TreasuryType, AllocationType } from "./types";
import { createProgram, getStream } from "./utils";
import { Constants } from "./constants";

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

  public getStream = async function (
    id: PublicKey,
    commitment?: Commitment | undefined,
    friendly: boolean = true

  ): Promise<any> {

    throw Error('Not implemented');
  }

  public refreshStream = async function (
    streamInfo: any,
    hardUpdate: boolean = false,
    friendly: boolean = true

  ): Promise<StreamInfo> {

    throw Error('Not implemented');
  }

  public getTreasury = async function (
    id: PublicKey,
    commitment?: Commitment | undefined,
    friendly: boolean = true

  ): Promise<TreasuryInfo> {

    throw Error('Not implemented');
  }

  public listStreams = async function ({
    
    treasurer,
    treasury,
    beneficiary,
    commitment = "confirmed",
    friendly = true

  }: ListStreamParams): Promise<StreamInfo[]> {
    
    throw Error('Not implemented');
  }

  public refreshStreams = async function (
    streams: StreamInfo[],
    treasurer?: PublicKey | undefined,
    treasury?: PublicKey | undefined,
    beneficiary?: PublicKey | undefined,
    commitment?: Commitment | undefined,
    hardUpdate: boolean = false,
    friendly: boolean = true

  ): Promise<StreamInfo[]> {

    throw Error('Not implemented');
  }

  public listStreamActivity = async function (
    id: PublicKey,
    commitment?: Finality | undefined,
    friendly: boolean = true

  ): Promise<any[]> {

    throw Error('Not implemented');
  }

  public listTreasuries = async function (
    treasurer: PublicKey,
    commitment?: Commitment | undefined,
    friendly: boolean = true

  ): Promise<TreasuryInfo[]> {

    throw Error('Not implemented');
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
