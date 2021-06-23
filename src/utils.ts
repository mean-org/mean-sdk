import { BN, Provider, Wallet } from "@project-serum/anchor";
import { Commitment, Connection, Finality, ParsedConfirmedTransaction, PartiallyDecodedInstruction, PublicKey, TransactionSignature } from "@solana/web3.js";
import { Constants } from "./constants";
import { Layout } from "./layout";
import { StreamInfo } from "./money-streaming";
import { u64Number } from "./u64n";
import { MintInfo, MintLayout, u64 } from '@solana/spl-token';
import { TokenInfo, TokenListContainer, TokenListProvider } from "@solana/spl-token-registry";
import { Swap } from "@project-serum/swap";
import { MEAN_TOKEN_LIST } from "./token-list";
import base64 from "base64-js";
import base58 from "bs58";

declare global {
    export interface String {
        toPublicKey(): PublicKey;
    }

    export interface Array<T> {
        getChainTokens(this: TokenInfo[], cluster: string): TokenInfo[];
    }
}

String.prototype.toPublicKey = function (): PublicKey {
    return new PublicKey(this.toString());
}

Array.prototype.getChainTokens = function (cluster: string): TokenInfo[] {
    let chainId = 0;

    switch (cluster) {
        case 'MAINNET' || 'Mainnet' || 'mainnet': {
            chainId = 101;
            break;
        }
        case 'TESTNET' || 'Testnet' || 'testnet': {
            chainId = 102;
            break;
        }
        case 'DEVNET' || 'Devnet' || 'devnet': {
            chainId = 103;
            break;
        }
        default: {
            break;
        }
    }

    if (chainId === 0) return [] as TokenInfo[];

    return this.filter(function (t, _) {
        return t.chainId === chainId;
    });
}

let defaultStreamInfo: StreamInfo = {
    id: undefined,
    initialized: false,
    memo: "",
    treasurerAddress: undefined,
    rateAmount: 0,
    rateIntervalInSeconds: 0,
    startUtc: undefined,
    rateCliffInSeconds: 0,
    cliffVestAmount: 0,
    cliffVestPercent: 0,
    beneficiaryAddress: undefined,
    associatedToken: undefined,
    escrowVestedAmount: 0,
    escrowUnvestedAmount: 0,
    treasuryAddress: undefined,
    escrowEstimatedDepletionUtc: undefined,
    totalDeposits: 0,
    totalWithdrawals: 0,
    escrowVestedAmountSnap: 0,
    escrowVestedAmountSnapBlockHeight: 0,
    autoOffClockInSeconds: 0,
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
    let startDateUtc = new Date(decodedData.start_utc as string);
    let currentBlockTime = new Date().getTime() / 1000;
    let escrowVestedAmountSnapBlockHeight = parseFloat(u64Number.fromBuffer(decodedData.escrow_vested_amount_snap_block_height).toString());
    let escrowVestedAmountSnapBlockTime = new Date(escrowVestedAmountSnapBlockHeight).getTime();
    let rateIntervalInSeconds = parseFloat(u64Number.fromBuffer(decodedData.rate_interval_in_seconds).toString());
    let escrowVestedAmount = 0.0;

    const rate = decodedData.rate_amount / rateIntervalInSeconds * decodedData.is_streaming;
    const elapsedTime = currentBlockTime - escrowVestedAmountSnapBlockTime;
    const beneficiaryAssociatedToken = new PublicKey(decodedData.stream_associated_token);
    const associatedToken = beneficiaryAssociatedToken.toBase58() !== Constants.DEFAULT_PUBLICKEY
        ? beneficiaryAssociatedToken.toBase58()
        : (friendly ? beneficiaryAssociatedToken.toBase58() : beneficiaryAssociatedToken);

    if (currentBlockTime >= escrowVestedAmountSnapBlockTime) {
        escrowVestedAmount = decodedData.escrow_vested_amount_snap + rate * elapsedTime;

        if (escrowVestedAmount >= decodedData.total_deposits - decodedData.total_withdrawals) {
            escrowVestedAmount = decodedData.total_deposits - decodedData.total_withdrawals;
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
    const treasuryAddress = new PublicKey(decodedData.treasury_address);

    Object.assign(stream, { id: id }, {
        initialized: decodedData.initialized ? true : false,
        memo: new TextDecoder().decode(nameBuffer),
        treasurerAddress: friendly !== undefined ? treasurerAddress.toBase58() : treasurerAddress,
        rateAmount: decodedData.rate_amount,
        rateIntervalInSeconds: rateIntervalInSeconds,
        startUtc: startDateUtc.toUTCString(),
        rateCliffInSeconds: parseFloat(u64Number.fromBuffer(decodedData.rate_cliff_in_seconds).toString()),
        cliffVestAmount: decodedData.cliff_vest_amount,
        cliffVestPercent: decodedData.cliff_vest_percent,
        beneficiaryAddress: friendly !== undefined ? beneficiaryAddress.toBase58() : beneficiaryAddress,
        associatedToken: associatedToken,
        escrowVestedAmount: escrowVestedAmount,
        escrowUnvestedAmount: decodedData.total_deposits - decodedData.total_withdrawals - escrowVestedAmount,
        treasuryAddress: friendly !== undefined ? treasuryAddress.toBase58() : treasuryAddress,
        escrowEstimatedDepletionUtc: escrowEstimatedDepletionDateUtc.toUTCString(),
        totalDeposits: decodedData.total_deposits,
        totalWithdrawals: decodedData.total_withdrawals,
        escrowVestedAmountSnap: decodedData.escrow_vested_amount_snap,
        escrowVestedAmountSnapBlockHeight: escrowVestedAmountSnapBlockHeight,
        autoOffClockInSeconds: parseFloat(u64Number.fromBuffer(decodedData.auto_off_clock_in_seconds).toString()),
        isStreaming: escrowVestedAmount < decodedData.total_deposits && decodedData.is_streaming ? true : false,
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

        let signatures = await connection.getConfirmedSignaturesForAddress2(id, {}, 'confirmed');

        if (signatures.length > 0) {

            stream = Object.assign({}, parseStreamData(
                id,
                accountInfo?.data,
                friendly
            ));

            stream.transactionSignature = signatures[0].signature;
            stream.blockTime = signatures[0].blockTime as number;
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

            let included = false;
            let info = Object.assign({}, parseStreamData(
                item.pubkey,
                item.account.data,
                friendly
            ));

            if ((treasurer && treasurer.toBase58() === info.treasurerAddress) || !treasurer) {
                included = true;
            } else if ((beneficiary && beneficiary.toBase58() === info.beneficiaryAddress) || !beneficiary) {
                included = true;
            }

            if (included && (info.startUtc as Date) !== undefined) {

                let startDateUtc = new Date(info.startUtc as string);
                let threeDaysAgo = new Date();
                threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

                if (startDateUtc.getTime() > threeDaysAgo.getTime()) {

                    let signatures = await connection.getConfirmedSignaturesForAddress2(
                        (friendly ? (info.id as string).toPublicKey() : (info.id as PublicKey)),
                        {}, commitment
                    );

                    if (signatures.length > 0) {
                        info.blockTime = signatures[0].blockTime as number;
                        info.transactionSignature = signatures[0].signature
                    }
                }
            }

            if (included) {
                streams.push(info);
            }

        }
    }

    let orderedStreams = streams.sort((a, b) => (b.blockTime - a.blockTime));

    return orderedStreams;
}

function parseActivityData(
    tx: ParsedConfirmedTransaction,
    tokens: TokenInfo[],
    friendly: boolean = true

): any {

    let lastIxIndex = tx.transaction.message.instructions.length - 1;
    let lastIx = tx.transaction.message.instructions[lastIxIndex] as PartiallyDecodedInstruction;
    let buffer = base58.decode(lastIx.data);
    let actionIndex = buffer.readUInt8(0);

    if (actionIndex <= 2) {
        let blockTime = (tx.blockTime as number) * 1000; // mult by 1000 to add milliseconds
        let action = actionIndex === 2 ? 'withdraw' : 'deposit';
        let layoutBuffer = Buffer.alloc(buffer.length, buffer);
        let data: any,
            amount = 0;

        if (actionIndex === 0) {
            data = Layout.createStreamLayout.decode(layoutBuffer);
            amount = data.funding_amount;
        } else if (actionIndex === 1) {
            data = Layout.addFundsLayout.decode(layoutBuffer);
            amount = data.contribution_amount;
        } else {
            data = Layout.withdrawLayout.decode(layoutBuffer);
            amount = data.withdrawal_amount;
        }

        let mint: string;

        if (tx.meta?.preTokenBalances?.length) {
            mint = tx.meta.preTokenBalances[0].mint;
        } else if (tx.meta?.postTokenBalances?.length) {
            mint = tx.meta.postTokenBalances[0].mint;
        } else {
            mint = 'Unknown';
        }

        let tokenInfo = tokens.find((t) => t.address === mint);

        return Object.assign({}, {
            blockTime: blockTime,
            utcDate: new Date(blockTime).toUTCString(),
            action: action,
            amount: amount,
            mint: !tokenInfo ? mint : (friendly ? tokenInfo.symbol : tokenInfo.address),
            type: action === 'withdraw' ? 'in' : 'out',
        });
    }
}

export async function listStreamActivity(
    connection: Connection,
    cluster: string | number,
    streamId: PublicKey,
    commitment?: Commitment | string,
    friendly: boolean = true

): Promise<any[]> {

    let activity: any = [];
    let commitmentValue = commitment !== undefined ? commitment as Finality : 'confirmed';
    let signatures = await connection.getConfirmedSignaturesForAddress2(streamId, {}, commitmentValue);
    let tokenList = await getTokenList(cluster);

    for (let sign of signatures) {
        let tx = await connection.getParsedConfirmedTransaction(sign.signature, commitmentValue);

        if (tx !== null) {
            activity.push(parseActivityData(
                tx,
                tokenList,
                friendly
            ));
        }
    }

    return activity.sort((a: { blockTime: number; }, b: { blockTime: number; }) => (b.blockTime - a.blockTime));
}

export function getSeedBuffer(
    from: PublicKey,
    programId: PublicKey

): (Buffer | Uint8Array)[] {

    return [
        from.toBytes(),
        programId.toBytes(),
        new TextEncoder().encode('MoneyStreamingProgram')
    ];
}

export async function findMSPAddress(
    from: PublicKey,
    programId: PublicKey

): Promise<[PublicKey, number]> {

    const seedBuffer = getSeedBuffer(from, programId);

    return (
        await PublicKey.findProgramAddress(
            seedBuffer,
            programId
        )
    );
}

export async function findMSPStreamAddress(
    treasurer: PublicKey,
    programId: PublicKey

): Promise<[PublicKey, number]> {

    const seedBuffer = getSeedBuffer(treasurer, programId);

    return (
        await PublicKey.findProgramAddress(
            seedBuffer,
            programId
        )
    );
}

export async function findMSPTreasuryAddress(
    stream: PublicKey,
    programId: PublicKey

): Promise<[PublicKey, number]> {

    const seedBuffer = getSeedBuffer(stream, programId);

    return (
        await PublicKey.findProgramAddress(
            seedBuffer,
            programId
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

export function toNative(amount: number, decimals: number) {
    return new BN(amount * 10 ** decimals);
}

export function fromNative(amount: BN, decimals: number) {
    return amount.toNumber() / 10 ** decimals;
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

export function convertLocalDateToUTCIgnoringTimezone(date: Date) {
    const timestamp = Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
        date.getMilliseconds(),
    );

    return new Date(timestamp);
}

export async function getTokenList(
    cluster: string | number

): Promise<TokenInfo[]> {

    let chainId = 0;

    switch (cluster) {
        case 'https://api.mainnet-beta.solana.com' || 101: {
            chainId = 101;
            break;
        }
        case 'https://api.testnet.solana.com' || 102: {
            chainId = 102;
            break;
        }
        case 'https://api.devnet.solana.com' || 103: {
            chainId = 103;
            break;
        }
        default: {
            break;
        }
    }

    if (chainId === 0) return [] as Array<TokenInfo>;

    return MEAN_TOKEN_LIST.filter((t) => t.chainId === chainId);
}

export async function swapClient(
    connection: Connection,
    // cluster: string,
    wallet: Wallet,
    commitment: Commitment | string

): Promise<Swap> {

    let preflightCommitment = typeof commitment === 'string' ? commitment : 'finalized';
    let provider = new Provider(
        connection,
        wallet,
        {
            commitment: preflightCommitment as Commitment,
            preflightCommitment: preflightCommitment as Commitment
        }
    );

    // let tokenList = getTokenList(cluster);
    let tokenListContainer = await new TokenListProvider().resolve();
    let tokenList = tokenListContainer.filterByChainId(101).getList();
    let container = new TokenListContainer(tokenList);

    return new Swap(provider, container);
}

// async function getMarketAddress(
//     tokenList: TokenListContainer,
//     usdxMint: PublicKey,
//     baseMint: PublicKey

// ): Promise<PublicKey> {

//     const market = tokenList.filterByClusterSlug(Constants.DEVNET_CLUSTER)
//         .getList()
//         .filter((t) => {
//             if (t.address !== baseMint?.toString()) {
//                 return false;
//             }
//             if (usdxMint.equals(USDC_PUBKEY)) {
//                 return t.extensions?.serumV3Usdc !== undefined;
//             } else if (usdxMint.equals(USDT_PUBKEY)) {
//                 return t.extensions?.serumV3Usdt !== undefined;
//             } else {
//                 return false;
//             }
//         })
//         .map((t) => {
//             if (usdxMint!.equals(USDC_PUBKEY)) {
//                 return new PublicKey(t.extensions!.serumV3Usdc as string);
//             } else {
//                 return new PublicKey(t.extensions!.serumV3Usdt as string);
//             }
//         })[0];

//     if (market === undefined) {
//         return null;
//     }

//     return market;
// }

export async function swapTokens(
    connection: Connection,
    client: Swap,
    fromWallet: PublicKey,
    fromMint: PublicKey,
    toWallet: PublicKey,
    toMint: PublicKey,
    amount: number

): Promise<Array<TransactionSignature>> {

    // const serumDexKey = Constants.SERUM_DEX_ADDRESS.toPublicKey();
    // const fromMarket = await Market.load(
    //     connection,
    //     fromMint,
    //     { commitment: connection.commitment },
    //     Constants.TOKEN_PROGRAM_ADDRESS.toPublicKey()
    // );

    // const toMarket = await Market.load(
    //     connection,
    //     toMint,
    //     { commitment: connection.commitment },
    //     Constants.TOKEN_PROGRAM_ADDRESS.toPublicKey()
    // );

    // const fromMintAccount = await getMintAccount(connection, fromMint);
    // const toMintAccount = await getMintAccount(connection, toMint);
    const bn = toNative(amount, 9);
    const minExpectedExRate = {
        rate: bn.mul(new BN(99)).div(new BN(100)), // 0.1%
        fromDecimals: 9,
        quoteDecimals: 6,
        strict: false
    };

    const txs = client.swap({
        fromMint: fromMint,
        toMint: toMint,
        // fromWallet,
        // toWallet,
        // fromMarket,
        // toMarket,
        amount: bn,
        minExchangeRate: minExpectedExRate
    });

    return txs;
}

export function encode(data: Buffer): string {
    return base64.fromByteArray(data);
}

export function decode(data: string): Buffer {
    return Buffer.from(base64.toByteArray(data));
}