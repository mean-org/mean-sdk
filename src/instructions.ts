import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, TransactionInstruction } from "@solana/web3.js";
import { Constants } from "./constants";
import { Layout } from "./layout";
import { u64Number } from "./u64Number";
import { Buffer } from 'buffer';
import * as Utils from "./utils";
import { StreamInfo } from "./money-streaming";

const BufferLayout = require('buffer-layout');

export module Instructions {

    export const createMSPAccountInstruction = async (
        connection: Connection,
        from: PublicKey,
        programId: PublicKey,
        lamports: number,
        space: number

    ): Promise<TransactionInstruction> => {

        const [accountKey, _] = await Utils.findMSPAddress(from, programId);
        const balance = await connection.getMinimumBalanceForRentExemption(space);
        const dataLayout = BufferLayout.struct([
            BufferLayout.u8('instruction'),
            BufferLayout.nu64('lamports'),
            BufferLayout.nu64('amount'),
            Layout.publicKey('owner')
        ]);

        let data = Buffer.alloc(dataLayout.span)
        {
            const decodedData = {
                instruction: 0,
                lamports: balance,
                space: dataLayout.span,
                owner: programId
            };

            const encodeLength = dataLayout.encode(decodedData, data);
            data = data.slice(0, encodeLength);
        };

        return new TransactionInstruction({
            keys: [
                { pubkey: from, isSigner: true, isWritable: true },
                { pubkey: accountKey, isSigner: false, isWritable: true }
            ],
            programId: Constants.ATOKEN_PROGRAM_ADDRESS.toPublicKey(),
            data
        });
    }

    export const createATokenAccountInstruction = async (
        tokenAddress: PublicKey,
        fundingAddress: PublicKey,
        ownerAddress: PublicKey,
        splTokenMintAddress: PublicKey

    ): Promise<TransactionInstruction> => {

        return new TransactionInstruction({
            keys: [
                { pubkey: fundingAddress, isSigner: true, isWritable: true },
                { pubkey: tokenAddress, isSigner: false, isWritable: true },
                { pubkey: ownerAddress, isSigner: false, isWritable: false },
                { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: Constants.TOKEN_PROGRAM_ADDRESS.toPublicKey(), isSigner: false, isWritable: false },
                { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            ],
            programId: Constants.ATOKEN_PROGRAM_ADDRESS.toPublicKey(),
        });
    }

    export const createStreamInstruction = async (
        programId: PublicKey,
        treasurer: PublicKey,
        treasurerToken: PublicKey,
        treasury: PublicKey,
        treasuryToken: PublicKey,
        stream: PublicKey,
        associatedToken: PublicKey,
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

        const mspOpsAccount = Constants.MSP_OPERATIONS_ADDRESS.toPublicKey();
        const splTokenProgramAccount = Constants.TOKEN_PROGRAM_ADDRESS.toPublicKey();
        const aTokenProgramAccount = Constants.ATOKEN_PROGRAM_ADDRESS.toPublicKey();
        const keys = [
            { pubkey: treasurer, isSigner: true, isWritable: false },
            { pubkey: treasurerToken, isSigner: false, isWritable: true },
            { pubkey: treasury, isSigner: false, isWritable: true },
            { pubkey: treasuryToken, isSigner: false, isWritable: true },
            { pubkey: stream, isSigner: false, isWritable: true },
            { pubkey: associatedToken, isSigner: false, isWritable: false },
            { pubkey: mspOpsAccount, isSigner: false, isWritable: true },
            { pubkey: programId, isSigner: false, isWritable: false },
            { pubkey: splTokenProgramAccount, isSigner: false, isWritable: false },
            { pubkey: aTokenProgramAccount, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
        ];

        let data = Buffer.alloc(Layout.createStreamLayout.span)
        {
            let nameBuffer = Buffer.alloc(32).fill((streamName as string), 0, (streamName as string).length);
            let startDateValue = new Date();
            startDateValue.setTime(startUtcNow);
            let utcNow = Utils.convertLocalDateToUTCIgnoringTimezone(new Date());

            if (startDateValue.getTime() < utcNow.getTime()) {
                startDateValue = utcNow;
            }

            const decodedData = {
                tag: 0,
                beneficiary_address: beneficiary.toBuffer(),
                stream_name: nameBuffer,
                funding_amount: fundingAmount,
                rate_amount: rateAmount,
                rate_interval_in_seconds: new u64Number(rateIntervalInSeconds).toBuffer(), // default = MIN
                start_utc: startDateValue.getTime(),
                rate_cliff_in_seconds: new u64Number(rateCliffInSeconds as number).toBuffer(),
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

    export const createWithdrawInstruction = async (
        programId: PublicKey,
        beneficiary: PublicKey,
        beneficiaryToken: PublicKey,
        associatedToken: PublicKey,
        treasury: PublicKey,
        treasuryToken: PublicKey,
        streamId: PublicKey,
        amount: number

    ): Promise<TransactionInstruction> => {

        const mspOpsAccount = Constants.MSP_OPERATIONS_ADDRESS.toPublicKey();
        const splTokenProgramAccount = Constants.TOKEN_PROGRAM_ADDRESS.toPublicKey();
        const keys = [
            { pubkey: beneficiary, isSigner: true, isWritable: false },
            { pubkey: beneficiaryToken, isSigner: false, isWritable: true },
            { pubkey: associatedToken, isSigner: false, isWritable: false },
            { pubkey: treasury, isSigner: false, isWritable: false },
            { pubkey: treasuryToken, isSigner: false, isWritable: true },
            { pubkey: streamId, isSigner: false, isWritable: true },
            { pubkey: mspOpsAccount, isSigner: false, isWritable: true },
            { pubkey: programId, isSigner: false, isWritable: false },
            { pubkey: splTokenProgramAccount, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ];

        let data = Buffer.alloc(Layout.withdrawLayout.span)
        {
            const decodedData = {
                tag: 2,
                withdrawal_amount: amount
            };

            const encodeLength = Layout.withdrawLayout.encode(decodedData, data);
            data = data.slice(0, encodeLength);
        };

        return new TransactionInstruction({
            keys,
            programId,
            data,
        });
    }

    export const apporveTokenDelegation = async (
        sourceToken: PublicKey,
        delegate: PublicKey,
        sourceTokenOwner: PublicKey,
        delegateAmount: number

    ): Promise<TransactionInstruction> => {

        const programId = Constants.TOKEN_PROGRAM_ADDRESS.toPublicKey();
        const keys = [
            { pubkey: sourceToken, isSigner: false, isWritable: true },
            { pubkey: delegate, isSigner: false, isWritable: false },
            { pubkey: sourceTokenOwner, isSigner: true, isWritable: false }
        ];

        let data = Buffer.alloc(Layout.approveDelegationLayout.span)
        {
            const decodedData = {
                instruction: 4,
                amount: delegateAmount
            };

            const encodeLength = Layout.approveDelegationLayout.encode(decodedData, data);
            data = data.slice(0, encodeLength);
        };

        return new TransactionInstruction({
            keys,
            programId,
            data
        });
    }

    export const closeStreamInstruction = async (
        programId: PublicKey,
        initializer: PublicKey,
        counterparty: PublicKey,
        beneficiaryToken: PublicKey,
        tokenMint: PublicKey,
        treasury: PublicKey,
        treasuryToken: PublicKey,
        streamInfo: StreamInfo

    ): Promise<TransactionInstruction> => {

        const mspOpsAccount = Constants.MSP_OPERATIONS_ADDRESS.toPublicKey();
        const splTokenProgramAccount = Constants.TOKEN_PROGRAM_ADDRESS.toPublicKey();
        const keys = [
            { pubkey: initializer, isSigner: true, isWritable: false },
            { pubkey: counterparty, isSigner: false, isWritable: false },
            { pubkey: streamInfo.id as PublicKey, isSigner: false, isWritable: true },
            { pubkey: beneficiaryToken, isSigner: false, isWritable: true },
            { pubkey: tokenMint, isSigner: false, isWritable: false },
            { pubkey: treasury, isSigner: false, isWritable: false },
            { pubkey: treasuryToken, isSigner: false, isWritable: true },
            { pubkey: mspOpsAccount, isSigner: false, isWritable: true },
            { pubkey: programId, isSigner: false, isWritable: false },
            { pubkey: splTokenProgramAccount, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ];

        let data = Buffer.alloc(1)
        {
            const decodedData = { tag: 5 };
            const encodeLength = Layout.withdrawLayout.encode(decodedData, data);
            data = data.slice(0, encodeLength);
        };

        return new TransactionInstruction({
            keys,
            programId,
            data
        });
    }
}