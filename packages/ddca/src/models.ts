export interface DdcaAccount {
    id: string;
    fromMint: string;
    toMint: string;
    totalDepositsAmount: number;
    startTs?: number;
    amountPerSwap: number;
    intervalInSeconds: number;
    startUtc: string | undefined;
    lastCompletedSwapTs?: number;
    lastCompletedSwapUtc: string | undefined;
    isPaused: boolean;
}
