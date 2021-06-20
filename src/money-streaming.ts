import { BN, Wallet } from '@project-serum/anchor';
import { Token, AccountLayout, u64 } from '@solana/spl-token';
import { TOKEN_PROGRAM_ID } from '@project-serum/serum/lib/token-instructions';
import { Account, LAMPORTS_PER_SOL, SystemInstruction, TransactionInstruction } from '@solana/web3.js';
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
import * as Errors from './errors';
import EventEmitter from 'eventemitter3';

const BufferLayout = require('buffer-layout');

export interface WalletAdapter extends EventEmitter, Wallet {
    publicKey: PublicKey;
    signTransaction: (transaction: Transaction) => Promise<Transaction>;
    signAllTransactions(txs: Transaction[]): Promise<Transaction[]>;
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
    private cluster: string;
    private programId: PublicKey;
    private wallet: Wallet;
    private tokenSwap: TokenSwap;
    private commitment: Commitment | ConnectionConfig | undefined;

    /**
     * Create a Streaming API object
     *
     * @param cluster The solana cluster endpoint used for the connecton
     */
    constructor(
        cluster: string,
        programId: PublicKey | string,
        wallet?: Wallet,
        commitment: Commitment | string = 'finalized'
    ) {
        this.cluster = cluster;
        this.wallet = wallet as Wallet;
        this.connection = new Connection(cluster, commitment as Commitment);

        if (typeof programId === 'string') {
            this.programId = programId.toPublicKey();
        } else {
            this.programId = programId;
        }

        this.tokenSwap = new TokenSwap(
            this.connection,
            this.wallet,
            this.commitment as Commitment
        );
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

    public async oneTimePaymentTransaction(
        treasurer: PublicKey,
        beneficiary: PublicKey,
        associatedToken: PublicKey,
        fundingAmount: number,
        startUtc?: Date,
        streamName?: String

    ): Promise<Transaction> {

        let ixs: TransactionInstruction[] = [];
        let streamAccount: any,
            treasuryAccountKey: PublicKey = PublicKey.default,
            treasuryTokenAccountKey: PublicKey = PublicKey.default,
            beneficiaryTokenAccountKey: PublicKey = PublicKey.default;

        let now = Date.parse(new Date().toUTCString());
        let start = startUtc !== undefined ? startUtc.valueOf() : now;

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

            const [treasuryKey] = await Utils.findMSPAddress(streamAccount.publicKey, this.programId);
            treasuryAccountKey = treasuryKey;
            treasuryTokenAccountKey = await Utils.findATokenAddress(treasuryAccountKey, associatedToken);
            const treasuryTokenAccountInfo = await this.connection.getAccountInfo(treasuryTokenAccountKey);

            if (treasuryTokenAccountInfo === null) {
                ixs.push(
                    await Instructions.createATokenAccountInstruction(
                        treasuryTokenAccountKey,
                        treasurer,
                        treasuryAccountKey,
                        associatedToken
                    )
                );
            }
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
        }

        const treasurerTokenAccountKey = await Utils.findATokenAddress(treasurer, associatedToken);
        const treasurerTokenAccountInfo = await this.connection.getAccountInfo(treasurerTokenAccountKey);

        if (treasurerTokenAccountInfo === null) {
            throw Errors.MSPError(ErrorConstants.AccountNotFound, `Treasurer token account ${treasurerTokenAccountInfo} not found`);
        }

        // Create stream contract
        ixs.push(
            await Instructions.createStreamInstruction(
                this.programId,
                treasurer,
                treasurerTokenAccountKey,
                beneficiaryTokenAccountKey,
                treasuryAccountKey,
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

        let tx = new Transaction().add(...ixs);
        tx.feePayer = treasurer;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        tx.recentBlockhash = hash.blockhash;

        if (streamAccount) {
            tx.partialSign(streamAccount as Keypair);
        }

        return tx;
    }

    public async getOneTimePaymentTransactions(
        treasurer: PublicKey,
        beneficiary: PublicKey,
        associatedToken: PublicKey,
        fundingAmount: number,
        startUtc?: Date,
        streamName?: String

    ): Promise<Transaction[]> {

        let txs: Transaction[] = [];
        const treasurerTokenAccountKey = await Utils.findATokenAddress(treasurer, associatedToken);
        const treasurerTokenAccountInfo = await this.connection.getAccountInfo(treasurerTokenAccountKey);

        if (treasurerTokenAccountInfo === null) {
            throw Errors.MSPError(ErrorConstants.AccountNotFound, `Treasurer token account ${treasurerTokenAccountInfo} not found`);
        }

        if (fundingAmount) { // Wrap or Swap only if the is an initial funding amount for the stream

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

        txs.push(
            await this.oneTimePaymentTransaction(
                treasurer,
                beneficiary,
                associatedToken,
                fundingAmount,
                startUtc,
                streamName
            )
        );

        return txs;
    }

    public async wrapTransaction(
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

    public async swapTransaction(
        payer: PublicKey,
        fromMint: PublicKey,
        toMint: PublicKey,
        amount: number

    ): Promise<Transaction> {

        const fromMintAccountInfo = await Utils.getMintAccount(this.connection, fromMint);
        const toMintAccountInfo = await Utils.getMintAccount(this.connection, toMint);

        if (fromMintAccountInfo === null) {
            throw Errors.MSPError(ErrorConstants.AccountNotFound, `From mint account ${fromMint} nor found`);
        } else if (toMintAccountInfo === null) {
            throw Errors.MSPError(ErrorConstants.AccountNotFound, `To mint account ${toMint} nor found`);
        } else {
            const estimatedAmount = await this.tokenSwap.estimate({
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

            let tx = await this.tokenSwap.swapTransaction({
                fromMint: fromMint,
                toMint: toMint,
                amount: new BN(amount),
                minExchangeRate: minExchangeRate
            });

            tx.feePayer = payer;
            let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
            tx.recentBlockhash = hash.blockhash;

            return tx;
        }
    }

    public async createStreamTransaction(
        treasurer: PublicKey,
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
        cliffVestPercent?: number

    ): Promise<Transaction> {

        let ixs: TransactionInstruction[] = [];
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

        const [treasuryAccountKey] = await Utils.findMSPAddress(streamAccount.publicKey, this.programId);
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
                cliffVestPercent || 100
            ),
        );

        let tx = new Transaction().add(...ixs);
        tx.feePayer = treasurer;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        tx.recentBlockhash = hash.blockhash;
        tx.partialSign(streamAccount);

        return tx;
    }

    public async getCreateStreamTransactions(
        treasurer: PublicKey,
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
        cliffVestPercent?: number

    ): Promise<Transaction[]> {

        let txs: Transaction[] = [];
        const treasurerTokenAccountKey = await Utils.findATokenAddress(treasurer, treasurerAssociatedToken);

        if (fundingAmount) { // Wrap or Swap only if the is an initial funding amount for the stream

            if (treasurerAssociatedToken.toBase58() === Constants.WSOL_TOKEN_MINT_ADDRESS) {
                // Wrap
                txs.push(
                    await this.wrapTransaction(
                        treasurer,
                        treasurerTokenAccountKey,
                        treasurerAssociatedToken,
                        fundingAmount
                    )
                );
            }

            if (treasurerAssociatedToken.toBase58() !== beneficiaryAssociatedToken.toBase58()) {
                // Force to use the same associated token on DEVNET
                if (this.cluster === Constants.DEVNET_CLUSTER) {
                    throw Errors.MSPError(ErrorConstants.AccountNotFound, `Associated token accounts doesn't match`);
                }
                // Swap (amount to contributionAmount in treasuryAssociatedToken)
                txs.push(
                    await this.swapTransaction(
                        treasurer,
                        treasurerAssociatedToken,
                        beneficiaryAssociatedToken,
                        fundingAmount
                    )
                );
            }
        }

        txs.push(
            await this.createStreamTransaction(
                treasurer,
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
                cliffVestPercent
            )
        );

        return txs;
    }

    public async getAddFundsTransaction(
        stream: PublicKey,
        contributor: PublicKey,
        contributorToken: PublicKey,
        amount: number

    ): Promise<Transaction> {

        let streamInfo = await Utils.getStream(
            this.connection,
            stream,
            false
        );

        if (streamInfo === null) {
            throw Errors.MSPError(ErrorConstants.AccountNotFound, `Stream with id = ${stream} not found`);
        }

        const transaction = new Transaction();
        const contributorTokenAccountKey = await Utils.findATokenAddress(contributor, contributorToken);
        const contributorTokenAccountInfo = await this.connection.getAccountInfo(contributorTokenAccountKey);
        const treasury = new PublicKey(streamInfo.treasurerAddress as PublicKey);
        const treasuryAssociatedToken = new PublicKey(streamInfo.associatedToken as PublicKey);
        const treasuryTokenAccountKey = await Utils.findATokenAddress(
            treasury,
            treasuryAssociatedToken
        );

        let contributionAmount = amount;

        if (contributorTokenAccountInfo === null) {

            if (contributorToken.toBase58() !== Constants.WSOL_TOKEN_MINT_ADDRESS) {
                throw Errors.MSPError(ErrorConstants.AccountNotFound, 'Invalid associated token account');
            }

            // Wrap
            transaction.add(
                await Instructions.createATokenAccountInstruction(
                    contributorTokenAccountKey,
                    contributor,
                    contributor,
                    contributorToken
                ),
                Token.createTransferInstruction(
                    TOKEN_PROGRAM_ID,
                    contributor,
                    contributorTokenAccountKey,
                    contributor,
                    [],
                    (contributionAmount as number) * 10 ** LAMPORTS_PER_SOL
                )
            );
        }

        if (contributorToken.toBase58() !== Constants.WSOL_TOKEN_MINT_ADDRESS) {
            if (this.cluster === Constants.DEVNET_CLUSTER) {
                throw Errors.MSPError(ErrorConstants.AccountNotFound, `Associated token accounts doesn't match`);
            } else {
                // Swap (amount to contributionAmount in treasuryAssociatedToken)
            }
        }

        transaction.add(
            await Instructions.addFundsInstruction(
                this.programId,
                stream,
                contributor,
                contributorTokenAccountKey,
                treasury,
                treasuryTokenAccountKey,
                treasuryAssociatedToken,
                contributionAmount
            )
        );

        transaction.feePayer = contributor;
        let hash = await this.connection.getRecentBlockhash(this.commitment as Commitment);
        transaction.recentBlockhash = hash.blockhash;

        return transaction;
    }

    public async getWithdrawTransaction(
        stream: PublicKey,
        beneficiary: PublicKey,
        amount: number

    ): Promise<Transaction> {

        let streamInfo = await Utils.getStream(
            this.connection,
            stream
        );

        if (beneficiary.toBase58() !== streamInfo.beneficiaryAddress as string) {
            throw Errors.MSPError(ErrorConstants.AccountNotCredited, 'Not authorized to withdraw from this stream');
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
            throw Errors.MSPError(ErrorConstants.AccountNotCredited, `Beneficiary wallet account ${beneficiary} not credited`);
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
                stream,
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
        wallet: WalletAdapter,
        transactions: Transaction[]

    ): Promise<Transaction[]> {

        try {
            console.log("Sending transactions for wallet for approval...");
            let signedTrans = await wallet.signAllTransactions(transactions);
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
