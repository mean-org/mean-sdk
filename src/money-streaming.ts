import { Buffer } from 'buffer';
import { Layout } from './layout';
import { u64Number } from './u64Number';
import * as Utils from './utils';

import {
    Commitment,
    Connection,
    ConnectionConfig,
    GetProgramAccountsConfig,
    Keypair,
    PublicKey,
    Signer,
    SystemProgram,
    Transaction,
    TransactionInstruction

} from '@solana/web3.js';

import { Constants, ErrorConstants } from './constants';
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
    escrowEstimatedDepletionUtc: Date | string | undefined,
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
    private commitment: Commitment | ConnectionConfig | undefined;

    /**
     * Create a Streaming API object
     *
     * @param cluster The solana cluster endpoint used for the connecton
     */
    constructor(
        cluster: string,
        commitment: Commitment | ConnectionConfig | string = 'finalized'
    ) {
        this.connection = new Connection(cluster, commitment as Commitment);
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
        // treasury: PublicKey | null,
        associatedToken: PublicKey,
        rateAmount: number = 1,
        rateIntervalInSeconds: number = 60,
        startUtc?: Date,
        streamName?: String,
        fundingAmount?: number,
        rateCliffInSeconds?: number,
        cliffVestAmount?: number,
        cliffVestPercent?: number

    ): Promise<Transaction> {

        const treasurerTokenAccountKey = await Utils.findATokenAddress(treasurer, associatedToken);
        const treasurerTokenAccountInfo = await this.connection.getAccountInfo(treasurerTokenAccountKey);

        if (treasurerTokenAccountInfo === null) {
            throw Error('Invalid associated token address');
        }

        const transaction = new Transaction();
        // Create stream account
        const streamAccount = Keypair.generate();
        const streamMinimumBalance = await this.connection.getMinimumBalanceForRentExemption(Layout.streamLayout.span);

        transaction.add(
            SystemProgram.createAccount({
                fromPubkey: treasurer,
                newAccountPubkey: streamAccount.publicKey,
                lamports: streamMinimumBalance,
                space: Layout.streamLayout.span,
                programId: this.programId
            })
        );

        const [treasuryAccountKey, _] = await Utils.findMSPAddress(streamAccount.publicKey, this.programId);
        const treasuryTokenAccountKey = await Utils.findATokenAddress(treasuryAccountKey, associatedToken);
        const treasuryTokenAccountInfo = await this.connection.getAccountInfo(treasuryTokenAccountKey);

        if (treasuryTokenAccountInfo === null) {
            transaction.add(
                await Instructions.createATokenAccountInstruction(
                    treasuryTokenAccountKey,
                    treasurer,
                    treasuryAccountKey,
                    associatedToken
                )
            );
        }

        // Create stream contract
        transaction.add(
            await Instructions.createStreamInstruction(
                this.programId,
                treasurer,
                treasurerTokenAccountKey,
                treasuryAccountKey,
                treasuryTokenAccountKey,
                streamAccount.publicKey,
                associatedToken,
                beneficiary,
                rateAmount,
                rateIntervalInSeconds || 60,
                startUtc?.valueOf() || Date.parse(new Date().toUTCString()),
                streamName || "",
                fundingAmount || 0,
                rateCliffInSeconds || 0,
                cliffVestAmount || 0,
                cliffVestPercent || 100
            ),
        );

        // console.log('Creating stream contract');

        transaction.feePayer = treasurer;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        transaction.recentBlockhash = hash.blockhash;
        transaction.partialSign(streamAccount);

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

        transaction.feePayer = contributor;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        transaction.recentBlockhash = hash.blockhash;

        return transaction;
    }

    public async getWithdrawTransaction(
        streamId: PublicKey,
        beneficiary: PublicKey,
        amount: number

    ): Promise<Transaction> {

        let streamInfo = await Utils.getStream(
            this.connection,
            streamId
        );

        if (beneficiary.toBase58() !== streamInfo.beneficiaryAddress as string) {
            throw Error('Unauthorized');
        }

        const transaction = new Transaction();
        // Check for the beneficiary associated token account
        const mintTokenAccountKey = new PublicKey(streamInfo.associatedToken as PublicKey);
        const beneficiaryTokenAccountKey = await Utils.findATokenAddress(
            beneficiary,
            mintTokenAccountKey
        );

        let beneficiaryAccountInfo = await this.connection.getAccountInfo(beneficiary);

        if (beneficiaryAccountInfo === null) {
            throw MSPError(ErrorConstants.AccountNotCredited, `Beneficiary wallet account ${beneficiary} not credited`);
        }

        let beneficiaryTokenAccountInfo = await this.connection.getAccountInfo(beneficiaryTokenAccountKey);

        if (beneficiaryTokenAccountInfo === null) { // Create beneficiary associated token address
            transaction.add(
                await Instructions.createATokenAccountInstruction(
                    beneficiaryTokenAccountKey,
                    beneficiary,
                    beneficiary,
                    mintTokenAccountKey
                )
            );
        }

        const treasuryAccountKey = new PublicKey(streamInfo.treasuryAddress as PublicKey);
        const treasuryTokenAccountKey = await Utils.findATokenAddress(
            treasuryAccountKey,
            mintTokenAccountKey
        )

        transaction.add(
            await Instructions.createWithdrawInstruction(
                this.programId,
                beneficiary,
                beneficiaryTokenAccountKey,
                mintTokenAccountKey,
                treasuryAccountKey,
                treasuryTokenAccountKey,
                streamId,
                amount
            )
        );

        transaction.feePayer = beneficiary;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        transaction.recentBlockhash = hash.blockhash;

        return transaction;
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

    public async closeStreamTransaction(
        streamId: PublicKey,
        initializer: PublicKey

    ): Promise<Transaction> {

        let streamInfo = await Utils.getStream(
            this.connection,
            streamId
        );

        let counterparty: PublicKey;

        if (initializer.toBase58() === streamInfo.treasurerAddress as string) {
            counterparty = new PublicKey(streamInfo.beneficiaryAddress as string);
        } else if (initializer.toBase58() === streamInfo.beneficiaryAddress as string) {
            counterparty = new PublicKey(streamInfo.treasurerAddress as string);
        } else {
            throw Error('Not allowed to close a stream');
        }

        const transaction = new Transaction();
        const beneficiaryAccountKey = new PublicKey(streamInfo.beneficiaryAddress as string);
        const mintAccountKey = new PublicKey(streamInfo.associatedToken as string);
        const beneficiaryTokenAccountKey = await Utils.findATokenAddress(
            beneficiaryAccountKey,
            mintAccountKey,
        );

        const beneficiaryTokenAddressAccountInfo = await this.connection.getAccountInfo(beneficiaryTokenAccountKey);

        if (beneficiaryTokenAddressAccountInfo === null) {
            transaction.add(
                await Instructions.createATokenAccountInstruction(
                    beneficiaryTokenAccountKey,
                    initializer,
                    beneficiaryAccountKey,
                    mintAccountKey
                )
            );
        }

        const treasuryAccountKey = new PublicKey(streamInfo.treasuryAddress as string);
        const treasuryTokenAccountKey = await Utils.findATokenAddress(
            treasuryAccountKey,
            mintAccountKey
        );

        transaction.add(
            await Instructions.closeStreamInstruction(
                this.programId,
                initializer,
                counterparty,
                beneficiaryTokenAccountKey,
                mintAccountKey,
                treasuryAccountKey,
                treasuryTokenAccountKey,
                streamInfo
            )
        );

        transaction.feePayer = initializer;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        transaction.recentBlockhash = hash.blockhash;

        return transaction;
    }

}
