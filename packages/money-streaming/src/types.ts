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
    scheduleOneTimePayment = 1,
    createStream = 2,
    createStreamWithFunds = 3,
    addFunds = 4,
    withdraw = 5,
    pauseStream = 6,
    resumeStream = 7,
    proposeUpdate = 8,
    answerUpdate = 9,
    createTreasury = 10,
    closeStream = 11,
    wrap = 12,
    swap = 13
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
 * Stream states
 */
 export enum STREAM_STATE {
    Schedule = 1,
    Running = 2,
    Paused = 3,
    Ended = 4
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
    isUpdatePending: boolean,
    transactionSignature: string | undefined,
    blockTime: number,
    state: STREAM_STATE
}
