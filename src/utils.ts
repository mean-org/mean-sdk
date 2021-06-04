import { Commitment, Connection, GetProgramAccountsConfig, PublicKey } from "@solana/web3.js";
import { Layout } from "./layout";
import { StreamInfo } from "./money-streaming";
import { u64Number } from "./u64Number";

let defaultStreamInfo: StreamInfo = {
    id: undefined,
    initialized: false,
    streamName: "",
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
    totalWithdrawals: 0
}

function parseStreamData(
    streamId: PublicKey,
    streamData: Buffer

): StreamInfo {

    let stream: StreamInfo = defaultStreamInfo;
    let decodedData = Layout.streamLayout.decode(streamData);
    let totalDeposits = parseFloat(u64Number.fromBuffer(decodedData.total_deposits).toString());
    let totalWithdrawals = parseFloat(u64Number.fromBuffer(decodedData.total_withdrawals).toString());
    let startUtc = parseInt(u64Number.fromBuffer(decodedData.start_utc).toString());
    let startDateUtc = new Date();

    startDateUtc.setTime(startUtc);

    let rateAmount = parseFloat(u64Number.fromBuffer(decodedData.rate_amount).toString());
    let rateIntervalInSeconds = parseFloat(u64Number.fromBuffer(decodedData.rate_interval_in_seconds).toString());
    let escrowVestedAmount = (rateAmount / rateIntervalInSeconds) * (Date.now() - startUtc).valueOf();
    let escrowEstimatedDepletionUtc = u64Number.fromBuffer(decodedData.escrow_estimated_depletion_utc).toNumber();
    let escrowEstimatedDepletionDateUtc = new Date();

    escrowEstimatedDepletionDateUtc.setDate(escrowEstimatedDepletionUtc);

    let nameBuffer = Buffer
        .alloc(32, decodedData.stream_name)
        .filter(function (elem, index) {
            return elem !== 0;
        });

    Object.assign(stream, { id: streamId }, {
        initialized: decodedData.initialized,
        streamName: nameBuffer.toString(),
        treasurerAddress: PublicKey.decode(decodedData.treasurer_address),
        rateAmount: rateAmount,
        rateIntervalInSeconds: rateIntervalInSeconds,
        startUtc: startDateUtc,
        rateCliffInSeconds: parseFloat(u64Number.fromBuffer(decodedData.rate_cliff_in_seconds).toString()),
        cliffVestAmount: parseFloat(u64Number.fromBuffer(decodedData.cliff_vest_amount).toString()),
        cliffVestPercent: parseFloat(u64Number.fromBuffer(decodedData.cliff_vest_percent).toString()),
        beneficiaryWithdrawalAddress: PublicKey.decode(decodedData.beneficiary_withdrawal_address),
        escrowTokenAddress: PublicKey.decode(decodedData.escrow_token_address),
        escrowVestedAmount: escrowVestedAmount,
        escrowUnvestedAmount: totalDeposits - totalWithdrawals - escrowVestedAmount,
        treasuryAddress: PublicKey.decode(decodedData.treasurer_address),
        escrowEstimatedDepletionUtc: escrowEstimatedDepletionDateUtc,
        totalDeposits: totalDeposits,
        totalWithdrawals: totalWithdrawals
    });

    return stream;
}

export async function getStream(
    connection: Connection,
    id: PublicKey,
    commitment?: Commitment | undefined

): Promise<StreamInfo> {

    let stream;
    let accountInfo = await connection.getAccountInfo(id, commitment);

    if (accountInfo?.data !== undefined && accountInfo?.data.length > 0) {
        stream = parseStreamData(id, accountInfo?.data);
    }

    return stream as StreamInfo;
}

export async function listStreams(
    connection: Connection,
    programId: PublicKey,
    treasurer?: PublicKey | undefined,
    beneficiary?: PublicKey | undefined,
    treasury?: PublicKey | undefined,
    commitment?: GetProgramAccountsConfig | Commitment | undefined

): Promise<StreamInfo[]> {

    let streams: StreamInfo[] = [];
    const accounts = await connection.getProgramAccounts(programId, commitment);

    if (accounts === null || !accounts.length) {
        return streams;
    }

    for (var item of accounts) {

        if (item.account.data !== undefined && item.account.data.length === Layout.streamLayout.span) {
            var info = parseStreamData(
                item.pubkey,
                item.account.data
            );

            if (info !== null) {
                streams.push(info);
            }
        }
    }

    if (!streams.length) return streams;

    if (treasurer !== undefined) {
        streams = streams.filter(function (s, index) {
            return s.treasurerAddress === treasurer;
        });
    }

    if (beneficiary !== undefined) {
        streams = streams.filter(function (s, index) {
            return s.beneficiaryWithdrawalAddress === beneficiary;
        });
    }

    if (treasury !== undefined) {
        streams = streams.filter(function (s, index) {
            return s.treasuryAddress === treasury;
        });
    }

    return streams;
}