import {
    AccountMeta,
    PublicKey
} from '@solana/web3.js';

export const SOL_MINT = new PublicKey("11111111111111111111111111111111");
export const MAX_FEE_PER_SWAP_IN_LAMPORTS: number = 20000000;

export interface DdcaAccount {
    ddcaAccountAddress: string;
    fromMint: string;
    toMint: string;
    totalDepositsAmount: number;
    startTs?: number;
    amountPerSwap: number;
    intervalInSeconds: number;
    startUtc: string;
    lastCompletedSwapTs?: number;
    lastCompletedSwapUtc: string;
    isPaused: boolean;
}

export interface DdcaDetails extends DdcaAccount{
    fromBalance: number;
    toBalance: number;
    fromBalanceWillRunOutByUtc: string
    exchangedForAmount: number,
    exchangedRateAverage: number,
    nextScheduledSwapUtc: string
    swapCount: number;
    swapAvgRate: number;
    lastDepositTs?: number;
    lastDepositedtUtc: string;
}

/**
 * DDCA Instructions types
 */
 export enum DDCA_ACTIONS {
    create = 1,
    addFunds = 2,
    withdraw = 3,
    close = 4,
}

/**
 * Transaction fees
 */
export type TransactionFees = {
    /* Solana fees (SOL) calculated based on the tx signatures and cluster*/
    maxBlockchainFee: number;
    /* Amount (SOL) that will be transferred into the DDCA account to pay tx + protocol fees when executing scheduled swaps */
    totalScheduledSwapsFees: number;
    /* Flat fee amount (SOL) depending of the instruction that is being executed */
    flatFee: number;
    /* Fee in percent of token amount depending of the instruction that is being executed */
    percentFee: number;

    maxFeePerSwap: number;
}

/**
 * Transaction fees parameters
 */
export type TransactionFeesParams = {
    instruction: DDCA_ACTIONS;
    swapsCount: number;
    signaturesAmount: number;
}

export type HlaInfo = {
    exchangeRate: number,
    protocolFees: number,
    aggregatorPercentFees: number,
    remainingAccounts: AccountMeta[]
  }
