import { Buffer } from 'buffer';
import assert from 'assert';
import BN from 'bn.js';
import * as BufferLayout from 'buffer-layout';

import {
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    SYSVAR_RENT_PUBKEY

} from '@solana/web3.js';

import type {
    Connection,
    Commitment,
    Signer,
    TransactionSignature

} from '@solana/web3.js';

import * as Layout from './layout';

export type StreamInfo = {
    initialized: boolean,
    streamName: String,
    treasurerAddress: PublicKey,
    fundingAmount: number,
    rateAmount: number,
    rateIntervalInSeconds: number,
    startUtc: Date,
    rateCliffInSeconds: number,
    cliffVestAmount: number,
    cliffVestPercent: number,
    beneficiaryWithdrawalAddress: PublicKey,
    escrowTokenAddress: PublicKey,
    escrowVestedAmount: number,
    escrowUnvestedAmount: number,
    treasuryAddress: PublicKey,
    escrowEstimatedDepletionUtc: number,
    totalDeposits: number
}

/**
 * API class with functions to interact with the Money Streaming Program using Solana Web3 JS API 
 */
export class Streaming {

    connection: Connection;
    programId: PublicKey;
    payer: Signer;

    constructor(
        connection: Connection,
        programId: PublicKey,
        payer: Signer,
    ) {
        Object.assign(this, {
            connection,
            programId,
            payer
        });
    }

    static async getStream(
        id: PublicKey

    ): Promise<StreamInfo> {

        return null;
    }

    static async listStreams(
        treasurer: null | PublicKey,
        beneficiary: null | PublicKey

    ): Promise<Array<StreamInfo>> {

        return null;
    }

    static async createStream(
        treasurer: PublicKey,
        beneficiary: PublicKey,
        treasury: PublicKey,
        associatedToken: PublicKey,
        streamName: String,
        fundingAmount: number,
        rateAmount: number,
        rateIntervalInSeconds: number,
        startUtc: Date

    ): Promise<StreamInfo> {
        return null;
    }

    static async addFunds(
        from: PublicKey,
        to: PublicKey,
        contributionToken: PublicKey,
        amount: number

    ): Promise<boolean> {
        return false;
    }

    static async withdraw(
        from: PublicKey,
        amount: number

    ): Promise<boolean> {
        return false;
    }
}