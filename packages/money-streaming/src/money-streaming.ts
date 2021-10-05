/**
 * Solana
 */
 import {
    Commitment,
    Connection,
    ConnectionConfig,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    Signer,
    TransactionInstruction,
    Cluster,
    clusterApiUrl,
    Finality,
    Account

} from '@solana/web3.js';

/**
 * MSP
 */
import * as Instructions from './instructions';
import * as Utils from './utils';
import * as Layout from './layout';
import { u64Number } from './u64n';
import { StreamInfo, StreamTermsInfo, TreasuryInfo } from './types';
import { Errors } from './errors';
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';

/**
 * API class with functions to interact with the Money Streaming Program using Solana Web3 JS API 
 */
export class MoneyStreaming {

    private connection: Connection;
    private cluster: Cluster | string;
    private programId: PublicKey;
    private commitment: Commitment | ConnectionConfig | undefined;
    private mspOps: PublicKey;
    private mspOpsAddress: PublicKey = new PublicKey('CLazQV1BhSrxfgRHko4sC8GYBU3DoHcX4xxRZd12Kohr');
    private mspOpsDevAddress: PublicKey = new PublicKey('BgxJuujLZDR27SS41kYZhsHkXx6CP2ELaVyg1qBxWYNU');

    /**
     * Create a Streaming API object
     *
     * @param cluster The solana cluster endpoint used for the connecton
     */
    constructor(
        cluster: Cluster | string,
        programId: PublicKey | string,
        commitment: Commitment | string = 'confirmed'
    ) {
        this.cluster = cluster;
        let networkUrl = clusterApiUrl(this.cluster as Cluster);    
        this.commitment = commitment as Commitment;
        this.connection = new Connection(networkUrl, this.commitment);

        if (typeof programId === 'string') {
            this.programId = new PublicKey(programId);
        } else {
            this.programId = programId;
        }

        this.mspOps = this.cluster === 'mainnet-beta' ? this.mspOpsAddress: this.mspOpsDevAddress;
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

    public async getTreasury(
        id: PublicKey,
        commitment?: Commitment | undefined,
        friendly: boolean = true

    ): Promise<TreasuryInfo> {

        return await Utils.getTreasury(
            this.programId,
            this.connection,
            id,
            commitment,
            friendly
        );
    }

    public async listStreams(
        treasurer?: PublicKey | undefined,
        beneficiary?: PublicKey | undefined,
        commitment?: Commitment | undefined,
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

    public async listStreamActivity(
        id: PublicKey,
        commitment?: Finality | undefined,
        friendly: boolean = true

    ): Promise<any[]> {

        return await Utils.listStreamActivity(
            this.connection,
            id,
            commitment,
            friendly
        );
    }

    public async oneTimePayment(
        treasurer: PublicKey,
        beneficiary: PublicKey,
        beneficiaryMint: PublicKey,
        amount: number,
        startUtc?: Date,
        streamName?: String

    ): Promise<Transaction> {

        return await this.oneTimePaymentTransaction(
            treasurer,
            beneficiary,
            beneficiaryMint,
            amount || 0,
            startUtc,
            streamName
        );
    }

    public async createStream(
        treasurer: PublicKey,
        treasury: PublicKey | undefined,
        beneficiary: PublicKey,
        beneficiaryMint: PublicKey,
        rateAmount?: number,
        rateIntervalInSeconds?: number,
        startUtc?: Date,
        streamName?: String,
        fundingAmount?: number,
        rateCliffInSeconds?: number,
        cliffVestAmount?: number,
        cliffVestPercent?: number,
        autoPauseInSeconds?: number

    ): Promise<Transaction> {

        return await this.createStreamTransaction(
            treasurer,
            treasury,
            beneficiary,
            beneficiaryMint,
            fundingAmount,
            rateAmount,
            rateIntervalInSeconds,
            startUtc,
            streamName,
            rateCliffInSeconds,
            cliffVestAmount,
            cliffVestPercent,
            autoPauseInSeconds
        );
    }

    public async addFunds(
        contributor: PublicKey,
        stream: PublicKey,
        contributorMint: PublicKey,
        amount: number,
        resume = false

    ): Promise<Transaction> {

        let streamInfo = await Utils.getStream(this.connection, stream, this.commitment);

        if (!streamInfo) {
            throw Error(Errors.AccountNotFound);
        }

        const contributorTokenKey = await Utils.findATokenAddress(contributor, contributorMint);
        const beneficiaryMintKey = new PublicKey(streamInfo.associatedToken as string);
        const treasuryKey = new PublicKey(streamInfo.treasuryAddress as string);
        const treasuryInfo = await Utils.getTreasury(this.programId, this.connection, treasuryKey);

        if (!treasuryInfo) {
            throw Error(`${Errors.AccountNotFound}: Treasury account not found`);
        }

        const treasuryTokenKey = await Utils.findATokenAddress(treasuryKey, contributorMint);
        const treasuryMint = new PublicKey(treasuryInfo.treasuryMintAddress as string);

        return await this.addFundsTransaction(
            contributor,
            contributorTokenKey,
            beneficiaryMintKey,
            treasuryKey,
            treasuryTokenKey,
            treasuryMint,
            stream,
            amount,
            resume
        );
    }

    public async withdraw(
        stream: PublicKey,
        beneficiary: PublicKey,
        withdrawal_amount: number

    ): Promise<Transaction> {

        let ixs: TransactionInstruction[] = [];
        let streamInfo = await Utils.getStream(this.connection, stream, this.commitment);

        if (!streamInfo || !beneficiary.equals(new PublicKey(streamInfo.beneficiaryAddress as string))) {
            throw Error(Errors.AccountNotFound);
        }

        // Check for the beneficiary associated token account
        const beneficiaryMintKey = new PublicKey(streamInfo.associatedToken as string);
        const beneficiaryTokenKey = await Utils.findATokenAddress(beneficiary, beneficiaryMintKey);
        const beneficiaryTokenAccountInfo = await this.connection.getAccountInfo(beneficiaryTokenKey);

        if (!beneficiaryTokenAccountInfo) {
            ixs.push(
                await Instructions.createATokenAccountInstruction(
                    beneficiaryTokenKey,
                    beneficiary,
                    beneficiaryTokenKey,
                    beneficiaryMintKey
                )
            );
        }

        const treasuryKey = new PublicKey(streamInfo.treasuryAddress as PublicKey);
        const treasuryTokenKey = await Utils.findATokenAddress(treasuryKey, beneficiaryMintKey);
        const mspOpsTokenKey = await Utils.findATokenAddress(this.mspOps, beneficiaryMintKey);

        ixs.push(
            await Instructions.withdrawInstruction(
                this.programId,
                beneficiary,
                beneficiaryTokenKey,
                beneficiaryMintKey,
                treasuryKey,
                treasuryTokenKey,
                stream,
                this.mspOps,
                mspOpsTokenKey,
                withdrawal_amount
            )
        );

        let tx = new Transaction().add(...ixs);
        tx.feePayer = beneficiary;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        tx.recentBlockhash = hash.blockhash;

        return tx;
    }

    public async pauseStream(
        initializer: PublicKey,
        stream: PublicKey

    ): Promise<Transaction> {

        let tx = new Transaction().add(
            await Instructions.pauseStreamInstruction(
                this.programId,
                initializer,
                stream,
                this.mspOps
            )
        );

        tx.feePayer = initializer;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        tx.recentBlockhash = hash.blockhash;

        return tx;
    }

    public async resumeStream(
        initializer: PublicKey,
        stream: PublicKey

    ): Promise<Transaction> {

        let tx = new Transaction().add(
            await Instructions.resumeStreamInstruction(
                this.programId,
                initializer,
                stream,
                this.mspOps
            )
        );

        tx.feePayer = initializer;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        tx.recentBlockhash = hash.blockhash;

        return tx;
    }

    public async closeStream(
        stream: PublicKey,
        initializer: PublicKey

    ): Promise<Transaction> {

        let tx = new Transaction();
        let streamInfo = await Utils.getStream(this.connection, stream, this.commitment);

        if (!streamInfo) {
            throw Error(`${Errors.AccountNotFound}: Stream address not found`);
        }

        const streamKey = new PublicKey(streamInfo.id as string);
        const beneficiaryKey = new PublicKey(streamInfo.beneficiaryAddress as string);
        const beneficiaryMintKey = new PublicKey(streamInfo.associatedToken as string);
        const beneficiaryTokenKey = await Utils.findATokenAddress(beneficiaryKey, beneficiaryMintKey);
        const beneficiaryTokenAccountInfo = await this.connection.getAccountInfo(beneficiaryTokenKey);

        if (!beneficiaryTokenAccountInfo) {
            tx.add(
                await Instructions.createATokenAccountInstruction(
                    beneficiaryTokenKey,
                    initializer,
                    beneficiaryKey,
                    beneficiaryMintKey
                )
            );
        }

        const treasurerKey = new PublicKey(streamInfo.treasurerAddress as string);
        const treasurerTokenKey = await Utils.findATokenAddress(treasurerKey, beneficiaryMintKey);
        const treasuryKey = new PublicKey(streamInfo.treasuryAddress as string);
        const treasuryTokenKey = await Utils.findATokenAddress(treasuryKey, beneficiaryMintKey);
        // Get the money streaming program operations token account or create a new one
        const mspOpsTokenKey = await Utils.findATokenAddress(this.mspOps, beneficiaryMintKey);

        tx.add(
            // Close stream
            await Instructions.closeStreamInstruction(
                this.programId,
                initializer,
                treasurerTokenKey,
                beneficiaryTokenKey,
                beneficiaryMintKey,
                treasuryKey,
                treasuryTokenKey,
                streamKey,
                this.mspOps,
                mspOpsTokenKey
            )
        );

        tx.feePayer = initializer;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        tx.recentBlockhash = hash.blockhash;

        return tx;
    }

    public async proposeUpdate(
        stream: PublicKey,
        proposedBy: PublicKey,
        streamName?: string,
        associatedToken?: PublicKey,
        rateAmount?: number,
        rateIntervalInSeconds?: number,
        rateCliffInSeconds?: number,
        cliffVestAmount?: number,
        cliffVestPercent?: number,
        autoPauseInSeconds?: number

    ): Promise<Transaction> {

        let ixs: TransactionInstruction[] = [];
        // Create stream terms account
        const streamTermsAccount = Keypair.generate();
        const streamTermsMinimumBalance = 
            await this.connection.getMinimumBalanceForRentExemption(Layout.streamTermsLayout.span);

        ixs.push(
            SystemProgram.createAccount({
                fromPubkey: proposedBy,
                newAccountPubkey: streamTermsAccount.publicKey,
                lamports: streamTermsMinimumBalance,
                space: Layout.streamTermsLayout.span,
                programId: this.programId
            })
        );

        let streamInfo = await Utils.getStream(this.connection, stream, this.commitment);
        let initializer: PublicKey = proposedBy,
            counterparty: string | PublicKey | undefined;

        if (initializer.toBase58() === streamInfo.treasurerAddress) {
            initializer = new PublicKey(streamInfo.treasurerAddress as string);
            counterparty = new PublicKey(streamInfo.beneficiaryAddress as string);
        } else if (initializer.toBase58() === streamInfo.beneficiaryAddress) {
            initializer = new PublicKey(streamInfo.beneficiaryAddress as string);
            counterparty = new PublicKey(streamInfo.treasurerAddress as string);
        } else {
            throw Error(Errors.InvalidInitializer);
        }

        ixs.push(
            await Instructions.proposeUpdateInstruction(
                this.programId,
                streamInfo,
                streamTermsAccount.publicKey,
                initializer,
                counterparty,
                this.mspOps,
                streamName,
                associatedToken,
                rateAmount,
                rateIntervalInSeconds,
                rateCliffInSeconds,
                cliffVestAmount,
                cliffVestPercent,
                autoPauseInSeconds || ((rateAmount || 0) * (rateIntervalInSeconds || 0))
            )
        );

        let tx = new Transaction().add(...ixs);
        tx.feePayer = proposedBy;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        tx.recentBlockhash = hash.blockhash;
        tx.partialSign(streamTermsAccount);

        return tx;
    }

    public async answerUpdate(
        stream: PublicKey,
        answeredBy: PublicKey,
        approve: true

    ): Promise<Transaction> {

        const streamInfo = await Utils.getStream(this.connection, stream, this.commitment);
        const streamTerms = await Utils.getStreamTerms(
            this.programId, 
            this.connection, 
            new PublicKey(streamInfo.id as string)
        );

        let initializer: PublicKey = answeredBy,
            counterparty: string | PublicKey | undefined;

        if (initializer.toBase58() === streamInfo.treasurerAddress) {
            initializer = new PublicKey(streamInfo.treasurerAddress as string);
            counterparty = new PublicKey(streamInfo.beneficiaryAddress as string);
        } else if (initializer.toBase58() === streamInfo.beneficiaryAddress) {
            initializer = new PublicKey(streamInfo.beneficiaryAddress as string);
            counterparty = new PublicKey(streamInfo.treasurerAddress as string);
        } else {
            throw new Error(Errors.InvalidInitializer);
        }

        let tx = new Transaction().add(
            await Instructions.answerUpdateInstruction(
                this.programId,
                streamTerms as StreamTermsInfo,
                initializer,
                counterparty,
                this.mspOps,
                approve
            )
        );

        tx.feePayer = answeredBy;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        tx.recentBlockhash = hash.blockhash;

        return tx;
    }

    private async oneTimePaymentTransaction(
        treasurer: PublicKey,
        beneficiary: PublicKey,
        beneficiaryMint: PublicKey,
        amount: number,
        startUtc?: Date,
        streamName?: String

    ): Promise<Transaction> {

        let ixs: TransactionInstruction[] = [];
        let txSigners: Array<Signer> = new Array<Signer>();

        const now = new Date();
        const start = startUtc ? new Date(startUtc.toLocaleString()) : now;
        const treasurerTokenKey = await Utils.findATokenAddress(treasurer, beneficiaryMint);
        const treasurerTokenAccountInfo = await this.connection.getAccountInfo(treasurerTokenKey);

        if (!treasurerTokenAccountInfo) {
            throw Error(Errors.AccountNotFound);
        }

        const mspOpsKey = this.mspOps;

        if (start <= now) {
            // Just create the beneficiary token account and transfer since the payment is not scheduled
            const beneficiaryTokenKey = await Utils.findATokenAddress(beneficiary, beneficiaryMint);
            const beneficiaryTokenAccountInfo = await this.connection.getAccountInfo(beneficiaryTokenKey);

            if (!beneficiaryTokenAccountInfo) {
                ixs.push(
                    await Instructions.createATokenAccountInstruction(
                        beneficiaryTokenKey,
                        treasurer,
                        beneficiary,
                        beneficiaryMint
                    )
                );
            }

            const mspOpsTokenKey = await Utils.findATokenAddress(mspOpsKey, beneficiaryMint);

            if (amount && amount > 0) {
                ixs.push(
                    await Instructions.transferInstruction(
                        this.programId,
                        treasurer,
                        treasurerTokenKey,
                        beneficiaryTokenKey,
                        beneficiaryMint,
                        mspOpsKey,
                        mspOpsTokenKey,
                        amount
                    )
                );
            }

        } else {

            // Create the treasury account since the OTP is schedule
            const blockHeight = await this.connection.getSlot(this.commitment as Commitment);
            const treasurySeeds = [treasurer.toBuffer(), new u64Number(blockHeight).toBuffer()];
            const treasury = (await PublicKey.findProgramAddress(treasurySeeds, this.programId))[0];
            const treasuryTokenKey = await Utils.findATokenAddress(treasury, beneficiaryMint);

            // Initialize the treasury
            ixs.push(
                await Instructions.createTreasuryInstruction(
                    this.programId,
                    treasurer,
                    treasury,
                    treasuryTokenKey,
                    beneficiaryMint,
                    PublicKey.default,
                    mspOpsKey,
                    blockHeight
                )
            );

            // Create stream account since the OTP is scheduled
            const streamAccount = Keypair.generate();
            txSigners.push(streamAccount);

            // Create stream contract
            ixs.push(
                await Instructions.createStreamInstruction(
                    this.programId,
                    treasurer,
                    treasury as PublicKey,
                    beneficiary,
                    beneficiaryMint,
                    streamAccount.publicKey,
                    mspOpsKey,
                    streamName || "",
                    0,
                    0,
                    startUtc ? startUtc.getTime() : Date.parse(now.toUTCString()),
                    0,
                    0,
                    100,
                    0
                )
            );

            if (amount && amount > 0) {
                // Get the money streaming program operations token account or create a new one
                const mspOpsTokenKey = await Utils.findATokenAddress(this.mspOps, beneficiaryMint);

                ixs.push(
                    await Instructions.addFundsInstruction(
                        this.programId,
                        treasurer,
                        treasurerTokenKey,
                        PublicKey.default,
                        beneficiaryMint,
                        treasury,
                        treasuryTokenKey,
                        PublicKey.default,
                        streamAccount.publicKey,
                        this.mspOps,
                        mspOpsTokenKey,
                        amount,
                        true
                    )
                );
            }
        }

        let tx = new Transaction().add(...ixs);
        tx.feePayer = treasurer;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        tx.recentBlockhash = hash.blockhash;

        if (txSigners.length) {
            tx.partialSign(...txSigners);
        }

        return tx;
    }

    private async createStreamTransaction(
        treasurer: PublicKey,
        treasury: PublicKey | undefined,
        beneficiary: PublicKey,
        beneficiaryMint: PublicKey,
        fundingAmount?: number,
        rateAmount?: number,
        rateIntervalInSeconds?: number,
        startUtc?: Date,
        streamName?: String,
        rateCliffInSeconds?: number,
        cliffVestAmount?: number,
        cliffVestPercent?: number,
        autoPauseInSeconds?: number

    ): Promise<Transaction> {

        let ixs: Array<TransactionInstruction> = new Array<TransactionInstruction>();
        let txSigners: Array<Signer> = new Array<Signer>(),
            treasuryToken: PublicKey = PublicKey.default,
            treasuryMint: PublicKey = PublicKey.default;

        if (!treasury) {
            const blockHeight = await this.connection.getSlot(this.commitment as Commitment);
            const blockHeightBuffer = new u64Number(blockHeight).toBuffer();
            const treasurySeeds = [treasurer.toBuffer(), blockHeightBuffer];
            treasury = (await PublicKey.findProgramAddress(treasurySeeds, this.programId))[0];
            const treasuryMintSeeds = [treasurer.toBuffer(), treasury.toBuffer(), blockHeightBuffer];
            treasuryMint = (await PublicKey.findProgramAddress(treasuryMintSeeds, this.programId))[0];
            
            // Get the treasury token account
            treasuryToken = await Token.getAssociatedTokenAddress(
                ASSOCIATED_TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                beneficiaryMint,
                treasury,
                true
            );

            // Create treasury
            ixs.push(
                await Instructions.createTreasuryInstruction(
                    this.programId,
                    treasurer,
                    treasury,
                    treasuryToken,
                    beneficiaryMint,
                    treasuryMint,
                    this.mspOps,
                    blockHeight
                )
            );
        }

        const streamAccount = Keypair.generate();
        txSigners.push(streamAccount);
        const startTimeUtc = startUtc ? startUtc.getTime() : Date.parse(new Date().toUTCString());

        // Create stream contract
        ixs.push(
            await Instructions.createStreamInstruction(
                this.programId,
                treasurer,
                treasury,
                beneficiary,
                beneficiaryMint,
                streamAccount.publicKey,
                this.mspOps,
                streamName || "",
                rateAmount || 0.0,
                rateIntervalInSeconds || 0,
                startTimeUtc,
                rateCliffInSeconds || 0,
                cliffVestAmount || 0,
                cliffVestPercent || 100,
                autoPauseInSeconds || ((rateAmount || 0) * (rateIntervalInSeconds || 0))
            )
        );

        if (fundingAmount && fundingAmount > 0) {

            // Get the treasurer token account
            const treasurerTokenKey = await Token.getAssociatedTokenAddress(
                ASSOCIATED_TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                beneficiaryMint,
                treasurer,
                true
            );

            // Get the treasurer treasury token account
            const treasurerTreasuryTokenKey = await Token.getAssociatedTokenAddress(
                ASSOCIATED_TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                treasuryMint,
                treasurer,
                true
            );

            // Get the money streaming program operations token account
            const mspOpsTokenKey = await Token.getAssociatedTokenAddress(
                ASSOCIATED_TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                beneficiaryMint,
                this.mspOps,
                true
            );

            ixs.push(
                await Instructions.addFundsInstruction(
                    this.programId,
                    treasurer,
                    treasurerTokenKey,
                    treasurerTreasuryTokenKey,
                    beneficiaryMint,
                    treasury,
                    treasuryToken,
                    treasuryMint,
                    streamAccount.publicKey,
                    this.mspOps,
                    mspOpsTokenKey,
                    fundingAmount,
                    true
                )
            );
        }

        let tx = new Transaction().add(...ixs);
        tx.feePayer = treasurer;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        tx.recentBlockhash = hash.blockhash;

        if (txSigners.length) {
            tx.partialSign(...txSigners);
        }

        return tx;
    }

    private async addFundsTransaction(
        contributor: PublicKey,
        contributorToken: PublicKey,
        contributorMint: PublicKey,
        treasury: PublicKey,
        treasuryToken: PublicKey,
        treasuryMint: PublicKey,
        stream: PublicKey,
        amount: number,
        resume?: boolean

    ): Promise<Transaction> {

        let ixs: TransactionInstruction[] = [];

        // Get the money streaming program operations token account or create a new one
        const contributorTreasuryTokenKey = await Utils.findATokenAddress(contributor, treasuryMint);
        const mspOpsTokenKey = await Utils.findATokenAddress(this.mspOps, contributorMint);

        ixs.push(
            await Instructions.addFundsInstruction(
                this.programId,
                contributor,
                contributorToken,
                contributorTreasuryTokenKey,
                contributorMint,
                treasury,
                treasuryToken,
                treasuryMint,
                stream,
                this.mspOps,
                mspOpsTokenKey,
                amount,
                resume
            )
        );

        let tx = new Transaction().add(...ixs);
        tx.feePayer = contributor;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        tx.recentBlockhash = hash.blockhash;

        return tx;
    }
}