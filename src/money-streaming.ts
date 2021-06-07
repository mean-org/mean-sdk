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
import { Instructions } from './instructions';
import EventEmitter from 'eventemitter3';

export interface WalletAdapter extends EventEmitter {
    publicKey: PublicKey | null;
    signTransaction: (transaction: Transaction) => Promise<Transaction>;
    connect: () => any;
    disconnect: () => any;
}

export type StreamInfo = {
    id: PublicKey | string | undefined,
    initialized: boolean,
    memo: String,
    treasurerAddress: PublicKey | string | undefined,
    rateAmount: number,
    rateIntervalInSeconds: number,
    startUtc: Date | string | undefined,
    rateCliffInSeconds: number,
    cliffVestAmount: number,
    cliffVestPercent: number,
    beneficiaryAddress: PublicKey | string | undefined,
    associatedToken: PublicKey | string | undefined,
    escrowVestedAmount: number,
    escrowUnvestedAmount: number,
    treasuryAddress: PublicKey | string | undefined,
    escrowEstimatedDepletionUtc: Date | null,
    totalDeposits: number,
    totalWithdrawals: number,
    isStreaming: boolean,
    isUpdatePending: boolean
    transactionSignature: string | undefined,
    blockTime: number,
}

/**
 * API class with functions to interact with the Money Streaming Program using Solana Web3 JS API 
 */
export class MoneyStreaming {

    private connection: Connection;

    private programId: PublicKey;
    private feePayer: PublicKey;

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
        this.programId = Constants.STREAM_PROGRAM_ADDRESS.toPublicKey();
        this.feePayer = Constants.STREAM_PROGRAM_PAYER_ADRESS.toPublicKey();
    }

    public async getStream(
        id: PublicKey,
        commitment?: Commitment | undefined,
        friendly: boolean = true

    ): Promise<StreamInfo> {

        return await Utils.getStream(
            this.connection,
            id,
            commitment,
            friendly
        );
    }

    public async listStreams(
        treasurer?: PublicKey | undefined,
        beneficiary?: PublicKey | undefined,
        commitment?: GetProgramAccountsConfig | Commitment | undefined,
        friendly: boolean = true

    ): Promise<StreamInfo[]> {

        return await Utils.listStreams(
            this.connection,
            this.programId,
            treasurer,
            beneficiary,
            commitment,
            friendly
        );
    }

    public async getCreateStreamTransaction(
        treasurer: PublicKey,
        beneficiary: PublicKey,
        treasury: PublicKey | null,
        associatedToken: PublicKey,
        rateAmount: number = 1,
        rateIntervalInSeconds: number = 60,
        startUtc: Date,
        streamName?: String,
        fundingAmount?: number,
        rateCliffInSeconds?: number,
        cliffVestAmount?: number,
        cliffVestPercent?: number

    ): Promise<Transaction> {

        const transaction = new Transaction();

        let treasuryAddress = treasury;
        let treasuryAccount;

        // Create treasury account
        if (treasuryAddress === null) {
            treasuryAccount = Keypair.generate();
            treasuryAddress = treasuryAccount.publicKey;

            const mintInfo = await this.connection.getAccountInfo(associatedToken);

            if (mintInfo == null) {
                throw Error('Invalid mint account');
            }

            const minBalanceForATokenAcount = await this.connection.getMinimumBalanceForRentExemption(mintInfo.data.length);

            transaction.add(
                SystemProgram.createAccount({
                    fromPubkey: treasurer,
                    newAccountPubkey: treasuryAddress,
                    lamports: minBalanceForATokenAcount,
                    space: 0,
                    programId: this.programId,
                }),
            );
        }

        // Create stream account
        const minBalanceForStream = await this.connection.getMinimumBalanceForRentExemption(Layout.streamLayout.span);
        const streamAccount = Keypair.generate();

        transaction.add(
            SystemProgram.createAccount({
                fromPubkey: treasurer,
                newAccountPubkey: streamAccount.publicKey,
                lamports: minBalanceForStream,
                space: Layout.streamLayout.span,
                programId: this.programId,
            })
        );

        const treasuryATokenAddress = await Utils.findATokenAddress(
            treasuryAddress,
            associatedToken
        );

        let treasuryATokenAccountInfo = await this.connection.getAccountInfo(treasuryATokenAddress);

        if (treasuryATokenAccountInfo == null) { // Create treasury associated token address            
            transaction.add(
                await Instructions.createATokenAccountInstruction(
                    treasuryATokenAddress,
                    treasurer,
                    treasuryAddress,
                    associatedToken
                )
            );
        }

        let treasurerATokenAddress = await Utils.findATokenAddress(
            treasurer,
            associatedToken
        );

        // Create stream contract
        transaction.add(
            await Instructions.createStreamInstruction(
                this.connection,
                this.programId,
                treasurer,
                treasurerATokenAddress,
                treasuryAddress,
                treasuryATokenAddress,
                streamAccount.publicKey,
                beneficiary,
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
            MoneyStreaming.addFundsInstruction(
                this.programId,
                treasury,
                stream,
                contributor,
                contributorToken,
                amount
            )
        );

        return transaction;
    }

    public async getWithdrawTransaction(
        stream_id: PublicKey,
        beneficiary: PublicKey,
        associatedToken: PublicKey,
        amount: number

    ): Promise<Transaction> {

        let streamInfo = await Utils.getStream(
            this.connection,
            stream_id
        );

        if (streamInfo.beneficiaryAddress !== beneficiary) {
            throw Error('Unauthorized');
        }

        const transaction = new Transaction();

        // Check for the beneficiary associated token account
        const beneficiaryATokenAddress = await Utils.findATokenAddress(
            beneficiary,
            associatedToken
        );

        let beneficiaryATokenAccountInfo = await this.connection.getAccountInfo(beneficiaryATokenAddress);

        if (beneficiaryATokenAccountInfo == null) { // Create beneficiary associated token address
            transaction.add(
                await Instructions.createATokenAccountInstruction(
                    beneficiaryATokenAddress,
                    beneficiary,
                    beneficiary,
                    associatedToken
                )
            );
        }

        const keys = [
            { pubkey: beneficiary, isSigner: false, isWritable: false },
            { pubkey: stream_id, isSigner: false, isWritable: true },
            { pubkey: streamInfo.treasuryAddress as PublicKey, isSigner: false, isWritable: false }
        ];

        let data = Buffer.alloc(Layout.withdrawLayout.span)
        {
            const decodedData = {
                tag: 2,
                withdrawal_amount: amount
            };

            const encodeLength = Layout.withdrawLayout.encode(decodedData, data);
            data = data.slice(0, encodeLength);
        };

        let programId = Constants.STREAM_PROGRAM_ADDRESS.toPublicKey();

        return transaction.add(new TransactionInstruction({
            keys,
            programId,
            data,
        }));
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
