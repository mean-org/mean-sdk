import {
    AccountMeta,
    PublicKey
} from '@solana/web3.js';

export const SOL_MINT = new PublicKey("11111111111111111111111111111111");
export const SOL_MINT_DECIMALS = 9;
export const MAX_FEE_PER_SWAP_IN_LAMPORTS: number = 20000000;

export interface DdcaAccount {
    ddcaAccountAddress: string;
    fromMint: string;
    toMint: string;
    totalDepositsAmount: number;
    startTs: number;
    createdSlot: number;
    amountPerSwap: number;
    intervalInSeconds: number;
    wakeAccountAddress: string,
    startUtc: string;
    lastCompletedSwapTs?: number;
    lastCompletedSwapUtc: string;
    isPaused: boolean;
}

export interface DdcaDetails extends DdcaAccount{
    fromBalance: number;
    toBalance: number;
    fromBalanceWillRunOutByUtc: string
    nextScheduledSwapUtc: string
    swapCount: number;
    swapAvgRate: number;
    lastDepositTs?: number;
    lastDepositSlot: number;
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

  export type DdcaAction =
  | 'exchanged'
  | 'deposited'
  | 'withdrew'
  | 'unknown'

/**
 * DDCA activity
 */
export type DdcaActivity = {
    succeeded: boolean
    transactionSignature: string,
    action: DdcaAction;
    fromMint: string | null;
    fromAmount: number | null;
    toMint: string | null;
    toAmount: number | null;
    networkFeeInLamports?: number;
    dateUtc: string;
}

export const tempoHeaders = new Headers();
tempoHeaders.append('content-type', 'application/json;charset=UTF-8');
tempoHeaders.append('X-Api-Version', '1.0');
// export const tempoRequestOptions: RequestInit = {
//     headers: tempoHeaders
// }

export type CrankAccount = {
    crankAddress: string;
}

export type UpdateTransactionResponse = {
    base64CloseTransaction: string;
}
