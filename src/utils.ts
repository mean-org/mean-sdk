import { Commitment, Connection, GetProgramAccountsConfig, PublicKey } from "@solana/web3.js";
import { Layout } from "./layout";
import { StreamInfo } from "./money-streaming";
import { u64Number } from "./u64Number";

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

    // Build a string by converting a byte array to number array
    // And later use String.fromCharCode.apply method
    // nameBuffer as Uint8Array is returning the wrong string format
    // with the implemented .toString() method
    const bufferToNumArray: number[] = [];
    nameBuffer.forEach(item => bufferToNumArray.push(item));
    const builtString = String.fromCharCode.apply(null, bufferToNumArray);

    const id = friendly !== undefined ? streamId.toBase58() : streamId;
    const treasurerAddress = new PublicKey(decodedData.treasurer_address);
    const beneficiaryAddress = new PublicKey(decodedData.beneficiary_withdrawal_address);
    const treasuryAddress = new PublicKey(decodedData.treasury_address);
    const escrowTokenAddress = new PublicKey(decodedData.escrow_token_address);

    Object.assign(stream, { id: id }, {
        initialized: decodedData.initialized,
        memo: builtString,
        // memo: nameBuffer.toString(),
        treasurerAddress: friendly !== undefined ? treasurerAddress.toBase58() : treasurerAddress,
        rateAmount: rateAmount,
        rateIntervalInSeconds: rateIntervalInSeconds,
        startUtc: startDateUtc,
        rateCliffInSeconds: parseFloat(u64Number.fromBuffer(decodedData.rate_cliff_in_seconds).toString()),
        cliffVestAmount: parseFloat(u64Number.fromBuffer(decodedData.cliff_vest_amount).toString()),
        cliffVestPercent: parseFloat(u64Number.fromBuffer(decodedData.cliff_vest_percent).toString()),
        beneficiaryWithdrawalAddress: friendly !== undefined ? beneficiaryAddress.toBase58() : beneficiaryAddress,
        escrowTokenAddress: friendly !== undefined ? escrowTokenAddress.toBase58() : escrowTokenAddress,
        escrowVestedAmount: escrowVestedAmount,
        escrowUnvestedAmount: totalDeposits - totalWithdrawals - escrowVestedAmount,
        treasuryAddress: friendly !== undefined ? treasuryAddress.toBase58() : treasuryAddress,
        escrowEstimatedDepletionUtc: escrowEstimatedDepletionDateUtc,
        totalDeposits: totalDeposits,
        totalWithdrawals: totalWithdrawals,
        isStreaming: totalDeposits === totalWithdrawals || rateAmount === 0,
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
        stream = parseStreamData(
            id,
            accountInfo?.data,
            friendly as Boolean
        );
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