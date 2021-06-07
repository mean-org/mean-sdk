import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, TransactionInstruction } from "@solana/web3.js";
import { Constants } from "./constants";
import { Layout } from "./layout";
import { u64Number } from "./u64Number";

export module Instructions {

    export const createATokenAccountInstruction = async (
        tokenAddress: PublicKey,
        fundingAddress: PublicKey,
        walletAddress: PublicKey,
        splTokenMintAddress: PublicKey

    ): Promise<TransactionInstruction> => {

        const keys = [
            {
                pubkey: fundingAddress,
                isSigner: true,
                isWritable: true,
            },
            {
                pubkey: tokenAddress,
                isSigner: false,
                isWritable: true,
            },
            {
                pubkey: walletAddress,
                isSigner: false,
                isWritable: false,
            },
            {
                pubkey: splTokenMintAddress,
                isSigner: false,
                isWritable: false,
            },
            {
                pubkey: SystemProgram.programId,
                isSigner: false,
                isWritable: false,
            },
            {
                pubkey: Constants.TOKEN_PROGRAM_ADDRESS.toPublicKey(),
                isSigner: false,
                isWritable: false,
            },
            {
                pubkey: SYSVAR_RENT_PUBKEY,
                isSigner: false,
                isWritable: false,
            },
        ];

        return new TransactionInstruction({
            keys,
            programId: Constants.ATOKEN_PROGRAM_ADDRESS.toPublicKey(),
            data: Buffer.alloc(0),
        });
    }

    export const createStreamInstruction = async (
        connection: Connection,
        programId: PublicKey,
        treasurer: PublicKey,
        treasurerATokenAddress: PublicKey,
        treasury: PublicKey,
        treasuryATokenAddress: PublicKey,
        stream: PublicKey,
        beneficiary: PublicKey,
        rateAmount: number,
        rateIntervalInSeconds: number,
        startUtcNow: number,
        streamName?: String,
        fundingAmount?: number,
        rateCliffInSeconds?: number,
        cliffVestAmount?: number,
        cliffVestPercent?: number

    ): Promise<TransactionInstruction> => {

        const treasurerInfo = await connection.getAccountInfo(treasurer);
        const meanfiKey = Constants.MEAN_FI_ADDRESS.toPublicKey();
        const meanfiInfo = await connection.getAccountInfo(meanfiKey);
        const keys = [
            { pubkey: treasurer, isSigner: true, isWritable: false },
            { pubkey: treasurerATokenAddress, isSigner: false, isWritable: true },
            { pubkey: treasurerInfo?.owner as PublicKey, isSigner: false, isWritable: true },
            { pubkey: treasury, isSigner: false, isWritable: false },
            { pubkey: treasuryATokenAddress, isSigner: false, isWritable: true },
            { pubkey: stream, isSigner: false, isWritable: true },
            { pubkey: Constants.STREAM_PROGRAM_ADDRESS.toPublicKey(), isSigner: false, isWritable: false },
            { pubkey: meanfiKey, isSigner: false, isWritable: true },
            { pubkey: meanfiInfo?.owner as PublicKey, isSigner: false, isWritable: true },
            { pubkey: Constants.TOKEN_PROGRAM_ADDRESS.toPublicKey(), isSigner: false, isWritable: false }
        ];

        let data = Buffer.alloc(Layout.createStreamLayout.span)
        {
            let nameBuffer = Buffer.alloc(32).fill((streamName as string), 0, (streamName as string).length);

            const decodedData = {
                tag: 0,
                stream_name: nameBuffer,
                stream_address: stream.toBuffer(),
                treasury_address: treasury.toBuffer(),
                beneficiary_address: beneficiary.toBuffer(),
                funding_amount: fundingAmount,
                rate_amount: rateAmount,
                rate_interval_in_seconds: new u64Number(rateIntervalInSeconds).toBuffer(), // default = MIN
                start_utc: startUtcNow,
                rate_cliff_in_seconds: rateCliffInSeconds as number,
                cliff_vest_amount: cliffVestAmount as number,
                cliff_vest_percent: cliffVestPercent as number,
            };

            const encodeLength = Layout.createStreamLayout.encode(decodedData, data);
            data = data.slice(0, encodeLength);
        };

        return new TransactionInstruction({
            keys,
            programId,
            data,
        });
    }
}