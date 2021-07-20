import { BN } from '@project-serum/anchor';
import { NodeWallet, Wallet as IWallet } from '@project-serum/anchor/dist/provider';
import { Token, AccountLayout } from '@solana/spl-token';
import { TOKEN_PROGRAM_ID } from '@project-serum/serum/lib/token-instructions';
import { Account, LAMPORTS_PER_SOL, Signer, TransactionInstruction } from '@solana/web3.js';
import {
    Commitment,
    Connection,
    ConnectionConfig,
    GetProgramAccountsConfig,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction

} from '@solana/web3.js';

import { Constants, ErrorConstants } from './constants';
import { Instructions } from './instructions';
import { Layout } from './layout';
import { TokenSwap } from './token-swap';
import * as Utils from './utils';
import { u64Number } from './u64n';
import { WalletAdapter } from './wallet-adapter';

export type StreamActivity = {
    signature: string,
    initializer: string,
    action: string;
    amount: number;
    mint: string;
    blockTime: number;
    utcDate: string;
}

export type TreasuryInfo = {
    id: PublicKey | string | undefined,
    initialized: boolean,
    treasuryBlockHeight: number,
    treasuryMintAddress: PublicKey | string | undefined,
    treasuryBaseAddress: PublicKey | string | undefined,
}

export type StreamTermsInfo = {
    id: PublicKey | string | undefined,
    initialized: boolean,
    streamId: PublicKey | string | undefined,
    streamMemo: String,
    treasurerAddress: PublicKey | string | undefined,
    beneficiaryAddress: PublicKey | string | undefined,
    associatedToken: PublicKey | string | undefined,
    rateAmount: number,
    rateIntervalInSeconds: number,
    rateCliffInSeconds: number,
    cliffVestAmount: number,
    cliffVestPercent: number,
    autoPauseInSeconds: number
}

export type StreamInfo = {
    id: PublicKey | string | undefined,
    initialized: boolean,
    memo: String,
    treasurerAddress: PublicKey | string | undefined,
    rateAmount: number,
    rateIntervalInSeconds: number,
    fundedOnUtc: Date | string | undefined,
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
    escrowVestedAmountSnap: number,
    escrowVestedAmountSnapBlockHeight: number,
    escrowVestedAmountSnapBlockTime: number,
    streamResumedBlockHeight: number,
    streamResumedBlockTime: number,
    autoPauseInSeconds: number,
    isStreaming: boolean,
    isUpdatePending: boolean,
    transactionSignature: string | undefined,
    blockTime: number,
}

export type TransactionMessage = {
    title: string,
    action: string,
    amount: number,
    fees: number
}

/**
 * API class with functions to interact with the Money Streaming Program using Solana Web3 JS API 
 */
export class MoneyStreaming {

    private connection: Connection;
    private cluster: string;
    private programId: PublicKey;
    private commitment: Commitment | ConnectionConfig | undefined;

    /**
     * Create a Streaming API object
     *
     * @param cluster The solana cluster endpoint used for the connecton
     */
    constructor(
        cluster: string,
        programId: PublicKey | string,
        commitment: Commitment | string = 'finalized'
    ) {
        this.cluster = cluster;
        this.connection = new Connection(cluster, commitment as Commitment);

        if (typeof programId === 'string') {
            this.programId = programId.toPublicKey();
        } else {
            this.programId = programId;
        }
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

    public async listStreamActivity(
        id: PublicKey,
        commitment?: Commitment | undefined,
        friendly: boolean = true

    ): Promise<any[]> {

        return await Utils.listStreamActivity(
            this.connection,
            this.cluster,
            id,
            commitment,
            friendly
        );
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
        let now = Date.parse(new Date().toUTCString());
        let start = startUtc !== undefined ? startUtc.valueOf() : now;

        const treasurerTokenKey = await Utils.findATokenAddress(treasurer, beneficiaryMint);
        const treasurerTokenAccountInfo = await this.connection.getAccountInfo(treasurerTokenKey);

        if (!treasurerTokenAccountInfo) {
            throw Error(ErrorConstants.AccountNotFound);
        }

        if (start < now) {
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

            if (amount && amount > 0) {
                ixs.push(
                    await Instructions.transferInstruction(
                        this.programId,
                        treasurer,
                        treasurerTokenKey,
                        beneficiaryTokenKey,
                        beneficiaryMint,
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
                    streamName || "",
                    0,
                    0,
                    start,
                    0,
                    0,
                    100,
                    0
                )
            );

            if (amount && amount > 0) {
                // Get the money streaming program operations token account or create a new one
                const mspOpsKey = Constants.MSP_OPERATIONS_ADDRESS.toPublicKey();
                const mspOpsTokenKey = await Utils.findATokenAddress(mspOpsKey, beneficiaryMint);

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
                        mspOpsKey,
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

    public async oneTimePayment(
        wallet: IWallet,
        treasurerMint: PublicKey,
        beneficiary: PublicKey,
        beneficiaryMint: PublicKey,
        amount: number,
        startUtc?: Date,
        streamName?: String

    ): Promise<Transaction[]> {

        let txs: Transaction[] = [];
        const treasurer = wallet.publicKey;

        if (treasurerMint.toBase58() === Constants.WSOL_TOKEN_MINT_ADDRESS) {

            const treasurerTokenKey = await Utils.findATokenAddress(treasurer, treasurerMint);
            const treasurerTokenAccountInfo = await Utils.getTokenAccount(this.connection, treasurerTokenKey);
            const wrapAmount = !treasurerTokenAccountInfo
                ? amount
                : await Utils.calculateWrapAmount(treasurerTokenAccountInfo, amount);

            if (wrapAmount > 0) {
                txs.push(
                    await this.wrapTransaction(
                        treasurer,
                        treasurerTokenKey,
                        treasurerMint,
                        wrapAmount
                    )
                );
            }
        }

        if (treasurerMint.toBase58() !== beneficiaryMint.toBase58()) {
            txs.push(
                await this.swapTransaction(
                    wallet as IWallet,
                    treasurerMint,
                    beneficiaryMint,
                    amount
                )
            );
        }

        txs.push(
            await this.oneTimePaymentTransaction(
                treasurer,
                beneficiary,
                beneficiaryMint,
                amount || 0,
                startUtc,
                streamName
            )
        );

        return txs;
    }

    private async wrapTransaction(
        from: PublicKey,
        account: PublicKey,
        mint: PublicKey,
        amount: number

    ): Promise<Transaction> {

        const ixs: TransactionInstruction[] = [];
        const newAccount = new Account();
        const minimumWrappedAccountBalance = await this.connection.getMinimumBalanceForRentExemption(AccountLayout.span);

        ixs.push(
            SystemProgram.transfer({
                fromPubkey: from,
                toPubkey: newAccount.publicKey,
                lamports: (minimumWrappedAccountBalance * 2) + amount * LAMPORTS_PER_SOL
            }),
            SystemProgram.allocate({
                accountPubkey: newAccount.publicKey,
                space: AccountLayout.span
            }),
            SystemProgram.assign({
                accountPubkey: newAccount.publicKey,
                programId: TOKEN_PROGRAM_ID
            }),
            Token.createInitAccountInstruction(
                TOKEN_PROGRAM_ID,
                mint,
                newAccount.publicKey,
                from
            )
        );

        const accountInfo = await this.connection.getAccountInfo(account);

        if (accountInfo === null) {
            ixs.push(
                await Instructions.createATokenAccountInstruction(
                    account,
                    from,
                    from,
                    mint
                ),
            );
        }

        ixs.push(
            Token.createTransferInstruction(
                TOKEN_PROGRAM_ID,
                newAccount.publicKey,
                account,
                from,
                [newAccount],
                (amount * LAMPORTS_PER_SOL)
            ),
            Token.createCloseAccountInstruction(
                TOKEN_PROGRAM_ID,
                newAccount.publicKey,
                from,
                from,
                [newAccount]
            )
        )

        let tx = new Transaction().add(...ixs);
        tx.feePayer = from;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        tx.recentBlockhash = hash.blockhash;
        tx.partialSign(newAccount);

        return tx;
    }

    private async swapTransaction(
        wallet: IWallet,
        fromMint: PublicKey,
        toMint: PublicKey,
        amount: number

    ): Promise<Transaction> {

        const fromMintAccountInfo = await Utils.getMintAccount(this.connection, fromMint);
        const toMintAccountInfo = await Utils.getMintAccount(this.connection, toMint);
        const tokenSwap = new TokenSwap(
            this.connection,
            wallet as NodeWallet,
            this.commitment as Commitment
        );

        if (fromMintAccountInfo === null) {
            throw Error(ErrorConstants.AccountNotFound);
        } else if (toMintAccountInfo === null) {
            throw Error(ErrorConstants.AccountNotFound);
        } else {
            const estimatedAmount = await tokenSwap.estimate({
                fromMint: fromMint,
                toMint: toMint,
                amount: new BN(amount),
                minExchangeRate: {
                    rate: new BN(amount).mul(new BN(99.5)).div(new BN(100)),
                    fromDecimals: fromMintAccountInfo.decimals,
                    quoteDecimals: toMintAccountInfo.decimals,
                    strict: false
                }
            });

            const minExchangeRate = {
                rate: estimatedAmount.mul(new BN(99.5)).div(new BN(100)),
                fromDecimals: fromMintAccountInfo.decimals,
                quoteDecimals: toMintAccountInfo.decimals,
                strict: false
            };

            let tx = await tokenSwap.swapTransaction({
                fromMint: fromMint,
                toMint: toMint,
                amount: new BN(amount),
                minExchangeRate: minExchangeRate
            });

            tx.feePayer = wallet.publicKey;
            let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
            tx.recentBlockhash = hash.blockhash;

            return tx;
        }
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
            treasuryToken = await Utils.findATokenAddress(treasury, beneficiaryMint);

            // Create treasury
            ixs.push(
                await Instructions.createTreasuryInstruction(
                    this.programId,
                    treasurer,
                    treasury,
                    treasuryToken,
                    beneficiaryMint,
                    treasuryMint,
                    blockHeight
                )
            );
        }

        const streamAccount = Keypair.generate();
        txSigners.push(streamAccount);

        // Create stream contract
        ixs.push(
            await Instructions.createStreamInstruction(
                this.programId,
                treasurer,
                treasury,
                beneficiary,
                beneficiaryMint,
                streamAccount.publicKey,
                streamName || "",
                rateAmount || 0.0,
                rateIntervalInSeconds || 0,
                startUtc?.valueOf() || Date.parse(new Date().toUTCString()),
                rateCliffInSeconds || 0,
                cliffVestAmount || 0,
                cliffVestPercent || 100,
                autoPauseInSeconds || ((rateAmount || 0) * (rateIntervalInSeconds || 0))
            )
        );

        if (fundingAmount && fundingAmount > 0) {
            // Get the treasurer and treasury treasury token account
            const treasurerTokenKey = await Utils.findATokenAddress(treasurer, beneficiaryMint);
            const treasurerTreasuryTokenKey = await Utils.findATokenAddress(treasurer, treasuryMint);
            // Get the money streaming program operations token account
            const mspOpsKey = Constants.MSP_OPERATIONS_ADDRESS.toPublicKey();
            const mspOpsTokenKey = await Utils.findATokenAddress(mspOpsKey, beneficiaryMint);

            if (treasuryToken === PublicKey.default) {
                treasuryToken = await Utils.findATokenAddress(treasury, beneficiaryMint);
            }

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
                    mspOpsKey,
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

    public async createStream(
        wallet: IWallet,
        treasury: PublicKey | undefined,
        beneficiary: PublicKey,
        treasurerMint: PublicKey,
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

    ): Promise<Transaction[]> {

        let txs: Transaction[] = [];
        const treasurer = wallet.publicKey;

        if (fundingAmount && fundingAmount > 0) { // Wrap or Swap only if there is an initial funding amount for the stream

            if (treasurerMint.toBase58() === Constants.WSOL_TOKEN_MINT_ADDRESS) {

                const treasurerTokenKey = await Utils.findATokenAddress(treasurer, treasurerMint);
                const treasurerTokenAccountInfo = await Utils.getTokenAccount(this.connection, treasurerTokenKey);
                const wrapAmount = !treasurerTokenAccountInfo
                    ? fundingAmount
                    : await Utils.calculateWrapAmount(treasurerTokenAccountInfo, fundingAmount);

                if (wrapAmount > 0) {
                    txs.push(
                        await this.wrapTransaction(
                            treasurer,
                            treasurerTokenKey,
                            treasurerMint,
                            wrapAmount
                        )
                    );
                }
            }

            if (treasurerMint.toBase58() !== beneficiaryMint.toBase58()) {

                txs.push(
                    await this.swapTransaction(
                        wallet,
                        treasurerMint,
                        beneficiaryMint,
                        fundingAmount
                    )
                );

                treasurerMint = beneficiaryMint;
            }
        }

        txs.push(
            await this.createStreamTransaction(
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
            )
        );

        return txs;
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
        const mspOpsKey = Constants.MSP_OPERATIONS_ADDRESS.toPublicKey();
        const mspOpsTokenKey = await Utils.findATokenAddress(mspOpsKey, contributorMint);

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
                mspOpsKey,
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

    public async addFunds(
        wallet: IWallet,
        stream: PublicKey,
        contributorMint: PublicKey,
        amount: number,
        resume = false

    ): Promise<Transaction[]> {

        let txs: Transaction[] = [];
        let streamInfo = await Utils.getStream(this.connection, stream, false);

        if (streamInfo === null) {
            throw Error(ErrorConstants.AccountNotFound);
        }

        const contributorKey = wallet.publicKey;
        const contributorTokenKey = await Utils.findATokenAddress(contributorKey, contributorMint);

        if (contributorMint.toBase58() === Constants.WSOL_TOKEN_MINT_ADDRESS) {

            const contributorTokenAccountInfo = await Utils.getTokenAccount(this.connection, contributorTokenKey);
            const wrapAmount = !contributorTokenAccountInfo
                ? amount
                : await Utils.calculateWrapAmount(contributorTokenAccountInfo, amount);

            if (wrapAmount > 0) {
                txs.push(
                    await this.wrapTransaction(
                        contributorKey,
                        contributorTokenKey,
                        contributorMint,
                        wrapAmount
                    )
                );
            }
        }

        const beneficiaryMintKey = new PublicKey(streamInfo.associatedToken as PublicKey);

        if (contributorMint.toBase58() !== beneficiaryMintKey.toBase58()) {
            txs.push(
                await this.swapTransaction(
                    wallet,
                    contributorMint,
                    beneficiaryMintKey,
                    amount
                )
            );
        }

        const treasuryKey = new PublicKey(streamInfo.treasuryAddress as PublicKey);
        const treasuryInfo = await Utils.getTreasury(this.programId, this.connection, treasuryKey);

        if (!treasuryInfo) {
            throw Error(`${ErrorConstants.AccountNotFound}: Treasury account not found`);
        }

        const treasuryTokenKey = await Utils.findATokenAddress(treasuryKey, contributorMint);
        const treasuryMint = new PublicKey(treasuryInfo.treasuryMintAddress as string);

        txs.push(
            await this.addFundsTransaction(
                contributorKey,
                contributorTokenKey,
                beneficiaryMintKey,
                treasuryKey,
                treasuryTokenKey,
                treasuryMint,
                stream,
                amount,
                resume
            )
        );

        return txs;
    }

    public async withdraw(
        stream: PublicKey,
        beneficiary: PublicKey,
        withdrawal_amount: number

    ): Promise<Transaction> {

        let ixs: TransactionInstruction[] = [];
        let streamInfo = await Utils.getStream(this.connection, stream);

        if (!streamInfo || beneficiary.toBase58() !== streamInfo.beneficiaryAddress as string) {
            throw Error(ErrorConstants.AccountNotFound);
        }

        // Check for the beneficiary associated token account
        const beneficiaryMintKey = new PublicKey(streamInfo.associatedToken as PublicKey);
        const beneficiaryTokenKey = await Utils.findATokenAddress(beneficiary, beneficiaryMintKey);
        const treasuryKey = new PublicKey(streamInfo.treasuryAddress as PublicKey);
        const treasuryTokenKey = await Utils.findATokenAddress(treasuryKey, beneficiaryMintKey);
        const mspOpsKey = Constants.MSP_OPERATIONS_ADDRESS.toPublicKey();
        const mspOpsTokenKey = await Utils.findATokenAddress(mspOpsKey, beneficiaryMintKey);

        ixs.push(
            await Instructions.withdrawInstruction(
                this.programId,
                beneficiary,
                beneficiaryTokenKey,
                beneficiaryMintKey,
                treasuryKey,
                treasuryTokenKey,
                stream,
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
                stream
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
                stream
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

        let streamInfo = await Utils.getStream(this.connection, stream);

        if (!streamInfo) {
            throw Error(`${ErrorConstants.AccountNotFound}: Stream address not found`);
        }

        let counterparty: PublicKey;

        if (initializer.toBase58() === streamInfo.treasurerAddress as string) {
            counterparty = new PublicKey(streamInfo.beneficiaryAddress as string);
        } else if (initializer.toBase58() === streamInfo.beneficiaryAddress as string) {
            counterparty = new PublicKey(streamInfo.treasurerAddress as string);
        } else {
            throw Error(`${ErrorConstants.Unauthorized}: Address ${initializer.toBase58()} not authorized to close the stream`);
        }

        const streamKey = streamInfo.id as PublicKey;
        const beneficiaryKey = new PublicKey(streamInfo.beneficiaryAddress as string);
        const beneficiaryMintKey = new PublicKey(streamInfo.associatedToken as string);
        const beneficiaryTokenKey = await Utils.findATokenAddress(beneficiaryKey, beneficiaryMintKey);
        const treasuryKey = new PublicKey(streamInfo.treasuryAddress as string);
        const treasuryTokenKey = await Utils.findATokenAddress(treasuryKey, beneficiaryMintKey);
        // Get the money streaming program operations token account or create a new one
        const mspOpsKey = Constants.MSP_OPERATIONS_ADDRESS.toPublicKey();
        const mspOpsTokenKey = await Utils.findATokenAddress(mspOpsKey, beneficiaryMintKey);

        let tx = new Transaction().add(
            // Close stream
            await Instructions.closeStreamInstruction(
                this.programId,
                initializer,
                counterparty,
                beneficiaryTokenKey,
                beneficiaryMintKey,
                treasuryKey,
                treasuryTokenKey,
                streamKey,
                mspOpsKey,
                mspOpsTokenKey
            )
        );

        tx.feePayer = initializer;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        tx.recentBlockhash = hash.blockhash;

        return tx;
    }

    public async proposeUpdateTransaction(
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
        const streamTermsMinimumBalance = await this.connection.getMinimumBalanceForRentExemption(Layout.streamTermsLayout.span);

        ixs.push(
            SystemProgram.createAccount({
                fromPubkey: proposedBy,
                newAccountPubkey: streamTermsAccount.publicKey,
                lamports: streamTermsMinimumBalance,
                space: Layout.streamTermsLayout.span,
                programId: this.programId
            })
        );

        let streamInfo = await Utils.getStream(
            this.connection,
            stream
        );

        let initializer: PublicKey = proposedBy,
            counterparty: string | PublicKey | undefined;

        if (initializer === streamInfo.treasurerAddress) {
            initializer = streamInfo.treasurerAddress;
            counterparty = streamInfo.beneficiaryAddress;
        } else if (initializer === streamInfo.beneficiaryAddress) {
            initializer = streamInfo.beneficiaryAddress;
            counterparty = streamInfo.treasurerAddress;
        } else {
            throw Error(ErrorConstants.InvalidInitializer);
        }

        ixs.push(
            await Instructions.proposeUpdateInstruction(
                this.programId,
                streamInfo,
                streamTermsAccount.publicKey,
                initializer,
                counterparty as PublicKey,
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

    public async answerUpdateTransaction(
        streamId: PublicKey,
        answeredBy: PublicKey,
        approve: true

    ): Promise<Transaction> {

        const stream = await Utils.getStream(
            this.connection,
            streamId
        );

        const streamTerms = await Utils.getStreamTerms(
            this.programId,
            this.connection,
            stream.id as PublicKey
        );

        let initializer: PublicKey = answeredBy,
            counterparty: string | PublicKey | undefined;

        if (initializer === stream.treasurerAddress) {
            initializer = stream.treasurerAddress;
            counterparty = stream.beneficiaryAddress;
        } else if (initializer === stream.beneficiaryAddress) {
            initializer = stream.beneficiaryAddress;
            counterparty = stream.treasurerAddress;
        } else {
            throw Error(ErrorConstants.InvalidInitializer);
        }

        let tx = new Transaction().add(
            await Instructions.answerUpdateInstruction(
                this.programId,
                streamTerms as StreamTermsInfo,
                initializer,
                counterparty as PublicKey,
                approve
            )
        );

        tx.feePayer = answeredBy;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        tx.recentBlockhash = hash.blockhash;

        return tx;
    }

    public async signTransactions(
        adapter: WalletAdapter,
        transactions: Transaction[]

    ): Promise<Transaction[]> {

        try {
            let txs: Transaction[] = [];
            console.log("Sending transaction for wallet for approval...");

            for (let tx of transactions) {
                let signedTx = await adapter.signTransaction(tx);
                txs.push(signedTx);
            }

            return txs;

        } catch (error) {
            console.log("signTransaction failed!");
            console.log(error);
            throw error;
        }
    }

    public async sendSignedTransactions(...signedTrans: Transaction[]): Promise<string[]> {
        try {

            let signatures: string[] = [];
            let index = 0;

            for (let tx of signedTrans) {

                let options = { preflightCommitment: this.commitment as Commitment };
                let result = await this.connection.sendRawTransaction(tx.serialize(), options);
                let status = await this.connection.getSignatureStatus(result);

                while ((status.value === null || status.value.confirmationStatus !== 'finalized') &&
                    (status.value === null || index !== signedTrans.length - 1)) {
                    status = await this.connection.getSignatureStatus(result);
                }

                console.log(`Transaction ${result} ${status.value.confirmationStatus}`);
                signatures.push(result);
                index++;
            }

            return signatures;

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

    public async confirmAllTransactions(signatures: string[]): Promise<any> {
        try {
            let results: any[] = [];
            for (const signature of signatures) {
                const result = await this.connection.confirmTransaction(signature, 'confirmed');
                results.push(result);
            }
            return results;
        } catch (error) {
            throw error;
        }
    }

    // public async autoCloseStream(stream: PublicKey): Promise<Transaction[]>
}
