
export class Constants {

    static DEFAULT_PUBLICKEY = '11111111111111111111111111111111';
    static STREAM_PROGRAM_ADDRESS = '9yMq7x4LstWYWi14pr8BEBsEX33L3HnugpiM2PT96x4k';//'37z61WhJCAaDADwcpJRHgr66FUhHB9TfkS49Ssvp3Cdb';
    static STREAM_PROGRAM_PAYER_ADRESS = 'DCPbrmZSHLT4X83Li2vQKKNVz3f6JFUsXVFd2aAgNvSy';
    static MSP_OPERATIONS_ADDRESS = 'BgxJuujLZDR27SS41kYZhsHkXx6CP2ELaVyg1qBxWYNU';
    static MEMO_PROGRAM_ADDRESS = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
    static TOKEN_PROGRAM_ADDRESS = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
    static TOKEN_SWAP_PROGRAM_ADDRESS = 'SwaPpA9LAaLfeLi3a68M4DjnLqgtticKg6CnyNwgAC8';
    static TOKEN_SWAP_FEE_OWNER_ADDRESS = 'HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN';
    static ATOKEN_PROGRAM_ADDRESS = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
    static WSOL_TOKEN_MINT_ADDRESS = 'So11111111111111111111111111111111111111112';
    static USDC_TOKEN_MINT_ADDRESS = 'AbQBt9V212HpPVk64YWAApFJrRzdAdu66fwF9neYucpU';//'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    static USDT_TOKEN_MINT_ADDRESS = '42f2yFqXh8EDCRCiEBQSweWqpTzKGa9DC8e7UjUfFNrP';//'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
    static ETH_TOKEN_MINT_ADDRESS = '2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk';

    static SERUM_DEX_ADDRESS = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';
    static SERUM_SWAP_ADDRESS = '22Y43yTVxuUkoRKdm9thyRhQ3SdgQS7c7kB6UNCiaczD';
    static TOKEN_ACCOUNT_DATA_SIZE = 82;
    static DEVNET_CLUSTER = 'https://api.devnet.solana.com';
    static DECIMALS = 6
}

export class ErrorConstants {
    static Unauthorized = 'Unauthorized';
    static AccountNotCredited = 'AccountNotCredited';
    static AccountNotFound = 'AccountNotFound';
    static TokensDoNotMatch = 'TokensDoNotMatch';
    static InvalidInitializer = 'InvalidInitializer';
    static InvalidStreamTerms = 'InvalidStreamTerms';
}

export class MSPActionsConstants {
    static Transfer = 'Transfer';
    static CreateStream = 'Create Stream';
    static AddFunds = 'Add Funds';
    static Withdraw = 'Withdraw';
    static CloseStream = 'Close Stream';
}