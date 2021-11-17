import {
    Commitment,
    Connection,
    LAMPORTS_PER_SOL,

} from "@solana/web3.js";
import { DDCA_ACTIONS, MAX_FEE_PER_SWAP_IN_LAMPORTS, TransactionFees } from ".";

export const calculateActionFees = async (
    connection: Connection,
    action: DDCA_ACTIONS,
    swapsCount: number,

): Promise<TransactionFees> => {

    let recentBlockhash = await connection.getRecentBlockhash(connection.commitment as Commitment);
    let lamportsPerSignatureFee = recentBlockhash.feeCalculator.lamportsPerSignature;
    let signaturesCount = 0;
    let maxTotalRentExcemptInLamports = 0;
    let totalAmountNeededForsSwapsInLamports = 0;
    let flatFeeInLamports = 0;
    let percentFee = 0;
    const ddcaAccountSizeInBytes = 500; //TODO: calculate dynamically
    const tokenAccountSizeInBytes = 165; //TODO: calculate dynamically
    const minimumAccountSizeInBytes = 128; //Solana min account size (aka metadata)

    /*
    Note: 
     getMinimumBalanceForRentExemption(size_A)
     + getMinimumBalanceForRentExemption(size_B) 
     != getMinimumBalanceForRentExemption(size_A + size_B)
    There is a 128 bytes in metadata that is not included in the size param passed to 
    getMinimumBalanceForRentExemption
    */

    switch (action) {
        case DDCA_ACTIONS.create: {
            signaturesCount = 2; // owner + temp wrap account
            maxTotalRentExcemptInLamports = 
                await connection.getMinimumBalanceForRentExemption(ddcaAccountSizeInBytes + 3 * (tokenAccountSizeInBytes + minimumAccountSizeInBytes) + minimumAccountSizeInBytes); // 1 account + 3 token accounts + 1 wake account
            totalAmountNeededForsSwapsInLamports = swapsCount * 20000000; //20 million
            flatFeeInLamports = 0;
            percentFee = 0;
            break;
        }
        case DDCA_ACTIONS.addFunds: {
            signaturesCount = 2; // owner + temp wrap account
            maxTotalRentExcemptInLamports = 0;
            totalAmountNeededForsSwapsInLamports = swapsCount * 20000000; //20 million
            flatFeeInLamports = 0;
            percentFee = 0;
            break;
        }
        case DDCA_ACTIONS.withdraw: {
            signaturesCount = 1;
            maxTotalRentExcemptInLamports = 
                await connection.getMinimumBalanceForRentExemption(tokenAccountSizeInBytes + 3 * (tokenAccountSizeInBytes + minimumAccountSizeInBytes)); // 4 token accounts
            flatFeeInLamports = 0;
            totalAmountNeededForsSwapsInLamports = 0;
            percentFee = 0.5;
            break;
        }
        case DDCA_ACTIONS.close: {
            signaturesCount = 1;
            maxTotalRentExcemptInLamports = 
                await connection.getMinimumBalanceForRentExemption(tokenAccountSizeInBytes + 3 * (tokenAccountSizeInBytes + minimumAccountSizeInBytes)); // 4 token accounts
            flatFeeInLamports = 0;
            totalAmountNeededForsSwapsInLamports = 0;
            percentFee = 0.5;
            break;
        }
        default: {
            throw Error("Invalid DDCA action: " + action);
        }
    }

    return {
        maxBlockchainFee: (maxTotalRentExcemptInLamports + lamportsPerSignatureFee * signaturesCount) / LAMPORTS_PER_SOL,
        totalScheduledSwapsFees: totalAmountNeededForsSwapsInLamports / LAMPORTS_PER_SOL,
        flatFee: flatFeeInLamports,
        percentFee: percentFee,
        maxFeePerSwap: MAX_FEE_PER_SWAP_IN_LAMPORTS / LAMPORTS_PER_SOL
    };
}