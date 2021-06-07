import { BN, Provider, Wallet } from "@project-serum/anchor";
import { Swap } from "@project-serum/swap";
import { Commitment, Connection, GetProgramAccountsConfig, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
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
    beneficiaryWithdrawalAddress: undefined,
    escrowTokenAddress: undefined,
    escrowVestedAmount: 0,
    escrowUnvestedAmount: 0,
    treasuryAddress: undefined,
    escrowEstimatedDepletionUtc: null,
    totalDeposits: 0,
    totalWithdrawals: 0,
    isStreaming: false,
    isUpdatePending: false
}

function parseStreamData(
    streamId: PublicKey,
    streamData: Buffer,
    friendly?: Boolean | undefined

): StreamInfo {

    let stream: StreamInfo = defaultStreamInfo;
    let decodedData = Layout.streamLayout.decode(streamData);
    let totalDeposits = decodedData.total_deposits;
    let totalWithdrawals = decodedData.total_withdrawals;
    let startUtc = parseInt(u64Number.fromBuffer(decodedData.start_utc).toString());
    let startDateUtc = new Date();

    startDateUtc.setTime(startUtc);

    let rateAmount = decodedData.rate_amount;
    let rateIntervalInSeconds = parseFloat(u64Number.fromBuffer(decodedData.rate_interval_in_seconds).toString());
    let escrowVestedAmount = 0

    if (Date.now() >= startDateUtc.getTime()) {
        escrowVestedAmount = ((rateAmount * LAMPORTS_PER_SOL) / rateIntervalInSeconds) * (Date.now() - startUtc).valueOf();

        if (escrowVestedAmount >= totalDeposits) {
            escrowVestedAmount = totalDeposits;
        }
    }

    let escrowEstimatedDepletionUtc = u64Number.fromBuffer(decodedData.escrow_estimated_depletion_utc).toNumber();
    let escrowEstimatedDepletionDateUtc = new Date();

    escrowEstimatedDepletionDateUtc.setDate(escrowEstimatedDepletionUtc);

    let nameBuffer = Buffer
        .alloc(decodedData.stream_name.length, decodedData.stream_name)
        .filter(function (elem, index) {
            return elem !== 0;
        });

    const id = friendly !== undefined ? streamId.toBase58() : streamId;
    const treasurerAddress = new PublicKey(decodedData.treasurer_address);
    const beneficiaryAddress = new PublicKey(decodedData.beneficiary_withdrawal_address);
    const treasuryAddress = new PublicKey(decodedData.treasury_address);
    const escrowTokenAddress = new PublicKey(decodedData.beneficiary_associated_token_address);

    Object.assign(stream, { id: id }, {
        initialized: decodedData.initialized,
        memo: new TextDecoder().decode(nameBuffer),
        treasurerAddress: friendly !== undefined ? treasurerAddress.toBase58() : treasurerAddress,
        rateAmount: rateAmount,
        rateIntervalInSeconds: rateIntervalInSeconds,
        startUtc: startDateUtc,
        rateCliffInSeconds: parseFloat(u64Number.fromBuffer(decodedData.rate_cliff_in_seconds).toString()),
        cliffVestAmount: decodedData.cliff_vest_amount,
        cliffVestPercent: decodedData.cliff_vest_percent,
        beneficiaryWithdrawalAddress: friendly !== undefined ? beneficiaryAddress.toBase58() : beneficiaryAddress,
        escrowTokenAddress: friendly !== undefined ? escrowTokenAddress.toBase58() : escrowTokenAddress,
        escrowVestedAmount: escrowVestedAmount,
        escrowUnvestedAmount: totalDeposits - totalWithdrawals - escrowVestedAmount,
        treasuryAddress: friendly !== undefined ? treasuryAddress.toBase58() : treasuryAddress,
        escrowEstimatedDepletionUtc: escrowEstimatedDepletionDateUtc,
        totalDeposits: totalDeposits,
        totalWithdrawals: totalWithdrawals,
        isStreaming: totalDeposits !== totalWithdrawals && rateAmount > 0,
        isUpdatePending: false
    });

    return stream;
}

export async function getStream(
    connection: Connection,
    id: PublicKey,
    commitment?: Commitment | undefined,
    friendly?: Boolean | undefined

): Promise<StreamInfo> {

    let stream;
    let accountInfo = await connection.getAccountInfo(id, commitment);

    if (accountInfo?.data !== undefined && accountInfo?.data.length > 0) {
        stream = Object.assign({}, parseStreamData(
            id,
            accountInfo?.data,
            friendly as Boolean
        ));
    }

    return stream as StreamInfo;
}

export async function listStreams(
    connection: Connection,
    programId: PublicKey,
    treasurer?: PublicKey | undefined,
    beneficiary?: PublicKey | undefined,
    commitment?: GetProgramAccountsConfig | Commitment | undefined,
    friendly?: boolean | undefined

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
                friendly as boolean
            ));

            streams.push(info);
        }
    }

    if (!streams.length) return streams;

    let filtered_list: StreamInfo[] = [];

    if (treasurer !== undefined) {
        filtered_list.push(...streams.filter(function (s, index) {
            return s.treasurerAddress == treasurer;
        }));
    }

    if (treasurer !== undefined) {
        filtered_list.push(...streams.filter(function (s, index) {
            return s.beneficiaryWithdrawalAddress == beneficiary;
        }));
    }

    if (filtered_list.length > 0) {
        streams = filtered_list;
    }

    return streams;
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