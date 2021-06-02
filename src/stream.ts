import { Buffer } from 'buffer';
// import * as assert from 'assert';
// import * as BN from 'bn.js';
// import * as BufferLayout from 'buffer-layout';
import { Layout } from './layout';
import { u64Number } from './u64Number';

import {
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    SYSVAR_RENT_PUBKEY,
    Struct,
    ParsedAccountData

} from '@solana/web3.js';

import type {
    Connection,
    Commitment,
    Signer,
    TransactionSignature

} from '@solana/web3.js';
import { sign } from 'crypto';

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
    connection!: Connection;

    programId!: PublicKey;

    payer!: Signer;

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

    // static async getStream(
    //     id: PublicKey

    // ): Promise<StreamInfo> {

    //     return false;
    // }

    async listStreams(
        treasurer: null | PublicKey,
        beneficiary: null | PublicKey

    ): Promise<Array<StreamInfo>> {

        let streams: Array<StreamInfo> = new Array<StreamInfo>();
        const parsedAccounts = await this.connection.getParsedProgramAccounts(this.programId);

        if (parsedAccounts === null || !parsedAccounts.length) {
            return streams;
        }

        for (var item of parsedAccounts) {
            let publicKey = item.pubkey;
            let data = item.account.data;
            let info = Streaming.parseStreamData(publicKey, data);

            if (info !== null) {
                streams.push(info);
            }
        }

        return streams;
    }

    // static async authorizeWallet() {

    // }

    async getCreateStreamTransaction(
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

    ): Promise<Transaction> {

        const transaction = new Transaction();

        let treasuryKey = treasury;
        let treasuryAccount = Keypair.generate();

        if (treasuryKey === null) {
            const minBalanceForTreasury = await this.connection.getMinimumBalanceForRentExemption(0);
            treasuryAccount = Keypair.generate();
            treasuryKey = treasuryAccount.publicKey;

            transaction.add(
                SystemProgram.createAccount({
                    fromPubkey: this.payer.publicKey,
                    newAccountPubkey: treasuryKey,
                    lamports: minBalanceForTreasury,
                    space: 0,
                    programId: this.programId,
                }),
            );
        }

        const minBalanceForStream = await this.connection.getMinimumBalanceForRentExemption(
            Layout.StreamLayout.span
        );

        const streamAccount = Keypair.generate();

        transaction.add(
            SystemProgram.createAccount({
                fromPubkey: this.payer.publicKey,
                newAccountPubkey: streamAccount.publicKey,
                lamports: minBalanceForStream,
                space: Layout.StreamLayout.span,
                programId: this.programId,
            }),
        );

        transaction.add(
            Streaming.createStreamInstruction(
                this.programId,
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

        return transaction;
    }

    async getAddFundsTransaction(
        signer: Signer,
        treasury: PublicKey,
        stream: PublicKey,
        contributor: PublicKey,
        contributorToken: PublicKey,
        amount: number

    ): Promise<Transaction> {

        const transaction = new Transaction();

        transaction.add(
            transaction.add(
                Streaming.addFundsInstruction(
                    this.programId,
                    treasury,
                    stream,
                    contributor,
                    contributorToken,
                    amount
                )
            )
        );

        return transaction;
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
            { pubkey: treasurer, isSigner: true, isWritable: false },
            { pubkey: beneficiary, isSigner: false, isWritable: false },
            { pubkey: treasury, isSigner: false, isWritable: false },
            { pubkey: stream, isSigner: false, isWritable: true },
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
                funding_amount: new u64Number(fundingAmount || 0).toBuffer(),
                rate_amount: new u64Number(rateAmount).toBuffer(),
                rate_interval_in_seconds: new u64Number(rateIntervalInSeconds).toBuffer(), // default = MIN
                start_utc: new u64Number(startUtcNow).toBuffer(),
                rate_cliff_in_seconds: new u64Number(rateCliffInSeconds || 0).toBuffer(),
                cliff_vest_amount: new u64Number(cliffVestAmount || 0).toBuffer(),
                cliff_vest_percent: new u64Number(cliffVestPercent || 100).toBuffer(),
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

    static parseStreamData(
        streamId: PublicKey,
        streamData: Buffer | ParsedAccountData

    ): null | StreamInfo {
        return null;
    }
}