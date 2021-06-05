import { Buffer } from 'buffer';
import { Layout } from './layout';
import { u64Number } from './u64Number';
import * as Utils from './utils';

import {
    Commitment,
    Connection,
    GetProgramAccountsConfig,
    Keypair,
    PublicKey,
    Signer,
    SystemProgram,
    Transaction,
    TransactionInstruction

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
    memo: String,
    treasurerAddress: PublicKey | undefined,
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
    totalWithdrawals: number,
    isStreaming: boolean,
    isUpdatePending: boolean
}

/**
 * API class with functions to interact with the Money Streaming Program using Solana Web3 JS API 
 */
export class MoneyStreaming {

    private connection: Connection;

    private programId: PublicKey;
    private feePayer: PublicKey;

    private defaultStream: StreamInfo = {
        id: undefined,
        initialized: false,
        memo: "",
        treasurerAddress: undefined,
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
        totalWithdrawals: 0,
        isStreaming: false,
        isUpdatePending: false
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
        this.connection = new Connection(cluster, 'confirmed');
        this.programId = new PublicKey(Constants.STREAM_PROGRAM_ACCOUNT);
        this.feePayer = new PublicKey(Constants.STREAM_PROGRAM_PAYER_ACCOUNT);
    }

    public async getStream(
        id: PublicKey,
        commitment?: Commitment | undefined

    ): Promise<StreamInfo> {

        return await Utils.getStream(
            this.connection,
            id,
            commitment,
            true
        )
    }

    public async listStreams(
        treasurer?: PublicKey | undefined,
        beneficiary?: PublicKey | undefined,
        commitment?: GetProgramAccountsConfig | Commitment | undefined

    ): Promise<StreamInfo[]> {

        return await Utils.listStreams(
            this.connection,
            this.programId,
            treasurer,
            beneficiary,
            commitment,
            false
        );
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

        let treasuryKey = treasury;
        let treasuryAccount;

        if (treasuryKey === null) {
            const minBalanceForTreasury = await this.connection.getMinimumBalanceForRentExemption(0);
            treasuryAccount = Keypair.generate();
            treasuryKey = treasuryAccount.publicKey;

            transaction.add(
                SystemProgram.createAccount({
                    fromPubkey: treasurer,
                    newAccountPubkey: treasuryKey,
                    lamports: minBalanceForTreasury,
                    space: 0,
                    programId: this.programId,
                }),
            );
        }

        const minBalanceForStream = await this.connection.getMinimumBalanceForRentExemption(
            Layout.streamLayout.span
        );

        const streamAccount = Keypair.generate();

        transaction.add(
            SystemProgram.createAccount({
                fromPubkey: treasurer,
                newAccountPubkey: streamAccount.publicKey,
                lamports: minBalanceForStream,
                space: Layout.streamLayout.span,
                programId: this.programId,
            }),
        );

        transaction.add(
            MoneyStreaming.createStreamInstruction(
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

        transaction.feePayer = treasurer;
        let hash = await this.connection.getRecentBlockhash('confirmed');
        transaction.recentBlockhash = hash.blockhash;
        let signers: Array<Signer> = [streamAccount];

        if (treasuryAccount !== undefined) {
            signers.push(treasuryAccount);
        }

        transaction.partialSign(...signers);

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
                MoneyStreaming.addFundsInstruction(
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

            console.log("Sending transaction to wallet for approval...");
            let signedTrans = await wallet.signTransaction(transaction);
            return signedTrans;
        } catch (error) {
            console.log("signTransaction failed!");
            console.log(error);
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
            const result = await this.connection.confirmTransaction(signature, 'confirmed');
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
            { pubkey: treasury, isSigner: false, isWritable: false },
            { pubkey: stream, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: new PublicKey(Constants.MEAN_FI_ACCOUNT), isSigner: false, isWritable: true }
        ];

        let data = Buffer.alloc(Layout.createStreamLayout.span)
        {
            let nameBuffer = Buffer.alloc(32, streamName as string, 'utf-8');

            const decodedData = {
                tag: 0,
                stream_name: nameBuffer,
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
}
