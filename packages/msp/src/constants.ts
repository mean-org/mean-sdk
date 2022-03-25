import { PublicKey } from "@solana/web3.js";

/**
 * Constants
 */
 export class Constants {

    static MSP = new PublicKey('MSPCUMbLfy2MeT6geLMMzrUkv1Tx88XRApaVRdyxTuu');
    static FEE_TREASURY = new PublicKey('3TD6SWY9M1mLY2kZWJNavPLhwXvcRsWdnZLRaMzERJBw');
    static WSOL_TOKEN_MINT = new PublicKey('So11111111111111111111111111111111111111112');
    static TREASURY_SIZE = 300;
    static STREAM_SIZE = 500;
    static CLIFF_PERCENT_NUMERATOR = 10_000;
    static CLIFF_PERCENT_DENOMINATOR = 1_000_000;
    static MAX_TX_SIZE = 1200;
}