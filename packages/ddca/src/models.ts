export interface DdcaAccount {
    id: string;
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
}
