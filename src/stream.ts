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

import { sendAndConfirmTransaction } from '@solana/web3.js';
import * as Layout from './layout';
import { u64Number } from './u64Number';

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

    /**
     * @private
     */
    connection: Connection;
    programId: PublicKey;
    payer: Signer;

    /**
     * Create a Streaming API object
     *
     * @param connection The connection to use
     * @param programId token programId
     * @param payer Payer of fees
     */
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

    static async authorizeWallet() {

    }

    static async createStream(
        signer: Signer,
        treasurer: PublicKey,
        beneficiary: PublicKey,
        treasury: PublicKey,
        associatedToken: PublicKey,
        rateAmount: number,
        rateIntervalInSeconds: number,
        startUtc: Date,
        streamName?: String,
        fundingAmount?: number,
        rateCliffInSeconds?: number,
        cliffVestAmount?: number,
        cliffVestPercent?: number

    ): Promise<string> {

        const transaction = new Transaction();

        let treasuryKey = treasury;
        let treasuryAccount: Keypair;

        if (treasuryKey !== null) {
            const minBalanceForTreasury = await this.prototype.connection.getMinimumBalanceForRentExemption(0);
            treasuryAccount = Keypair.generate();
            treasuryKey = treasuryAccount.publicKey;

            transaction.add(
                SystemProgram.createAccount({
                    fromPubkey: this.prototype.payer.publicKey,
                    newAccountPubkey: treasuryKey,
                    lamports: minBalanceForTreasury,
                    space: 0,
                    programId: this.prototype.programId,
                }),
            );
        }

        const minBalanceForStream = await this.prototype.connection.getMinimumBalanceForRentExemption(
            Layout.StreamLayout.span
        );

        const streamAccount = Keypair.generate();

        transaction.add(
            SystemProgram.createAccount({
                fromPubkey: this.prototype.payer.publicKey,
                newAccountPubkey: streamAccount.publicKey,
                lamports: minBalanceForStream,
                space: Layout.StreamLayout.span,
                programId: this.prototype.programId,
            }),
        );

        transaction.add(
            Streaming.createStreamInstruction(
                this.prototype.programId,
                treasurer,
                beneficiary,
                treasuryKey,
                streamAccount.publicKey,
                associatedToken,
                rateAmount,
                rateIntervalInSeconds || 60,
                startUtc.valueOf() || Date.now(),
                streamName || "",
                fundingAmount || 0,
                rateCliffInSeconds || 0,
                cliffVestAmount || 0,
                cliffVestPercent || 100
            ),
        );

        let { blockhash } = await this.prototype.connection.getRecentBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = treasurer;
        transaction.sign(signer);

        return await this.prototype.connection.sendTransaction(
            transaction,
            [signer],
            {
                skipPreflight: false, preflightCommitment: 'singleGossip'
            });
    }

    static async addFunds(
        signer: Signer,
        treasury: PublicKey,
        stream: PublicKey,
        contributor: PublicKey,
        contributorToken: PublicKey,
        amount: number

    ): Promise<boolean> {

        const transaction = new Transaction();

        transaction.add(
            transaction.add(
                Streaming.addFundsInstruction(
                    this.prototype.programId,
                    treasury,
                    stream,
                    contributor,
                    contributorToken,
                    amount
                )
            )
        );

        let { blockhash } = await this.prototype.connection.getRecentBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = contributor;
        transaction.sign(signer);

        let txId = await this.prototype.connection.sendTransaction(
            transaction,
            [signer],
            {
                skipPreflight: false, preflightCommitment: 'singleGossip'
            });

        if (txId.length) {
            return true;
        }

        false;
    }

    static async withdraw(
        from: PublicKey,
        amount: number

    ): Promise<boolean> {
        return false;
    }

    static createStreamInstruction(
        programId: PublicKey,
        treasurer: PublicKey,
        beneficiary: PublicKey,
        treasury: PublicKey,
        stream: PublicKey,
        associatedToken: PublicKey,
        rateAmount: number,
        rateIntervalInSeconds: number,
        startUtcNow: number,
        streamName?: String,
        fundingAmount?: number,
        rateCliffInSeconds?: number,
        cliffVestAmount?: number,
        cliffVestPercent?: number

    ): TransactionInstruction {
        const keys = [
            { pubkey: treasurer, isSigner: false, isWritable: true },
            { pubkey: beneficiary, isSigner: false, isWritable: false },
            { pubkey: treasury, isSigner: false, isWritable: false },
            { pubkey: stream, isSigner: false, isWritable: false },
        ];

        let data = Buffer.alloc(Layout.createStreamLayout.span)
        {
            const decodedData = {
                tag: 0,
                stream_name: streamName,
                treasurer_address: Buffer.from(treasurer.toBuffer()),
                treasury_address: Buffer.from(treasury.toBuffer()),
                beneficiary_withdrawal_address: Buffer.from(beneficiary.toBuffer()),
                escrow_token_address: Buffer.from(associatedToken.toBuffer()),
                funding_amount: new u64Number(fundingAmount).toBuffer(),
                rate_amount: new u64Number(rateAmount).toBuffer(),
                rate_interval_in_seconds: new u64Number(rateIntervalInSeconds).toBuffer(), // default = MIN
                start_utc: new u64Number(startUtcNow).toBuffer(),
                rate_cliff_in_seconds: new u64Number(rateCliffInSeconds).toBuffer(),
                cliff_vest_amount: new u64Number(cliffVestAmount).toBuffer(),
                cliff_vest_percent: new u64Number(cliffVestPercent).toBuffer(),
            };

            const encodeLength = Layout.createStreamLayout.encode(decodedData, data);
            data = data.slice(0, encodeLength);
        };

        return new TransactionInstruction({
            keys,
            programId,
            data,
        });
    }

    static addFundsInstruction(
        programId: PublicKey,
        treasury: PublicKey,
        stream: PublicKey,
        contributor: PublicKey,
        contributionToken: PublicKey,
        amount: number

    ): TransactionInstruction {

        const keys = [
            { pubkey: contributor, isSigner: false, isWritable: true },
            { pubkey: stream, isSigner: false, isWritable: false },
            { pubkey: treasury, isSigner: false, isWritable: false }
        ];

        let data = Buffer.alloc(Layout.addFundsLayout.span)
        {
            const decodedData = {
                tag: 1,
                contributor_token_address: Buffer.from(contributionToken.toBuffer()),
                contribution_amount: new u64Number(amount).toBuffer()
            };

            const encodeLength = Layout.createStreamLayout.encode(decodedData, data);
            data = data.slice(0, encodeLength);
        };

        return new TransactionInstruction({
            keys,
            programId,
            data,
        });
    }
}