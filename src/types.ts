/**
 * Solana
 */
import { PublicKey } from "@solana/web3.js"

declare global {
    export interface String {
        toPublicKey(): PublicKey;
    }
}

/**
 * MSP Instructions types
 */
export enum MSP_ACTIONS {
    oneTimePayment = 1,
    scheduleOneTimePayment = 2,
    createStream = 3,
    createStreamWithFunds = 4,
    addFunds = 5,
    withdraw = 6,
    pauseStream = 7,
    resumeStream = 8,
    proposeUpdate = 9,
    answerUpdate = 10,
    createTreasury = 11,
    closeStream = 12,
    wrapSol = 13
}

/**
 * Transaction fees
 */
export type TransactionFees = {
    /* Solana fees calculated based on the tx signatures and cluster */
    blockchainFee: number;
    /* MSP flat fee amount depending of the instruction that is being executed */
    mspFlatFee: number;
    /* MSP fee amount in percent depending of the instruction that is being executed */
    mspPercentFee: number;
}

/**
 * Transaction fees parameters
 */
export type TransactionFeesParams = {
    instruction: MSP_ACTIONS;
    signaturesAmount: number;
}

/**
 * Transaction message
 */
export type TransactionMessage = {
    action: string,
    description: string,
    amount: number,
    fees: TransactionFees
}

/**
 * Stream activity
 */
export type StreamActivity = {
    signature: string,
    initializer: string,
    action: string;
    amount: number;
    mint: string;
    blockTime: number;
    utcDate: string;
}

/**
 * Treasury info
 */
export type TreasuryInfo = {
    id: PublicKey | string | undefined,
    initialized: boolean,
    treasuryBlockHeight: number,
    treasuryMintAddress: PublicKey | string | undefined,
    treasuryBaseAddress: PublicKey | string | undefined,
}

/**
 * Stream contract terms
 */
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

/**
 * Stream info
 */
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

/**
 * Constants
 */
export class Constants {

    static MEMO_PROGRAM_KEY = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    static ASSOCIATED_TOKEN_PROGRAM_KEY = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
    static WSOL_TOKEN_MINT_KEY = new PublicKey('So11111111111111111111111111111111111111112');
    static SERUM_DEX_KEY = new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');
    static SERUM_SWAP_KEY = new PublicKey('22Y43yTVxuUkoRKdm9thyRhQ3SdgQS7c7kB6UNCiaczD');
    static DEVNET_SLUG = 'devnet';
    static TESTNET_SLUG = 'testnet';
    static MAINNET_BETA_SLUG = 'mainnet-beta';
}

/**
 * PublicKeys keypairs
 */
export class PublicKeys {

    static MSP_PROGRAM_KEY: Record<string, PublicKey> = {
        'devnet': new PublicKey('9yMq7x4LstWYWi14pr8BEBsEX33L3HnugpiM2PT96x4k'),
        'testnet': new PublicKey('37z61WhJCAaDADwcpJRHgr66FUhHB9TfkS49Ssvp3Cdb'),
        'mainnet-beta': new PublicKey('H6wJxgkcc93yeUFnsZHgor3Q3pSWgGpEysfqKrwLtMko')
    };

    static MSP_OPS_KEY: Record<string, PublicKey> = {
        'devnet': new PublicKey('BgxJuujLZDR27SS41kYZhsHkXx6CP2ELaVyg1qBxWYNU'),
        'testnet': new PublicKey('BgxJuujLZDR27SS41kYZhsHkXx6CP2ELaVyg1qBxWYNU'),
        'mainnet-beta': new PublicKey('CLazQV1BhSrxfgRHko4sC8GYBU3DoHcX4xxRZd12Kohr')
    };

    static USDC_TOKEN_MINT_KEY: Record<string, PublicKey> = {
        'devnet': new PublicKey('AbQBt9V212HpPVk64YWAApFJrRzdAdu66fwF9neYucpU'),
        'testnet': new PublicKey('AbQBt9V212HpPVk64YWAApFJrRzdAdu66fwF9neYucpU'),
        'mainnet-beta': new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
    };

    static USDT_TOKEN_MINT_KEY: Record<string, PublicKey> = {
        'devnet': new PublicKey('42f2yFqXh8EDCRCiEBQSweWqpTzKGa9DC8e7UjUfFNrP'),
        'testnet': new PublicKey('42f2yFqXh8EDCRCiEBQSweWqpTzKGa9DC8e7UjUfFNrP'),
        'mainnet-beta': new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB')
    };
}
