import { BN } from '@project-serum/anchor';
import { NodeWallet, Wallet } from '@project-serum/anchor/dist/provider';
import { Token, AccountLayout, MintLayout } from '@solana/spl-token';
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

export type TreasuryInfo = {
    id: PublicKey | string | undefined,
    initialized: boolean,
    mintAddress: PublicKey | string | undefined,
    nounce: number
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
    isUpdatePending: boolean
    transactionSignature: string | undefined,
    blockTime: number,
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
        treasurerToken: PublicKey,
        treasury: PublicKey | undefined,
        beneficiary: PublicKey,
        associatedToken: PublicKey,
        fundingAmount: number,
        startUtc?: Date,
        streamName?: String

    ): Promise<Transaction> {

        let ixs: TransactionInstruction[] = [];
        let txSigners: Signer[] = [];
        let now = Date.parse(new Date().toUTCString());
        let start = startUtc !== undefined ? startUtc.valueOf() : now;
        let streamAccount: any,
            treasuryTokenAccountKey: PublicKey = PublicKey.default,
            beneficiaryTokenAccountKey: PublicKey = PublicKey.default;

        if (start > now) {
            // Create stream account since the OTP is scheduled
            streamAccount = Keypair.generate();
            const streamMinimumBalance = await this.connection.getMinimumBalanceForRentExemption(Layout.streamLayout.span);

            ixs.push(
                SystemProgram.createAccount({
                    fromPubkey: treasurer,
                    newAccountPubkey: streamAccount.publicKey,
                    lamports: streamMinimumBalance,
                    space: Layout.streamLayout.span,
                    programId: this.programId
                })
            );

            txSigners.push(streamAccount);

            // Create stream contract
            ixs.push(
                await Instructions.createStreamInstruction(
                    this.programId,
                    treasurer,
                    treasurerToken,
                    beneficiaryTokenAccountKey,
                    treasury as PublicKey,
                    treasuryTokenAccountKey,
                    streamAccount !== undefined ? (streamAccount as Keypair).publicKey : PublicKey.default,
                    associatedToken,
                    beneficiary,
                    fundingAmount,
                    0,
                    start,
                    streamName || "",
                    fundingAmount || 0,
                    0,
                    0,
                    100
                ),
            );

        } else {

            beneficiaryTokenAccountKey = await Utils.findATokenAddress(beneficiary, associatedToken);
            const beneficiaryTokenAccountInfo = await this.connection.getAccountInfo(beneficiaryTokenAccountKey);

            if (beneficiaryTokenAccountInfo === null) {
                ixs.push(
                    await Instructions.createATokenAccountInstruction(
                        beneficiaryTokenAccountKey,
                        treasurer,
                        beneficiary,
                        associatedToken
                    )
                );
            }

            ixs.push(
                await Instructions.transferInstruction(
                    this.programId,
                    treasurer,
                    treasurerToken,
                    beneficiaryTokenAccountKey,
                    associatedToken,
                    fundingAmount
                )
            );
        }

        let tx = new Transaction().add(...ixs);
        tx.feePayer = treasurer;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        tx.recentBlockhash = hash.blockhash;

        if (streamAccount) {
            txSigners.push(streamAccount);
        }

        tx.partialSign(...txSigners);

        return tx;
    }

    public async oneTimePaymentTransactions(
        treasurer: PublicKey,
        treasury: PublicKey | undefined,
        beneficiary: PublicKey,
        associatedToken: PublicKey,
        fundingAmount: number,
        startUtc?: Date,
        streamName?: String

    ): Promise<Transaction[]> {

        let txs: Transaction[] = [];
        let now = Date.parse(new Date().toUTCString());
        let start = startUtc !== undefined ? startUtc.valueOf() : now;

        const treasurerTokenAccountKey = await Utils.findATokenAddress(treasurer, associatedToken);
        const treasurerTokenAccountInfo = await this.connection.getAccountInfo(treasurerTokenAccountKey);

        if (treasurerTokenAccountInfo === null) {
            throw Error(ErrorConstants.AccountNotFound);
        }

        if (fundingAmount) { // Wrap only if there is an initial funding amount for the stream

            if (associatedToken.toBase58() === Constants.WSOL_TOKEN_MINT_ADDRESS) {
                txs.push(
                    await this.wrapTransaction(
                        treasurer,
                        treasurerTokenAccountKey,
                        associatedToken,
                        fundingAmount
                    )
                );
            }
        }

        if (start > now && treasury === undefined) {
            // Create the treasury
            txs.push(
                await this.createTreasuryTransaction(
                    treasurer,
                    associatedToken
                )
            );
        }

        txs.push(
            await this.oneTimePaymentTransaction(
                treasurer,
                treasurerTokenAccountKey,
                treasury,
                beneficiary,
                associatedToken,
                fundingAmount,
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
        wallet: Wallet,
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

    private async createTreasuryTransaction(
        treasurer: PublicKey,
        mint: PublicKey

    ): Promise<Transaction> {

        let ixs: TransactionInstruction[] = [];

        const mintAccount = Keypair.generate();
        const mintMinimumBalance = await this.connection.getMinimumBalanceForRentExemption(MintLayout.span);

        // Create the treasury mint
        ixs.push(
            SystemProgram.createAccount({
                fromPubkey: treasurer,
                newAccountPubkey: mintAccount.publicKey,
                programId: TOKEN_PROGRAM_ID,
                lamports: mintMinimumBalance,
                space: MintLayout.span
            })
        );

        const treasuryMinimumBalance = await this.connection.getMinimumBalanceForRentExemption(Layout.treasuryLayout.span);
        const slot = await this.connection.getSlot();
        const seeds = [Buffer.from([slot])];
        const bumpSeed = (await PublicKey.findProgramAddress(seeds, this.programId))[1];
        const seed = Buffer.from([slot, bumpSeed]).toString();
        const treasury = await PublicKey.createWithSeed(treasurer, seed, this.programId);

        // Create the treasury account
        ixs.push(
            SystemProgram.createAccountWithSeed({
                fromPubkey: treasurer,
                newAccountPubkey: treasury,
                basePubkey: treasurer,
                seed: seed,
                lamports: treasuryMinimumBalance,
                space: Layout.treasuryLayout.span,
                programId: this.programId
            })
        );

        // Get the money streaming program operations token account or create a new one
        const mspOpsAccountKey = Constants.MSP_OPERATIONS_ADDRESS.toPublicKey();
        const mspOpsTokenAccountKey = await Utils.findATokenAddress(mspOpsAccountKey, mint);
        const mspOpsTokenAccountInfo = await this.connection.getAccountInfo(mspOpsTokenAccountKey);

        if (mspOpsTokenAccountInfo === null) {
            ixs.push(
                await Instructions.createATokenAccountInstruction(
                    mspOpsTokenAccountKey,
                    treasurer,
                    mspOpsAccountKey,
                    mint
                )
            );
        }

        ixs.push(
            await Instructions.createTreasuryInstruction(
                this.programId,
                treasurer,
                treasury,
                mintAccount.publicKey,
                mspOpsAccountKey,
                mspOpsTokenAccountKey,
                bumpSeed
            )
        );

        let tx = new Transaction().add(...ixs);
        tx.feePayer = treasurer;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        tx.recentBlockhash = hash.blockhash;
        tx.partialSign(mintAccount);

        return tx;
    }

    async createStreamTransaction(
        treasurer: PublicKey,
        treasury: PublicKey | undefined,
        beneficiary: PublicKey,
        treasurerAssociatedToken: PublicKey,
        beneficiaryAssociatedToken: PublicKey,
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

        let ixs: TransactionInstruction[] = [];
        let txSigners: Signer[] = [];

        const treasuryAccountKey = (treasury === undefined) ? PublicKey.default : (treasury as PublicKey);
        const treasuryTokenAccountKey = await Utils.findATokenAddress(treasuryAccountKey, beneficiaryAssociatedToken);
        const treasuryTokenAccountInfo = await this.connection.getAccountInfo(treasuryTokenAccountKey);

        if (treasuryTokenAccountInfo === null) {
            ixs.push(
                await Instructions.createATokenAccountInstruction(
                    treasuryTokenAccountKey,
                    treasurer,
                    treasuryAccountKey,
                    beneficiaryAssociatedToken
                )
            );
        }

        // Create stream account
        const streamAccount = Keypair.generate();
        const streamMinimumBalance = await this.connection.getMinimumBalanceForRentExemption(Layout.streamLayout.span);
        const treasurerTokenAccountKey = await Utils.findATokenAddress(treasurer, treasurerAssociatedToken);

        ixs.push(
            SystemProgram.createAccount({
                fromPubkey: treasurer,
                newAccountPubkey: streamAccount.publicKey,
                lamports: streamMinimumBalance,
                space: Layout.streamLayout.span,
                programId: this.programId
            })
        );

        txSigners.push(streamAccount);
        const beneficiaryTokenAccountKey = await Utils.findATokenAddress(beneficiary, beneficiaryAssociatedToken);

        // Create stream contract
        ixs.push(
            await Instructions.createStreamInstruction(
                this.programId,
                treasurer,
                treasurerTokenAccountKey,
                beneficiaryTokenAccountKey,
                treasuryAccountKey,
                treasuryTokenAccountKey,
                streamAccount.publicKey,
                beneficiaryAssociatedToken,
                beneficiary,
                rateAmount || 0.0,
                rateIntervalInSeconds || 0,
                startUtc?.valueOf() || Date.parse(new Date().toUTCString()),
                streamName || "",
                fundingAmount || 0,
                rateCliffInSeconds || 0,
                cliffVestAmount || 0,
                cliffVestPercent || 100,
                autoPauseInSeconds || ((rateAmount || 0) * (rateIntervalInSeconds || 0))
            ),
        );

        let tx = new Transaction().add(...ixs);
        tx.feePayer = treasurer;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        tx.recentBlockhash = hash.blockhash;
        tx.partialSign(...txSigners);

        return tx;
    }

    public async createStreamTransactions(
        wallet: Wallet,
        treasury: PublicKey | undefined,
        beneficiary: PublicKey,
        treasurerAssociatedToken: PublicKey,
        beneficiaryAssociatedToken: PublicKey,
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

        const treasurerTokenAccountKey = await Utils.findATokenAddress(wallet.publicKey, treasurerAssociatedToken);

        if (fundingAmount && fundingAmount > 0) { // Wrap or Swap only if the is an initial funding amount for the stream

            if (treasurerAssociatedToken.toBase58() === Constants.WSOL_TOKEN_MINT_ADDRESS) {
                // Wrap
                txs.push(
                    await this.wrapTransaction(
                        wallet.publicKey,
                        treasurerTokenAccountKey,
                        treasurerAssociatedToken,
                        fundingAmount
                    )
                );
            }

            if (treasurerAssociatedToken.toBase58() !== beneficiaryAssociatedToken.toBase58()) {
                // Force to use the same associated token on DEVNET
                if (this.cluster === Constants.DEVNET_CLUSTER) {
                    throw Error(ErrorConstants.TokensDoNotMatch);
                }
                // Swap (amount to contributionAmount in treasuryAssociatedToken)
                txs.push(
                    await this.swapTransaction(
                        wallet,
                        treasurerAssociatedToken,
                        beneficiaryAssociatedToken,
                        fundingAmount
                    )
                );
            }
        }

        // Create the treasury
        if (treasury === undefined) {
            txs.push(
                await this.createTreasuryTransaction(
                    wallet.publicKey,
                    beneficiaryAssociatedToken
                )
            );
        }

        txs.push(
            await this.createStreamTransaction(
                wallet.publicKey,
                treasury,
                beneficiary,
                treasurerAssociatedToken,
                beneficiaryAssociatedToken,
                rateAmount,
                rateIntervalInSeconds,
                startUtc,
                streamName,
                fundingAmount,
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
        treasury: PublicKey,
        treasuryToken: PublicKey,
        beneficiaryMintToken: PublicKey,
        stream: PublicKey,
        amount: number,
        resume?: boolean

    ): Promise<Transaction> {

        let ixs: TransactionInstruction[] = [];

        const treasuryInfo = await Utils.getTreasury(
            this.programId,
            this.connection,
            treasury,
            this.commitment
        );

        if (treasuryInfo === undefined) {
            throw Error(ErrorConstants.AccountNotFound);
        }

        // Get the contributor treasury token account or create a new one
        const treasuryMintTokenKey = treasuryInfo.mintAddress as PublicKey;
        const contributorTreasuryTokenKey = await Utils.findATokenAddress(
            treasury,
            treasuryMintTokenKey
        );

        const contributorTreasuryTokenAccountInfo = await this.connection.getAccountInfo(contributorTreasuryTokenKey);

        if (contributorTreasuryTokenAccountInfo === null) {
            ixs.push(
                await Instructions.createATokenAccountInstruction(
                    contributorTreasuryTokenKey,
                    contributor,
                    treasury,
                    treasuryMintTokenKey
                )
            );
        }

        // Get the money streaming program operations token account or create a new one
        const mspOpsAccountKey = Constants.MSP_OPERATIONS_ADDRESS.toPublicKey();
        const mspOpsTokenAccountKey = await Utils.findATokenAddress(
            mspOpsAccountKey,
            beneficiaryMintToken
        );

        const mspOpsTokenAccountInfo = await this.connection.getAccountInfo(mspOpsTokenAccountKey);

        if (mspOpsTokenAccountInfo === null) {
            ixs.push(
                await Instructions.createATokenAccountInstruction(
                    mspOpsTokenAccountKey,
                    contributor,
                    mspOpsAccountKey,
                    beneficiaryMintToken
                )
            );
        }

        ixs.push(
            await Instructions.addFundsInstruction(
                this.programId,
                contributor,
                contributorToken,
                contributorTreasuryTokenKey,
                beneficiaryMintToken,
                treasury,
                treasuryToken,
                treasuryMintTokenKey,
                stream,
                mspOpsTokenAccountKey,
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

    public async addFundsTransactions(
        wallet: Wallet,
        stream: PublicKey,
        contributorAssociatedToken: PublicKey,
        amount: number,
        resume?: boolean

    ): Promise<Transaction[]> {

        let txs: Transaction[] = [];
        let streamInfo = await Utils.getStream(
            this.connection,
            stream,
            false
        );

        if (streamInfo === null) {
            throw Error(ErrorConstants.AccountNotFound);
        }

        const treasuryAccountKey = new PublicKey(streamInfo.treasuryAddress as PublicKey);
        const beneficiaryMintTokenKey = new PublicKey(streamInfo.associatedToken as PublicKey);
        const contributorAccountKey = wallet.publicKey;
        const contributorTokenAccountKey = await Utils.findATokenAddress(contributorAccountKey, contributorAssociatedToken);
        const treasuryTokenAccountKey = await Utils.findATokenAddress(treasuryAccountKey, contributorAssociatedToken);

        if (contributorTokenAccountKey.toBase58() === Constants.WSOL_TOKEN_MINT_ADDRESS) {
            // Wrap
            txs.push(
                await this.wrapTransaction(
                    wallet.publicKey,
                    contributorTokenAccountKey,
                    contributorAssociatedToken,
                    amount
                )
            );
        }

        if (contributorAssociatedToken.toBase58() !== beneficiaryMintTokenKey.toBase58()) {

            if (this.cluster === Constants.DEVNET_CLUSTER) { // Force to use the same associated token on DEVNET
                throw Error(ErrorConstants.TokensDoNotMatch);
            }

            // Swap (amount to contributionAmount in treasuryAssociatedToken)
            txs.push(
                await this.swapTransaction(
                    wallet,
                    contributorAssociatedToken,
                    beneficiaryMintTokenKey,
                    amount
                )
            );
        }

        txs.push(
            await this.addFundsTransaction(
                contributorAccountKey,
                contributorTokenAccountKey,
                treasuryAccountKey,
                treasuryTokenAccountKey,
                beneficiaryMintTokenKey,
                stream,
                amount,
                resume
            )
        );

        return txs;
    }

    public async withdrawTransaction(
        stream: PublicKey,
        beneficiary: PublicKey,
        amount: number

    ): Promise<Transaction> {

        let streamInfo = await Utils.getStream(
            this.connection,
            stream
        );

        if (beneficiary.toBase58() !== streamInfo.beneficiaryAddress as string) {
            throw Error(ErrorConstants.AccountNotFound);
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
            throw Error(ErrorConstants.AccountNotFound);
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
            await Instructions.withdrawInstruction(
                this.programId,
                beneficiary,
                beneficiaryTokenAccountKey,
                mintTokenAccountKey,
                treasuryAccountKey,
                treasuryTokenAccountKey,
                stream,
                amount
            )
        );

        transaction.feePayer = beneficiary;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        transaction.recentBlockhash = hash.blockhash;

        return transaction;
    }

    public async pauseStreamTransaction(
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

    public async resumeStreamTransaction(
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

    public async signTransaction(
        wallet: Wallet,
        transaction: Transaction

    ): Promise<Transaction> {

        try {
            console.log("Sending transaction for wallet for approval...");
            let signedTrans = await wallet.signTransaction(transaction);
            return signedTrans;

        } catch (error) {
            console.log("signTransaction failed!");
            console.log(error);
            throw error;
        }
    }

    public async signAllTransactions(
        wallet: Wallet,
        ...transactions: Transaction[]

    ): Promise<Transaction[]> {

        try {

            console.log("Sending transactions for wallet for approval...");
            let txs: Transaction[] = [];

            for (let tx of transactions) {
                let signedTx = await wallet.signTransaction(tx);
                txs.push(signedTx);
            }

            return txs;

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

    public async sendAllSignedTransactions(...signedTrans: Transaction[]): Promise<string[]> {
        try {

            let signatures: string[] = [];

            for (let tx of signedTrans) {
                console.log('tx: ', tx);
                console.log('tx.serialize(): ', tx.serialize());

                let res = await this.connection.sendRawTransaction(tx.serialize(), {
                    preflightCommitment: this.commitment as Commitment
                });

                console.log('res: ', res);
                console.log("Send Transaction");
                signatures.push(res);
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

    public async closeStreamTransaction(
        stream: PublicKey,
        initializer: PublicKey

    ): Promise<Transaction> {

        let streamInfo = await Utils.getStream(
            this.connection,
            stream
        );

        let counterparty: PublicKey;

        if (initializer.toBase58() === streamInfo.treasurerAddress as string) {
            counterparty = new PublicKey(streamInfo.beneficiaryAddress as string);
        } else if (initializer.toBase58() === streamInfo.beneficiaryAddress as string) {
            counterparty = new PublicKey(streamInfo.treasurerAddress as string);
        } else {
            throw Error(ErrorConstants.Unauthorized);
        }

        const tx = new Transaction();
        const streamAccountKey = streamInfo.id as PublicKey;
        const beneficiaryAccountKey = new PublicKey(streamInfo.beneficiaryAddress as string);
        const mintAccountKey = new PublicKey(streamInfo.associatedToken as string);
        const beneficiaryTokenAccountKey = await Utils.findATokenAddress(
            beneficiaryAccountKey,
            mintAccountKey,
        );

        const treasuryAccountKey = new PublicKey(streamInfo.treasuryAddress as string);
        const treasuryTokenAccountKey = await Utils.findATokenAddress(
            treasuryAccountKey,
            mintAccountKey
        );

        tx.add(
            // Pause stream
            await Instructions.pauseStreamInstruction(
                this.programId,
                initializer,
                stream
            ),

        );

        // Get the money streaming program operations token account or create a new one
        const mspOpsAccountKey = Constants.MSP_OPERATIONS_ADDRESS.toPublicKey();
        const mspOpsTokenAccountKey = await Utils.findATokenAddress(
            mspOpsAccountKey,
            mintAccountKey
        );

        const mspOpsTokenAccountInfo = await this.connection.getAccountInfo(mspOpsTokenAccountKey);

        if (mspOpsTokenAccountInfo === null) {
            tx.add(
                await Instructions.createATokenAccountInstruction(
                    mspOpsTokenAccountKey,
                    initializer,
                    mspOpsAccountKey,
                    mintAccountKey
                )
            );
        }

        tx.add(
            // Close stream
            await Instructions.closeStreamInstruction(
                this.programId,
                initializer,
                counterparty,
                beneficiaryTokenAccountKey,
                mintAccountKey,
                treasuryAccountKey,
                treasuryTokenAccountKey,
                streamAccountKey,
                mspOpsAccountKey,
                mspOpsTokenAccountKey
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
}
