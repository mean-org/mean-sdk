import { BN, Provider, Wallet } from "@project-serum/anchor";
import { Swap } from "@project-serum/swap";
import { Commitment, Connection, Finality, GetProgramAccountsConfig, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
// import { TokenListProvider } from '@solana/spl-token-registry'
import { Constants } from "./constants";
import { Layout } from "./layout";
import { StreamInfo } from "./money-streaming";
import { u64Number } from "./u64Number";

import {
    AccountLayout,
    MintInfo,
    MintLayout,
    Token,
    u64

} from '@solana/spl-token';

declare global {
    export interface String {
        toPublicKey(): PublicKey;
    }
}

String.prototype.toPublicKey = function (): PublicKey {
    return new PublicKey(this.toString());
}

let defaultStreamInfo: StreamInfo = {
    id: undefined,
    initialized: false,
    memo: "",
    treasurerAddress: undefined,
    rateAmount: 0,
    rateIntervalInSeconds: 0,
    startUtc: null,
    rateCliffInSeconds: 0,
    cliffVestAmount: 0,
    cliffVestPercent: 0,
    beneficiaryAddress: undefined,
    beneficiaryTokenAddress: undefined,
    escrowVestedAmount: 0,
    escrowUnvestedAmount: 0,
    treasuryAddress: undefined,
    escrowEstimatedDepletionUtc: null,
    totalDeposits: 0,
    totalWithdrawals: 0,
    isStreaming: false,
    isUpdatePending: false,
    transactionSignature: undefined,
    blockTime: 0
}

function parseStreamData(
    streamId: PublicKey,
    streamData: Buffer,
    friendly: boolean = true

): StreamInfo {

    let stream: StreamInfo = defaultStreamInfo;
    let decodedData = Layout.streamLayout.decode(streamData);
    let totalDeposits = decodedData.total_deposits;
    let totalWithdrawals = decodedData.total_withdrawals;
    let startUtc = decodedData.start_utc;
    let startDateUtc = new Date();

    startDateUtc.setTime(startUtc);

    let rateAmount = decodedData.rate_amount;
    let rateIntervalInSeconds = decodedData.rate_interval_in_seconds;
    let escrowVestedAmount = 0;
    let utcNow = new Date();

    // console.log(utcNow.toUTCString());
    // console.log(startDateUtc.toUTCString());

    if (utcNow.getTime() >= startDateUtc.getTime()) {
        escrowVestedAmount = rateAmount * Constants.DECIMALS / rateIntervalInSeconds * (utcNow.getTime() - startDateUtc.getTime());

        if (escrowVestedAmount >= totalDeposits) {
            escrowVestedAmount = totalDeposits;
        }
    }

    let escrowEstimatedDepletionUtc = decodedData.escrow_estimated_depletion_utc;
    let escrowEstimatedDepletionDateUtc = new Date();

    escrowEstimatedDepletionDateUtc.setDate(escrowEstimatedDepletionUtc);

    let nameBuffer = Buffer
        .alloc(decodedData.stream_name.length, decodedData.stream_name)
        .filter(function (elem, index) {
            return elem !== 0;
        });

    const id = friendly !== undefined ? streamId.toBase58() : streamId;
    const treasurerAddress = new PublicKey(decodedData.treasurer_address);
    const beneficiaryAddress = new PublicKey(decodedData.beneficiary_address);
    const beneficiaryTokenAddress = new PublicKey(decodedData.beneficiary_token_address);
    const treasuryAddress = new PublicKey(decodedData.treasury_address);

    Object.assign(stream, { id: id }, {
        initialized: decodedData.initialized,
        memo: new TextDecoder().decode(nameBuffer),
        treasurerAddress: friendly !== undefined ? treasurerAddress.toBase58() : treasurerAddress,
        rateAmount: rateAmount,
        rateIntervalInSeconds: rateIntervalInSeconds,
        startUtc: startDateUtc.toUTCString(),
        rateCliffInSeconds: decodedData.rate_cliff_in_seconds,
        cliffVestAmount: decodedData.cliff_vest_amount,
        cliffVestPercent: decodedData.cliff_vest_percent,
        beneficiaryAddress: friendly !== undefined ? beneficiaryAddress.toBase58() : beneficiaryAddress,
        beneficiaryTokenAddress: friendly !== undefined ? beneficiaryTokenAddress.toBase58() : beneficiaryTokenAddress,
        escrowVestedAmount: escrowVestedAmount,
        escrowUnvestedAmount: totalDeposits - totalWithdrawals - escrowVestedAmount,
        treasuryAddress: friendly !== undefined ? treasuryAddress.toBase58() : treasuryAddress,
        escrowEstimatedDepletionUtc: escrowEstimatedDepletionDateUtc.toUTCString(),
        totalDeposits: totalDeposits,
        totalWithdrawals: totalWithdrawals,
        isStreaming: totalDeposits !== totalWithdrawals && rateAmount > 0,
        isUpdatePending: false,
        transactionSignature: '',
        blockTime: 0
    });

    return stream;
}

export async function getStream(
    connection: Connection,
    id: PublicKey,
    commitment?: any,
    friendly: boolean = true

): Promise<StreamInfo> {

    let stream;
    let accountInfo = await connection.getAccountInfo(id, commitment);

    if (accountInfo?.data !== undefined && accountInfo?.data.length > 0) {
        stream = Object.assign({}, parseStreamData(
            id,
            accountInfo?.data,
            friendly
        ));

        let signatures = await connection.getConfirmedSignaturesForAddress2(id, {}, commitment);

        if (signatures.length > 0) {
            stream.blockTime = signatures[0].blockTime as number;
            stream.transactionSignature = signatures[0].signature
        }
    }

    return stream as StreamInfo;
}

export async function listStreams(
    connection: Connection,
    programId: PublicKey,
    treasurer?: PublicKey | undefined,
    beneficiary?: PublicKey | undefined,
    commitment?: any,
    friendly: boolean = true

): Promise<StreamInfo[]> {

    let streams: StreamInfo[] = [];
    const accounts = await connection.getProgramAccounts(programId, commitment);

    if (accounts === null || !accounts.length) {
        return streams;
    }

    for (let item of accounts) {
        if (item.account.data !== undefined && item.account.data.length === Layout.streamLayout.span) {
            let info = Object.assign({}, parseStreamData(
                item.pubkey,
                item.account.data,
                friendly
            ));

            let signatures = await connection.getConfirmedSignaturesForAddress2(
                (friendly ? (info.id as string).toPublicKey() : (info.id as PublicKey)),
                {}, commitment
            );

            if (signatures.length > 0) {
                info.blockTime = signatures[0].blockTime as number;
                info.transactionSignature = signatures[0].signature
            }

            streams.push(info);
        }
    }

    if (!streams.length) return streams;

    let filtered_list: StreamInfo[] = [];

    filtered_list.push(...streams.filter(function (s, index) {
        let result = true;

        if (treasurer !== undefined && s.treasurerAddress !== treasurer) {
            result = false;
        }

        if (beneficiary !== undefined && s.beneficiaryAddress !== beneficiary) {
            result = false;
        }

        // if (s.startUtc && (s.startUtc as Date).getTime() > (new Date().getTime() - (24 * 60 * 60))) {
        //     result = false;
        // }

        return result;
    }));

    let sortedStream = filtered_list.sort((a, b) => b.blockTime - a.blockTime);

    return sortedStream;
}

export async function findStreamingProgramAddress(
    fromAddress: PublicKey

): Promise<[PublicKey, number]> {

    return (
        await PublicKey.findProgramAddress(
            [
                fromAddress.toBuffer(),
                SystemProgram.programId.toBuffer(),
                Constants.STREAM_PROGRAM_ADDRESS.toPublicKey().toBuffer()
            ],
            Constants.STREAM_PROGRAM_ADDRESS.toPublicKey()
        )
    );
}

export async function createStreamingProgramAddress(
    fromAddress: PublicKey

): Promise<PublicKey> {

    let [possibleKey, bump_seed] = await findStreamingProgramAddress(fromAddress);

    return (
        await PublicKey.createWithSeed(
            possibleKey,
            bump_seed.toString(),
            Constants.STREAM_PROGRAM_ADDRESS.toPublicKey()
        )
    );
}

export async function findATokenAddress(
    walletAddress: PublicKey,
    tokenMintAddress: PublicKey

): Promise<PublicKey> {

    return (
        await PublicKey.findProgramAddress(
            [
                walletAddress.toBuffer(),
                Constants.TOKEN_PROGRAM_ADDRESS.toPublicKey().toBuffer(),
                tokenMintAddress.toBuffer(),
            ],
            Constants.ATOKEN_PROGRAM_ADDRESS.toPublicKey()
        )
    )[0];
}

// export async function swapClient(
//     cluster: string,
//     wallet: Wallet,

// ) {
//     const provider = new Provider(
//         new Connection(cluster, 'recent'),
//         Wallet.local(),
//         Provider.defaultOptions(),
//     );

//     const tokenList = await new TokenListProvider().resolve();

//     return new Swap(provider, tokenList);
// }

export function toNative(amount: number) {
    return new BN(amount * 10 ** Constants.DECIMALS);
}

export function fromNative(amount: BN) {
    return amount.toNumber() / 10 ** Constants.DECIMALS;
}

export const getMintAccount = async (
    connection: Connection,
    pubKey: PublicKey | string

): Promise<MintInfo> => {

    const address = typeof pubKey === 'string' ? new PublicKey(pubKey) : pubKey;
    const info = await connection.getAccountInfo(address);

    if (info === null) {
        throw new Error('Failed to find mint account');
    }

    return deserializeMint(info.data);
};

export const deserializeMint = (data: Buffer): MintInfo => {
    if (data.length !== MintLayout.span) {
        throw new Error('Not a valid Mint');
    }

    const mintInfo = MintLayout.decode(data);

    if (mintInfo.mintAuthorityOption === 0) {
        mintInfo.mintAuthority = null;
    } else {
        mintInfo.mintAuthority = new PublicKey(mintInfo.mintAuthority);
    }

    mintInfo.supply = u64.fromBuffer(mintInfo.supply);
    mintInfo.isInitialized = mintInfo.isInitialized !== 0;

    if (mintInfo.freezeAuthorityOption === 0) {
        mintInfo.freezeAuthority = null;
    } else {
        mintInfo.freezeAuthority = new PublicKey(mintInfo.freezeAuthority);
    }

    return mintInfo as MintInfo;
};