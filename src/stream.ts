import { Buffer } from 'buffer';
import { Layout } from './layout';
import { u64Number } from './u64Number';

import {
    Connection,
    Keypair,
    PublicKey,
    Struct,
    SystemProgram,
    Transaction,
    TransactionInstruction,
} from '@solana/web3.js';

import { Constants } from './constants';
import EventEmitter from 'eventemitter3';

export interface WalletAdapter extends EventEmitter {
    publicKey: PublicKey | null;
    signTransaction: (transaction: Transaction) => Promise<Transaction>;
    connect: () => any;
    disconnect: () => any;
}

export type StreamInfo = {
    id: PublicKey | undefined,
    initialized: boolean,
    streamName: String,
    treasurerAddress: PublicKey | undefined,
    fundingAmount: number,
    rateAmount: number,
    rateIntervalInSeconds: number,
    startUtc: Date | null,
    rateCliffInSeconds: number,
    cliffVestAmount: number,
    cliffVestPercent: number,
    beneficiaryWithdrawalAddress: PublicKey | undefined,
    escrowTokenAddress: PublicKey | undefined,
    escrowVestedAmount: number,
    escrowUnvestedAmount: number,
    treasuryAddress: PublicKey | undefined,
    escrowEstimatedDepletionUtc: Date | null,
    totalDeposits: number,
    totalWithdrawals: number
}

/**
 * API class with functions to interact with the Money Streaming Program using Solana Web3 JS API 
 */
export class Streaming {

    private connection: Connection;

    private programId: PublicKey;

    private defaultStream: StreamInfo = {
        id: undefined,
        initialized: false,
        streamName: "",
        treasurerAddress: undefined,
        fundingAmount: 0,
        rateAmount: 0,
        rateIntervalInSeconds: 0,
        startUtc: null,
        rateCliffInSeconds: 0,
        cliffVestAmount: 0,
        cliffVestPercent: 0,
        beneficiaryWithdrawalAddress: undefined,
        escrowTokenAddress: undefined,
        escrowVestedAmount: 0,
        escrowUnvestedAmount: 0,
        treasuryAddress: undefined,
        escrowEstimatedDepletionUtc: null,
        totalDeposits: 0,
        totalWithdrawals: 0
    };

    /**
     * Create a Streaming API object
     *
     * @param cluster The solana cluster endpoint used for the connecton
     */
    constructor(cluster: string) {
        // Object.assign(this, {
        //     connection,
        //     programId
        // });
        this.connection = new Connection(cluster);
        this.programId = new PublicKey(Constants.STREAM_PROGRAM_ID);
    }

    public async getStream(
        id: PublicKey

    ): Promise<StreamInfo> {

        let stream: StreamInfo = this.defaultStream;
        let accountInfo = await this.connection.getAccountInfo(id);

        if (accountInfo?.data !== undefined && accountInfo?.data.length === Layout.StreamLayout.span) {
            stream = Streaming.parseStreamData(id, accountInfo?.data);
        }

        return stream;
    }

    public async listStreams(
        treasurer?: undefined | PublicKey,
        beneficiary?: undefined | PublicKey

    ): Promise<StreamInfo[]> {

        let streams: StreamInfo[] = [];
        const accounts = await this.connection.getProgramAccounts(this.programId, 'singleGossip');

        if (accounts === null || !accounts.length) {
            return streams;
        }

        for (var item of accounts) {

            if (item.account.data !== undefined && item.account.data.length === Layout.StreamLayout.span) {
                var info = Streaming.parseStreamData(
                    item.pubkey,
                    item.account.data
                );

                if (info !== null) {
                    streams.push(info);
                }
            }
        }

        if (!streams.length) return streams;

        if (treasurer !== undefined) {
            streams = streams.filter(function (s, index) {
                return s.treasurerAddress === treasurer;
            });
        }

        if (beneficiary !== undefined) {
            streams = streams.filter(function (s, index) {
                return s.beneficiaryWithdrawalAddress === beneficiary;
            });
        }

        return streams;
    }

    public async getCreateStreamTransaction(
        treasurer: PublicKey,
        beneficiary: PublicKey,
        treasury: PublicKey | null,
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

        let payerKey = new PublicKey(Constants.STREAM_PROGRAM_PAYER_ID);
        let treasuryKey = treasury;
        let treasuryAccount = Keypair.generate();

        if (treasuryKey === null) {
            const minBalanceForTreasury = await this.connection.getMinimumBalanceForRentExemption(0);
            treasuryAccount = Keypair.generate();
            treasuryKey = treasuryAccount.publicKey;

            transaction.add(
                SystemProgram.createAccount({
                    fromPubkey: payerKey,
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
                fromPubkey: payerKey,
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

    public async getAddFundsTransaction(
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

    public static async withdraw(
        from: PublicKey,
        amount: number

    ): Promise<boolean> {
        return false;
    }

    public async signTransaction(
        wallet: WalletAdapter,
        transaction: Transaction
    ): Promise<Transaction> {
        try {
            let signedTrans = await wallet.signTransaction(transaction);
            console.log("sign transaction");
            return signedTrans;
        } catch (error) {
            throw error;
        }
    }

    public async sendSignedTransaction(signedTrans: Transaction): Promise<string> {
        try {
            let signature = await this.connection.sendRawTransaction(signedTrans.serialize());
            console.log("send raw transaction");
            return signature;
        } catch (error) {
            throw error;
        }
    }

    public async confirmTransaction(signature: any): Promise<any> {
        try {
            const result = await this.connection.confirmTransaction(signature, "singleGossip");
            console.log("send raw transaction");
            return result;
        } catch (error) {
            throw error;
        }
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
            { pubkey: contributor, isSigner: true, isWritable: false },
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
        streamData: Buffer

    ): StreamInfo {

        let stream: StreamInfo = Object.assign({}, this.prototype.defaultStream);
        let decodedData = Layout.StreamLayout.decode(streamData);
        let totalDeposits = parseFloat(u64Number.fromBuffer(decodedData.total_deposits).toString());
        let totalWithdrawals = parseFloat(u64Number.fromBuffer(decodedData.total_withdrawals).toString());
        let startUtc = parseInt(u64Number.fromBuffer(decodedData.start_utc).toString());
        let startDateUtc = new Date();

        startDateUtc.setDate(startUtc);

        let rateAmount = parseFloat(u64Number.fromBuffer(decodedData.funding_amount).toString());
        let rateCliffInSeconds = parseFloat(u64Number.fromBuffer(decodedData.rate_cliff_in_seconds).toString());
        let escrowVestedAmount = (rateAmount / rateCliffInSeconds) * (Date.now() - startUtc).valueOf();
        let escrowEstimatedDepletionUtc = u64Number.fromBuffer(decodedData.escrow_estimated_depletion_utc).toNumber();
        let escrowEstimatedDepletionDateUtc = new Date();

        escrowEstimatedDepletionDateUtc.setDate(escrowEstimatedDepletionUtc);

        Object.assign(stream, { id: streamId }, {
            initialized: decodedData.initialized,
            streamName: decodedData.stream_name,
            treasurerAddress: Struct.decode(decodedData.treasurer_address),
            fundingAmount: parseFloat(u64Number.fromBuffer(decodedData.funding_amount).toString()),
            rateAmount: rateAmount,
            rateIntervalInSeconds: rateCliffInSeconds,
            startUtc: startDateUtc,
            rateCliffInSeconds: parseFloat(u64Number.fromBuffer(decodedData.rate_cliff_in_seconds).toString()),
            cliffVestAmount: parseFloat(u64Number.fromBuffer(decodedData.cliff_vest_amount).toString()),
            cliffVestPercent: parseFloat(u64Number.fromBuffer(decodedData.cliff_vest_percent).toString()),
            beneficiaryWithdrawalAddress: Struct.decode(decodedData.beneficiary_withdrawal_address),
            escrowTokenAddress: Struct.decode(decodedData.escrow_token_address),
            escrowVestedAmount: escrowVestedAmount,
            escrowUnvestedAmount: totalDeposits - totalWithdrawals - escrowVestedAmount,
            treasuryAddress: Struct.decode(decodedData.treasurer_address),
            escrowEstimatedDepletionUtc: escrowEstimatedDepletionDateUtc,
            totalDeposits: totalDeposits,
            totalWithdrawals: totalWithdrawals
        });

        return stream;
    }
}
