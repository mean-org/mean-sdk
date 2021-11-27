import base58 from "bs58";
import base64 from "base64-js";

/**
 * Solana
 */
import {
  Token,
  AccountInfo,
  MintInfo,
  AccountLayout,
  MintLayout,
  TOKEN_PROGRAM_ID,
  u64,
  ASSOCIATED_TOKEN_PROGRAM_ID

} from "@solana/spl-token";

import {
  Commitment,
  Connection,
  Finality,
  PartiallyDecodedInstruction,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  SystemProgram,
  ParsedConfirmedTransaction,
  Keypair,
  GetProgramAccountsConfig,

} from "@solana/web3.js";

/**
 * MSP
 */
import * as Layout from "./layout";
import { Constants } from "./constants";
import { u64Number } from "./u64n";
import {
  MSP_ACTIONS,
  StreamActivity,
  StreamInfo,
  StreamTermsInfo,
  StreamV1Info,
  STREAM_STATE,
  TransactionFees,
  TreasuryInfo,
  TreasuryV1Info

} from "./types";

String.prototype.toPublicKey = function (): PublicKey {
  return new PublicKey(this.toString());
};

let defaultStreamTermsInfo: StreamTermsInfo = {
  id: undefined,
  initialized: false,
  streamId: undefined,
  streamMemo: "",
  treasurerAddress: undefined,
  beneficiaryAddress: undefined,
  associatedToken: undefined,
  rateAmount: 0,
  rateIntervalInSeconds: 0,
  rateCliffInSeconds: 0,
  cliffVestAmount: 0,
  cliffVestPercent: 0,
  autoPauseInSeconds: 0,
};

let defaultStreamInfo: StreamInfo = {
  id: undefined,
  initialized: false,
  memo: "",
  treasurerAddress: undefined,
  rateAmount: 0,
  rateIntervalInSeconds: 0,
  fundedOnUtc: undefined,
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
  escrowVestedAmountSnapBlockTime: 0,
  streamResumedBlockHeight: 0,
  streamResumedBlockTime: 0,
  autoPauseInSeconds: 0,
  isUpdatePending: false,
  transactionSignature: undefined,
  createdBlockTime: 0,
  lastRetrievedBlockTime: 0,
  state: STREAM_STATE.Schedule,
};

let defaultStreamV2Info: StreamV1Info = {
  id: undefined,
  initialized: false,
  stream_name: "",
  treasurerAddress: undefined,
  rateAmount: 0,
  rateIntervalInSeconds: 0,
  fundedOnUtc: undefined,
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
  allocationReserved: 0,
  allocationCommitted: 0,
  escrowVestedAmountSnap: 0,
  escrowVestedAmountSnapSlot: 0,
  escrowVestedAmountSnapBlockTime: 0,
  streamResumedSlot: 0,
  streamResumedBlockTime: 0,
  autoPauseInSeconds: 0,
  isUpdatePending: false,
  transactionSignature: undefined,
  createdBlockTime: 0,
  lastRetrievedBlockTime: 0,
  state: STREAM_STATE.Schedule,
};

let defaultTreasuryInfo: TreasuryInfo = {
  id: undefined,
  initialized: false,
  treasuryBlockHeight: 0,
  treasuryMintAddress: undefined,
  treasuryBaseAddress: undefined,
};

let defaultTreasuryV2Info: TreasuryV1Info = {
  id: "",
  initialized: false,
  slot: 0,
  treasurerAddress: "",
  associatedTokenAddress: "",
  mintAddress: "",  
  label: "",
  balance: 0,
  allocationReserved: 0,
  allocationCommitted: 0
};

let defaultStreamActivity: StreamActivity = {
  signature: "",
  initializer: "",
  action: "",
  amount: 0,
  mint: "",
  blockTime: 0,
  utcDate: "",
};

const parseStreamData = (
  streamId: PublicKey,
  streamData: Buffer,
  currentBlockTime: number,
  friendly: boolean = true

): StreamInfo => {

  let stream: StreamInfo = defaultStreamInfo;
  let decodedData = Layout.streamLayout.decode(streamData);
  let fundedOnUtc = new Date(decodedData.funded_on_utc);
  let startDateUtc = new Date(decodedData.start_utc);

  let escrowVestedAmountSnapBlockHeight = parseFloat(
    u64Number
      .fromBuffer(decodedData.escrow_vested_amount_snap_block_height)
      .toString()
  );

  let escrowVestedAmountSnapBlockTime = parseFloat(
    u64Number
      .fromBuffer(decodedData.escrow_vested_amount_snap_block_time)
      .toString()
  );

  let streamResumedBlockHeight = parseFloat(
    u64Number.fromBuffer(decodedData.stream_resumed_block_height).toString()
  );

  let streamResumedBlockTime = parseFloat(
    u64Number.fromBuffer(decodedData.stream_resumed_block_time).toString()
  );

  let autoPauseInSeconds = parseFloat(
    u64Number.fromBuffer(decodedData.auto_pause_in_seconds).toString()
  );

  let rateIntervalInSeconds = parseFloat(
    u64Number.fromBuffer(decodedData.rate_interval_in_seconds).toString()
  );

  let isStreaming = streamResumedBlockTime >= escrowVestedAmountSnapBlockTime ? 1 : 0;
  let lastTimeSnap = Math.max(streamResumedBlockTime, escrowVestedAmountSnapBlockTime);
  let escrowVestedAmount = 0.0;
  let rateAmount = decodedData.rate_amount;

  const rate = rateIntervalInSeconds > 0
    ? (rateAmount / rateIntervalInSeconds) * isStreaming
    : 1;

  const elapsedTime = currentBlockTime - lastTimeSnap;
  const escrowVestedAmountSnap = decodedData.escrow_vested_amount_snap;
  const beneficiaryAssociatedToken = new PublicKey(decodedData.stream_associated_token);
  const associatedToken = friendly === true
      ? beneficiaryAssociatedToken.toBase58()
      : beneficiaryAssociatedToken;

  if (currentBlockTime >= lastTimeSnap) {
    escrowVestedAmount = escrowVestedAmountSnap + rate * elapsedTime;

    if (escrowVestedAmount > decodedData.total_deposits - decodedData.total_withdrawals) {
      escrowVestedAmount = decodedData.total_deposits - decodedData.total_withdrawals;
    }
  }

  let escrowUnvestedAmount = decodedData.total_deposits - decodedData.total_withdrawals - escrowVestedAmount;
  let escrowEstimatedDepletionDateUtc = new Date(decodedData.escrow_estimated_depletion_utc);

  if (decodedData.escrow_estimated_depletion_utc === 0) {
    let depletionTimeInSeconds = rate ? decodedData.total_deposits / rate : 0;
    escrowEstimatedDepletionDateUtc.setTime(startDateUtc.getTime() + depletionTimeInSeconds * 1000);
  }

  let nameBuffer = Buffer.alloc(
    decodedData.stream_name.length,
    decodedData.stream_name
  ).filter(function (elem, index) {
    return elem !== 0;
  });

  const id = friendly === true ? streamId.toBase58() : streamId;
  const treasurerAddress = new PublicKey(decodedData.treasurer_address);
  const beneficiaryAddress = new PublicKey(decodedData.beneficiary_address);
  const treasuryAddress = new PublicKey(decodedData.treasury_address);

  let state: STREAM_STATE | undefined;
  const threeDays = 3 * 24 * 3600;
  const nowUtc = Date.parse(new Date().toUTCString());

  if (startDateUtc.getTime() > nowUtc) {
    state = STREAM_STATE.Schedule;
  } else if (escrowVestedAmount < decodedData.total_deposits - decodedData.total_withdrawals) {
    state = STREAM_STATE.Running;
  } else if (escrowVestedAmount >= decodedData.total_deposits - decodedData.total_withdrawals && elapsedTime < threeDays) {
    state = STREAM_STATE.Paused;
  } else if (escrowVestedAmount >= decodedData.total_deposits - decodedData.total_withdrawals && elapsedTime >= threeDays) {
    state = STREAM_STATE.Ended;
  }

  Object.assign(
    stream,
    { id: id },
    {
      initialized: decodedData.initialized ? true : false,
      memo: new TextDecoder().decode(nameBuffer),
      treasurerAddress: friendly !== undefined ? treasurerAddress.toBase58() : treasurerAddress,
      rateAmount: decodedData.rate_amount,
      rateIntervalInSeconds: rateIntervalInSeconds,
      fundedOnUtc: fundedOnUtc.toUTCString(),
      startUtc: startDateUtc.toUTCString(),
      rateCliffInSeconds: parseFloat(u64Number.fromBuffer(decodedData.rate_cliff_in_seconds).toString()),
      cliffVestAmount: decodedData.cliff_vest_amount,
      cliffVestPercent: decodedData.cliff_vest_percent,
      beneficiaryAddress: friendly !== undefined ? beneficiaryAddress.toBase58() : beneficiaryAddress,
      associatedToken: associatedToken,
      escrowVestedAmount: escrowVestedAmount,
      escrowUnvestedAmount: escrowUnvestedAmount,
      treasuryAddress: friendly !== undefined ? treasuryAddress.toBase58() : treasuryAddress,
      escrowEstimatedDepletionUtc: escrowEstimatedDepletionDateUtc.toUTCString(),
      totalDeposits: decodedData.total_deposits,
      totalWithdrawals: decodedData.total_withdrawals,
      escrowVestedAmountSnap: escrowVestedAmountSnap,
      escrowVestedAmountSnapBlockHeight: escrowVestedAmountSnapBlockHeight,
      escrowVestedAmountSnapBlockTime: escrowVestedAmountSnapBlockTime,
      streamResumedBlockHeight: streamResumedBlockHeight,
      streamResumedBlockTime: streamResumedBlockTime,
      autoPauseInSeconds: autoPauseInSeconds,
      isUpdatePending: false,
      transactionSignature: "",
      createdBlockTime: 0,
      lastRetrievedBlockTime: currentBlockTime,
      state,
    }
  );

  return stream;
};

const parseStreamV1Data = (
  streamId: PublicKey,
  streamData: Buffer,
  currentBlockTime: number,
  friendly: boolean = true

): StreamV1Info => {

  let streamV1: StreamV1Info = defaultStreamV2Info;
  let decodedData = Layout.streamV1Layout.decode(streamData);
  let fundedOnTimeUtc = parseFloat(u64Number
    .fromBuffer(decodedData.funded_on_utc)
    .toString()
  );

  let startTimeUtc = parseFloat(
    u64Number
      .fromBuffer(decodedData.start_utc)
      .toString()
  );

  let escrowVestedAmountSnapSlot = parseFloat(
    u64Number
      .fromBuffer(decodedData.escrow_vested_amount_snap_slot)
      .toString()
  );

  let escrowVestedAmountSnapBlockTime = parseFloat(
    u64Number
      .fromBuffer(decodedData.escrow_vested_amount_snap_block_time)
      .toString()
  );

  let streamResumedSlot = parseFloat(
    u64Number.fromBuffer(decodedData.stream_resumed_slot).toString()
  );

  let streamResumedBlockTime = parseFloat(
    u64Number.fromBuffer(decodedData.stream_resumed_block_time).toString()
  );

  let autoPauseInSeconds = parseFloat(
    u64Number.fromBuffer(decodedData.auto_pause_in_seconds).toString()
  );

  let rateIntervalInSeconds = parseFloat(
    u64Number.fromBuffer(decodedData.rate_interval_in_seconds).toString()
  );

  let isStreaming = streamResumedBlockTime >= escrowVestedAmountSnapBlockTime ? 1 : 0;
  let lastTimeSnap = Math.max(streamResumedBlockTime, escrowVestedAmountSnapBlockTime);
  let escrowVestedAmount = 0.0;
  let rateAmount = decodedData.rate_amount;

  const rate = rateIntervalInSeconds > 0
    ? (rateAmount / rateIntervalInSeconds) * isStreaming
    : 1;

  const elapsedTime = currentBlockTime - lastTimeSnap;
  const escrowVestedAmountSnap = decodedData.escrow_vested_amount_snap;
  const beneficiaryAssociatedToken = new PublicKey(decodedData.beneficiary_associated_token);
  const associatedToken = friendly === true
      ? beneficiaryAssociatedToken.toBase58()
      : beneficiaryAssociatedToken;

  if (currentBlockTime >= lastTimeSnap) {
    escrowVestedAmount = escrowVestedAmountSnap + rate * elapsedTime;

    if (decodedData.allocation_reserved && escrowVestedAmount > decodedData.allocation_reserved) {
      escrowVestedAmount = decodedData.allocation_reserved;
    }
  }

  let escrowUnvestedAmount = 
    decodedData.allocation_reserved 
      ? decodedData.allocation_reserved - escrowVestedAmount
      : 0;

  let escrowEstimatedDepletionDateUtc = new Date(decodedData.escrow_estimated_depletion_utc);

  if (decodedData.escrow_estimated_depletion_utc === 0) {
    let depletionTimeInSeconds = rate ? decodedData.allocation_reserved / rate : 0;
    escrowEstimatedDepletionDateUtc.setTime(startTimeUtc + depletionTimeInSeconds * 1000);
  }

  let nameBuffer = Buffer.alloc(
    decodedData.stream_name.length,
    decodedData.stream_name
  ).filter(function (elem, index) {
    return elem !== 0;
  });

  const id = friendly === true ? streamId.toBase58() : streamId;
  const treasurerAddress = new PublicKey(decodedData.treasurer_address);
  const beneficiaryAddress = new PublicKey(decodedData.beneficiary_address);
  const treasuryAddress = new PublicKey(decodedData.treasury_address);

  let state: STREAM_STATE | undefined;
  const threeDays = 3 * 24 * 3600;
  const now = new Date();

  if (startTimeUtc > now.getTime()) {
    state = STREAM_STATE.Schedule;
  } else if (escrowVestedAmount < decodedData.allocation_reserved) {
    state = STREAM_STATE.Running;
  } else if (escrowVestedAmount >= decodedData.allocation_reserved && elapsedTime < threeDays) {
    state = STREAM_STATE.Paused;
  } else if (escrowVestedAmount >= decodedData.allocation_reserved && elapsedTime >= threeDays) {
    state = STREAM_STATE.Ended;
  }

  Object.assign(
    streamV1,
    { id: id },
    {
      initialized: decodedData.initialized ? true : false,
      stream_name: new TextDecoder().decode(nameBuffer),
      treasurerAddress: friendly !== undefined ? treasurerAddress.toBase58() : treasurerAddress,
      rateAmount: decodedData.rate_amount,
      rateIntervalInSeconds: rateIntervalInSeconds,
      allocationReserved: decodedData.allocation_reserved,
      allocationCommitted: decodedData.allocation_committed,
      fundedOnUtc: new Date(fundedOnTimeUtc).toString(),
      startUtc: new Date(startTimeUtc).toString(),
      rateCliffInSeconds: parseFloat(u64Number.fromBuffer(decodedData.rate_cliff_in_seconds).toString()),
      cliffVestAmount: decodedData.cliff_vest_amount,
      cliffVestPercent: decodedData.cliff_vest_percent,
      beneficiaryAddress: friendly !== undefined ? beneficiaryAddress.toBase58() : beneficiaryAddress,
      associatedToken: associatedToken,
      escrowVestedAmount: escrowVestedAmount,
      escrowUnvestedAmount: escrowUnvestedAmount,
      treasuryAddress: friendly !== undefined ? treasuryAddress.toBase58() : treasuryAddress,
      escrowEstimatedDepletionUtc: escrowEstimatedDepletionDateUtc.toUTCString(),
      escrowVestedAmountSnap: escrowVestedAmountSnap,
      escrowVestedAmountSnapSlot: escrowVestedAmountSnapSlot,
      escrowVestedAmountSnapBlockTime: escrowVestedAmountSnapBlockTime,
      streamResumedSlot: streamResumedSlot,
      streamResumedBlockTime: streamResumedBlockTime,
      autoPauseInSeconds: autoPauseInSeconds,
      isUpdatePending: false,
      transactionSignature: "",
      createdBlockTime: 0,
      lastRetrievedBlockTime: currentBlockTime,
      state,
    }
  );

  return streamV1;
};

const parseStreamTermsData = (
  id: PublicKey,
  streamTermData: Buffer,
  friendly: boolean = true

): StreamTermsInfo => {

  let streamTerms: StreamTermsInfo = defaultStreamTermsInfo;
  let decodedData = Layout.streamTermsLayout.decode(streamTermData);
  let autoPauseInSeconds = parseFloat(u64Number.fromBuffer(decodedData.auto_pause_in_seconds).toString());
  let rateIntervalInSeconds = parseFloat(u64Number.fromBuffer(decodedData.rate_interval_in_seconds).toString());

  const beneficiaryAssociatedToken = new PublicKey(decodedData.associated_token_address);
  const associatedToken = friendly ? beneficiaryAssociatedToken.toBase58() : beneficiaryAssociatedToken;

  let nameBuffer = Buffer.alloc(
    decodedData.stream_name.length,
    decodedData.stream_name
  ).filter(function (elem, index) {
    return elem !== 0;
  });

  const termsId = friendly === true ? id.toBase58() : id;
  const treasurerAddress = new PublicKey(decodedData.treasurer_address);
  const beneficiaryAddress = new PublicKey(decodedData.beneficiary_address);

  Object.assign(
    streamTerms,
    { id: termsId },
    {
      initialized: decodedData.initialized ? true : false,
      memo: new TextDecoder().decode(nameBuffer),
      treasurerAddress: friendly !== undefined ? treasurerAddress.toBase58() : treasurerAddress,
      beneficiaryAddress: friendly !== undefined ? beneficiaryAddress.toBase58() : beneficiaryAddress,
      associatedToken: associatedToken,
      rateAmount: decodedData.rate_amount,
      rateIntervalInSeconds: rateIntervalInSeconds,
      rateCliffInSeconds: parseFloat(u64Number.fromBuffer(decodedData.rate_cliff_in_seconds).toString()),
      cliffVestAmount: decodedData.cliff_vest_amount,
      cliffVestPercent: decodedData.cliff_vest_percent,
      autoPauseInSeconds: autoPauseInSeconds,
    }
  );

  return streamTerms;
};

const parseActivityData = (
  signature: string,
  tx: ParsedConfirmedTransaction,
  friendly: boolean = true

): StreamActivity => {

  let streamActivity: StreamActivity = defaultStreamActivity;
  let signer = tx.transaction.message.accountKeys.filter((a) => a.signer)[0];
  let lastIxIndex = tx.transaction.message.instructions.length - 1;
  let lastIx = tx.transaction.message.instructions[lastIxIndex] as PartiallyDecodedInstruction;
  let buffer = base58.decode(lastIx.data);
  let actionIndex = buffer.readUInt8(0);

  if ((actionIndex >= 1 && actionIndex <= 3)) {

    let blockTime = (tx.blockTime as number) * 1000; // mult by 1000 to add milliseconds
    let action = actionIndex === 3 ? "withdrew" : "deposited";
    let layoutBuffer = Buffer.alloc(buffer.length, buffer);
    let data: any, amount = 0;

    if (actionIndex === 1) {
      data = Layout.addFundsLayout.decode(layoutBuffer);
      amount = data.contribution_amount;
    } else if (actionIndex === 2) {
      // data = Layout.recoverFunds.decode(layoutBuffer);
      // amount = data.recover_amount;
    } else {
      data = Layout.withdrawLayout.decode(layoutBuffer);
      amount = data.withdrawal_amount;
    }

    let mint: PublicKey | string;

    if (tx.meta?.preTokenBalances?.length) {
      mint = friendly === true
        ? tx.meta.preTokenBalances[0].mint
        : new PublicKey(tx.meta.preTokenBalances[0].mint);

    } else if (tx.meta?.postTokenBalances?.length) {
      mint = friendly === true
        ? tx.meta.postTokenBalances[0].mint
        : new PublicKey(tx.meta.postTokenBalances[0].mint);

    } else {
      mint = "Unknown Token";
    }

    Object.assign(
      streamActivity, 
      {
        signature: signature,
        initializer: friendly === true ? signer.pubkey.toBase58() : signer.pubkey,
        blockTime: blockTime,
        utcDate: new Date(blockTime).toUTCString(),
        action: action,
        amount: amount,
        mint,
      }
    );
  }

  return streamActivity;
};

const parseTreasuryData = (
  id: PublicKey,
  treasuryData: Buffer,
  friendly: boolean = true

): TreasuryInfo => {

  let treasury: TreasuryInfo = defaultTreasuryInfo;
  let decodedData = Layout.treasuryLayout.decode(treasuryData);

  const treasuryId = friendly === true ? id.toBase58() : id;
  const treasuryBlockHeight = parseFloat(u64Number.fromBuffer(decodedData.treasury_block_height).toString());
  const treasuryMint = new PublicKey(decodedData.treasury_mint_address);
  const treasuryMintAddress = friendly === true ? treasuryMint.toBase58() : treasuryMint;
  const treasuryBase = new PublicKey(decodedData.treasury_base_address);
  const treasuryBaseAddress = friendly === true ? treasuryBase.toBase58() : treasuryBase;

  Object.assign(
    treasury,
    { id: treasuryId },
    {
      initialized: decodedData.initialized ? true : false,
      treasuryBlockHeight,
      treasuryMintAddress,
      treasuryBaseAddress,
    }
  );

  return treasury;
};

const parseTreasuryV1Data = (
  id: PublicKey,
  treasuryData: Buffer,
  friendly: boolean = true

): TreasuryV1Info => {

  let treasuryV1: TreasuryV1Info = defaultTreasuryV2Info;
  let decodedData = Layout.treasuryV1Layout.decode(treasuryData);

  const treasuryId = friendly === true ? id.toBase58() : id;
  const slot = parseFloat(u64Number.fromBuffer(decodedData.slot).toString());
  const treasurer = new PublicKey(decodedData.treasurer_address);
  const treasurerAddress = friendly === true ? treasurer.toBase58() : treasurer;
  const associatedToken = new PublicKey(decodedData.associated_token_address);
  const associatedTokenAddress = friendly === true ? associatedToken.toBase58() : associatedToken;
  const mint = new PublicKey(decodedData.mint_address);
  const mintAddress = friendly === true ? mint.toBase58() : mint;  
  const labelBuffer = Buffer.alloc(
    decodedData.label.length,
    decodedData.label
  ).filter(function (elem, index) {
    return elem !== 0;
  });

  Object.assign(
    treasuryV1,
    { id: treasuryId },
    {
      initialized: decodedData.initialized ? true : false,
      slot,
      label: new TextDecoder().decode(labelBuffer),
      treasurerAddress,
      associatedTokenAddress,
      mintAddress,
      balance: decodedData.balance,
      allocationReserved: decodedData.allocation_reserved,
      allocationCommitted: decodedData.allocation_committed
    }
  );

  return treasuryV1;
};

export const getStream = async (
  connection: Connection,
  id: PublicKey,
  commitment?: any,
  friendly: boolean = true

): Promise<StreamInfo | StreamV1Info> => {

  let stream: any;
  let accountInfo = await connection.getAccountInfo(id, commitment);

  if (accountInfo?.data !== undefined && (
      accountInfo?.data.length === Layout.streamLayout.span ||
      accountInfo?.data.length === Constants.STREAM_V1_SIZE
    )
  ) {

    // const decodedStream = Layout.streamV1Layout.decode(accountInfo.data);
    // const resumeSlot = parseFloat(u64Number.fromBuffer(decodedStream.stream_resumed_slot).toString());
    // const resumeBlockTime = await connection.getBlockTime(resumeSlot);
    // const resumeDate = new Date(resumeBlockTime as number);
    // console.log('resume time', resumeBlockTime, resumeDate.toString());
    // const vestedSnapSlot = parseFloat(u64Number.fromBuffer(decodedStream.escrow_vested_amount_snap_slot).toString());
    // const vestedSnapBlockTime = await connection.getBlockTime(vestedSnapSlot);
    // const vestedSnapDate = new Date(vestedSnapBlockTime as number);
    // console.log('vested snap time', vestedSnapBlockTime, vestedSnapDate.toString());

    let slot = await connection.getSlot(commitment);
    let currentBlockTime = await connection.getBlockTime(slot);
    let parsedStreamData = 
      accountInfo.data.length === Layout.streamLayout.span 
        ? parseStreamData(
            id,
            accountInfo.data,
            currentBlockTime as number,
            friendly
          )
        : parseStreamV1Data(
            id,
            accountInfo.data.slice(0, Layout.streamV1Layout.span),
            currentBlockTime as number,
            friendly
          )

    stream = Object.assign({}, parsedStreamData);

    // let terms = await getStreamTerms(
    //   accountInfo.owner,
    //   connection,
    //   stream.id as PublicKey,
    //   friendly
    // );

    // stream.isUpdatePending = terms !== undefined && terms.streamId === stream.id;
    let signatures = await connection.getConfirmedSignaturesForAddress2(id, {}, "confirmed");

    if (signatures.length > 0) {
      stream.transactionSignature = signatures[0].signature;
      stream.createdBlockTime = signatures[0].blockTime as number;
    }
  }

  return stream;
};

export const getStreamCached = (
  streamInfo: StreamInfo,
  currentBlocktime: number,
  friendly: boolean = true

): StreamInfo => {

  let copyStreamInfo = Object.assign({}, streamInfo);

  const startDate = new Date();
  startDate.setTime(
    copyStreamInfo.startUtc !== undefined && 
    typeof copyStreamInfo.startUtc !== 'string'
      ? copyStreamInfo.startUtc.getTime()
      : copyStreamInfo.startUtc === undefined
      ? new Date().getTime()
      : Date.parse(copyStreamInfo.startUtc)
  );

  // refresh copy stream info
  let isStreaming = copyStreamInfo.streamResumedBlockTime >= copyStreamInfo.escrowVestedAmountSnapBlockTime ? 1 : 0;
  let lastTimeSnap = Math.max(copyStreamInfo.streamResumedBlockTime, copyStreamInfo.escrowVestedAmountSnapBlockTime);

  const rate = copyStreamInfo.rateIntervalInSeconds > 0
    ? (copyStreamInfo.rateAmount / copyStreamInfo.rateIntervalInSeconds) * isStreaming
    : 1;

  const elapsedTime = currentBlocktime - lastTimeSnap;
  copyStreamInfo.associatedToken = 
    friendly === true &&
    copyStreamInfo.associatedToken !== undefined &&
    typeof copyStreamInfo.associatedToken !== 'string'
      ? copyStreamInfo.associatedToken.toBase58()
      : copyStreamInfo.associatedToken

  if (currentBlocktime >= lastTimeSnap) {
    copyStreamInfo.escrowVestedAmount = copyStreamInfo.escrowVestedAmountSnap + rate * elapsedTime;

    if (copyStreamInfo.escrowVestedAmount > copyStreamInfo.totalDeposits - copyStreamInfo.totalWithdrawals) {
      copyStreamInfo.escrowVestedAmount = copyStreamInfo.totalDeposits - copyStreamInfo.totalWithdrawals;
    }
  }

  copyStreamInfo.escrowUnvestedAmount = 
    copyStreamInfo.totalDeposits - 
    copyStreamInfo.totalWithdrawals - 
    copyStreamInfo.escrowVestedAmount;

  let escrowEstimatedDepletionDateUtc = new Date();
  escrowEstimatedDepletionDateUtc.setTime(Date.parse(copyStreamInfo.escrowEstimatedDepletionUtc as string));

  if (escrowEstimatedDepletionDateUtc.getTime() === 0) {
    let depletionTimeInSeconds = rate ? copyStreamInfo.totalDeposits / rate : 0;
    escrowEstimatedDepletionDateUtc.setTime(startDate.getTime() + depletionTimeInSeconds * 1000);
    copyStreamInfo.escrowEstimatedDepletionUtc = 
      friendly === true 
        ? escrowEstimatedDepletionDateUtc.toUTCString()
        : escrowEstimatedDepletionDateUtc;
  }

  const id = 
    friendly === true && 
    copyStreamInfo.id !== undefined && 
    typeof copyStreamInfo.id !== 'string' 
      ? copyStreamInfo.id.toBase58() 
      : copyStreamInfo.id;

  let state: STREAM_STATE | undefined;
  const threeDays = 3 * 24 * 3600;
  const nowUtc = Date.parse(new Date().toUTCString());
  
  if (startDate.getTime() > nowUtc) {
    copyStreamInfo.state = STREAM_STATE.Schedule;
  } else if (copyStreamInfo.escrowVestedAmount < copyStreamInfo.totalDeposits - copyStreamInfo.totalWithdrawals) {
    copyStreamInfo.state = STREAM_STATE.Running;
  } else if (copyStreamInfo.escrowVestedAmount >= copyStreamInfo.totalDeposits - copyStreamInfo.totalWithdrawals && elapsedTime < threeDays) {
    copyStreamInfo.state = STREAM_STATE.Paused;
  } else if (copyStreamInfo.escrowVestedAmount >= copyStreamInfo.totalDeposits - copyStreamInfo.totalWithdrawals && elapsedTime >= threeDays) {
    copyStreamInfo.state = STREAM_STATE.Ended;
  }

  return copyStreamInfo;
}

export const getStreamV1Cached = (
  streamInfo: StreamV1Info,
  currentBlocktime: number,
  friendly: boolean = true

): StreamV1Info => {

  let copyStreamInfo = Object.assign({}, streamInfo);

  const startDate = new Date();
  startDate.setTime(
    copyStreamInfo.startUtc !== undefined && 
    typeof copyStreamInfo.startUtc !== 'string'
      ? copyStreamInfo.startUtc.getTime()
      : copyStreamInfo.startUtc === undefined
      ? new Date().getTime()
      : Date.parse(copyStreamInfo.startUtc)
  );


  // refresh copy stream info
  let isStreaming = copyStreamInfo.streamResumedBlockTime >= copyStreamInfo.escrowVestedAmountSnapBlockTime ? 1 : 0;
  let lastTimeSnap = Math.max(copyStreamInfo.streamResumedBlockTime, copyStreamInfo.escrowVestedAmountSnapBlockTime);

  const rate = copyStreamInfo.rateIntervalInSeconds > 0
    ? (copyStreamInfo.rateAmount / copyStreamInfo.rateIntervalInSeconds) * isStreaming
    : 1;

  const elapsedTime = currentBlocktime - lastTimeSnap;
  copyStreamInfo.associatedToken = 
    friendly === true &&
    copyStreamInfo.associatedToken !== undefined &&
    typeof copyStreamInfo.associatedToken !== 'string'
      ? copyStreamInfo.associatedToken.toBase58()
      : copyStreamInfo.associatedToken

  if (currentBlocktime >= lastTimeSnap) {
    copyStreamInfo.escrowVestedAmount = copyStreamInfo.escrowVestedAmountSnap + rate * elapsedTime;

    if (copyStreamInfo.allocationReserved && copyStreamInfo.escrowVestedAmount > copyStreamInfo.allocationReserved) {
      copyStreamInfo.escrowVestedAmount = copyStreamInfo.allocationReserved;
    }
  }

  copyStreamInfo.escrowUnvestedAmount = 
    copyStreamInfo.allocationReserved 
      ? copyStreamInfo.allocationReserved - copyStreamInfo.escrowVestedAmount
      : 0;

  let escrowEstimatedDepletionDateUtc = new Date();
  escrowEstimatedDepletionDateUtc.setTime(Date.parse(copyStreamInfo.escrowEstimatedDepletionUtc as string));

  if (escrowEstimatedDepletionDateUtc.getTime() === 0) {
    let depletionTimeInSeconds = rate ? copyStreamInfo.allocationReserved / rate : 0;
    escrowEstimatedDepletionDateUtc.setTime(startDate.getTime() + depletionTimeInSeconds * 1000);
    copyStreamInfo.escrowEstimatedDepletionUtc = 
      friendly === true 
        ? escrowEstimatedDepletionDateUtc.toUTCString()
        : escrowEstimatedDepletionDateUtc;
  }

  const id = 
    friendly === true && 
    copyStreamInfo.id !== undefined && 
    typeof copyStreamInfo.id !== 'string' 
      ? copyStreamInfo.id.toBase58() 
      : copyStreamInfo.id;

  let state: STREAM_STATE | undefined;
  const threeDays = 3 * 24 * 3600;
  const nowUtc = Date.parse(new Date().toUTCString());
  

  if (startDate.getTime() > nowUtc) {
    copyStreamInfo.state = STREAM_STATE.Schedule;
  } else if (copyStreamInfo.escrowVestedAmount < copyStreamInfo.allocationReserved) {
    copyStreamInfo.state = STREAM_STATE.Running;
  } else if (copyStreamInfo.escrowVestedAmount >= copyStreamInfo.allocationReserved && elapsedTime < threeDays) {
    copyStreamInfo.state = STREAM_STATE.Paused;
  } else if (copyStreamInfo.escrowVestedAmount >= copyStreamInfo.allocationReserved && elapsedTime >= threeDays) {
    copyStreamInfo.state = STREAM_STATE.Ended;
  }

  return copyStreamInfo;
}

export const getStreamTerms = async (
  programId: PublicKey,
  connection: Connection,
  streamId: PublicKey,
  commitment?: any,
  friendly: boolean = true

): Promise<StreamTermsInfo | undefined> => {

  let terms: StreamTermsInfo | undefined;
  const accounts = await connection.getProgramAccounts(programId, commitment);

  if (accounts === null || !accounts.length) {
    return terms;
  }

  for (let item of accounts) {
    if (item.account.data !== undefined && item.account.data.length === Layout.streamTermsLayout.span) {
      let info = Object.assign({}, parseStreamTermsData(item.pubkey, item.account.data, friendly));
      if (streamId.toBase58() === info.streamId) {
        terms = info;
        break;
      }
    }
  }

  return terms;
};

export async function listStreams(
  connection: Connection,
  programId: PublicKey,
  treasurer?: PublicKey | undefined,
  treasury?: PublicKey | undefined,
  beneficiary?: PublicKey | undefined,
  commitment?: Commitment | undefined,
  friendly: boolean = true

): Promise<(StreamInfo | StreamV1Info)[]> {

  let streams: (StreamInfo | StreamV1Info)[] = [];
  let accounts: any[] = [];

  // Lookup treasuries
  const configOrCommitment: GetProgramAccountsConfig = {
    commitment,
    filters: [
      { dataSize: Layout.streamLayout.span }
    ]
  };

  const accountsV1 = await connection.getProgramAccounts(programId, configOrCommitment);

  if (accountsV1.length) {
    accounts.push(...accountsV1);
  }

  // Lookup treasuries v1
  const configOrCommitmentV1: GetProgramAccountsConfig = {
    commitment,
    dataSlice: {
      offset: 0,
      length: Layout.streamV1Layout.span
    },
    filters: [
      { dataSize: Constants.STREAM_V1_SIZE }
    ]
  };

  const accountsV2 = await connection.getProgramAccounts(programId, configOrCommitmentV1);

  if (accountsV2.length) {
    accounts.push(...accountsV2);
  }

  let slot = await connection.getSlot(commitment);
  let currentBlockTime = await connection.getBlockTime(slot);

  for (let item of accounts) {
    if (item.account.lamports > 0 && 
        item.account.data !== undefined && (
          item.account.data.length === Layout.streamLayout.span ||
          item.account.data.length === Layout.streamV1Layout.span
        )
      ) {

        let included = false;
        let parsedStreamData = 
          item.account.data.length === Layout.streamLayout.span 
            ? parseStreamData(
                item.pubkey,
                item.account.data,
                currentBlockTime as number,
                friendly
              )
            : parseStreamV1Data(
                item.pubkey,
                item.account.data,
                currentBlockTime as number,
                friendly
              )

        let info = Object.assign({}, parsedStreamData);
        let startDateUtc = new Date(info.startUtc as string);
        let threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        if ((treasurer && treasurer.toBase58() === info.treasurerAddress) || !treasurer) {
          included = true;
        } else if ((beneficiary && beneficiary.toBase58() === info.beneficiaryAddress) || !beneficiary) {
          included = true;
        }

        if (treasury && treasury.toBase58() === info.treasuryAddress) {
          included = true;
        }
  
        if (included && (info.startUtc as Date) !== undefined) {
          let startDateUtc = new Date(info.startUtc as string);
          let threeDaysAgo = new Date();
          threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  
          if (startDateUtc.getTime() > threeDaysAgo.getTime()) {
            let signatures = await connection.getConfirmedSignaturesForAddress2(
              friendly ? (info.id as string).toPublicKey() : (info.id as PublicKey),
              {},
              "finalized"
            );
  
            if (signatures.length > 0) {
              info.createdBlockTime = signatures[0].blockTime as number;
              info.transactionSignature = signatures[0].signature;
            }
          }
        }
  
        if (included) {
          streams.push(info);
        }
      }
  }

  let orderedStreams = streams.sort((a, b) => b.createdBlockTime - a.createdBlockTime);

  return orderedStreams;
}

export async function listStreamsCached(
  streams: any[],
  friendly: boolean = true

): Promise<(StreamInfo | StreamV1Info)[]> {

  let streamList: (StreamInfo | StreamV1Info)[] = [];
  const currentTime = Date.parse(new Date().toUTCString()) / 1000;

  for (let stream of streams) {
    streamList.push(
      getStreamCached(
        Object.assign({}, stream),
        currentTime,
        friendly
      )
    );
  }  

  return streamList;
}

export async function getStreamContributors(
  connection: Connection,
  id: PublicKey,
  commitment?: any

): Promise<PublicKey[]> {

  let contributors: PublicKey[] = [];
  let signatures = await connection.getConfirmedSignaturesForAddress2(id, {}, "finalized");

  for (let sign of signatures) {
    let tx = await connection.getParsedConfirmedTransaction(sign.signature, "finalized");

    if (tx !== null) {
      let lastIxIndex = tx.transaction.message.instructions.length - 1;
      let lastIx = tx.transaction.message.instructions[
        lastIxIndex
      ] as PartiallyDecodedInstruction;

      if (lastIx.accounts.length) {
        contributors.push(lastIx.accounts[0]);
      }
    }
  }

  return contributors;
}

export async function listStreamActivity(
  connection: Connection,
  streamId: PublicKey,
  commitment?: Finality | undefined,
  friendly: boolean = true

): Promise<any[]> {

  let activity: any = [];
  let finality = commitment !== undefined ? commitment : "confirmed";
  let signatures = await connection.getConfirmedSignaturesForAddress2(streamId, {}, finality);

  for (let sign of signatures) {
    let tx = await connection.getParsedConfirmedTransaction(sign.signature, finality);

    if (tx !== null) {
      activity.push(
        Object.assign({}, parseActivityData(sign.signature, tx, friendly))
      );
    }
  }

  return activity.sort(
    (a: { blockTime: number }, b: { blockTime: number }) => b.blockTime - a.blockTime
  );
}

export async function listTreasuries(
  programId: PublicKey,
  connection: Connection,
  treasurer?: PublicKey | undefined,
  commitment?: any,
  friendly: boolean = true

): Promise<(TreasuryInfo | TreasuryV1Info)[]> {

  let treasuries: (TreasuryInfo | TreasuryV1Info)[] = [];
  let accounts: any[] = [];

  // Lookup treasuries
  const configOrCommitment: GetProgramAccountsConfig = {
    commitment,
    filters: [
      { dataSize: Layout.treasuryLayout.span }
    ]
  };

  const accountsV1 = await connection.getProgramAccounts(programId, configOrCommitment);

  if (accountsV1.length) {
    accounts.push(...accountsV1);
  }

  // Lookup treasuries v1
  const configOrCommitmentV1: GetProgramAccountsConfig = {
    commitment,
    dataSlice: {
      offset: 0,
      length: Layout.treasuryV1Layout.span
    },
    filters: [
      { dataSize: Constants.TREASURY_V1_SIZE }
    ]
  };

  const accountsV2 = await connection.getProgramAccounts(programId, configOrCommitmentV1);

  if (accountsV2.length) {
    accounts.push(...accountsV2);
  }

  if (accounts.length) {
    for (let item of accounts) {
      if (item.account.data !== undefined) {
        let parsedTreasury: any = 
          item.account.data.length === Layout.treasuryLayout.span
            ? parseTreasuryData(
                item.pubkey, 
                item.account.data, 
                friendly
              )
            : parseTreasuryV1Data(
                item.pubkey, 
                item.account.data, 
                friendly
              );

        let info = Object.assign({}, parsedTreasury);
        let treasurerAddress = item.account.data.length === Layout.treasuryLayout.span 
          ? info.treasuryBaseAddress 
          : info.treasurerAddress;

        if (!treasurer || (treasurer && treasurer.toBase58() === treasurerAddress)) {
          treasuries.push(info);
        }
      }
    }
  }

  return treasuries;
}

export async function getTreasury(
  connection: Connection,
  id: PublicKey,
  commitment?: any,
  friendly: boolean = true

): Promise<TreasuryInfo | TreasuryV1Info> {

  let treasury: any;
  let accountInfo = await connection.getAccountInfo(id, commitment);
  
  if (accountInfo && 
      accountInfo.data !== undefined && (
        accountInfo.data.length === Layout.treasuryLayout.span ||
        accountInfo.data.length === Constants.TREASURY_V1_SIZE
      )
  ) {

    let parsedTreasury = 
      accountInfo.data.length === Layout.treasuryLayout.span
        ? parseTreasuryData(
            id, 
            accountInfo.data, 
            friendly
          )
        : parseTreasuryV1Data(
            id, 
            accountInfo.data.slice(
              0, 
              Layout.treasuryV1Layout.span
            ), 
            friendly
          );

    treasury = Object.assign({}, parsedTreasury);
  }

  return treasury;
}

export async function getTreasuryMints(
  connection: Connection,
  programId: PublicKey,
  treasury: PublicKey,
  commitment?: any

): Promise<PublicKey[]> {

  let mints: PublicKey[] = [];
  let commitmentValue = commitment !== undefined ? (commitment as Finality) : "confirmed";
  let context = await connection.getParsedTokenAccountsByOwner(
    treasury,
    { programId },
    commitmentValue
  );

  for (let resp in context) {
    let tokenAccount = (resp as any).account;
    let parsedTokenAccount = await getTokenAccount(
      connection,
      tokenAccount.data
    );

    if (parsedTokenAccount !== null) {
      mints.push(parsedTokenAccount.mint);
    }
  }

  return mints;
}

export async function findATokenAddress(
  walletAddress: PublicKey,
  tokenMintAddress: PublicKey

): Promise<PublicKey> {

  return (
    await PublicKey.findProgramAddress(
      [
        walletAddress.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        tokenMintAddress.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  )[0];
}

export const getMintAccount = async (
  connection: Connection,
  pubKey: PublicKey | string

): Promise<MintInfo> => {

  const address = typeof pubKey === "string" ? new PublicKey(pubKey) : pubKey;
  const info = await connection.getAccountInfo(address);

  if (info === null) {
    throw new Error("Failed to find mint account");
  }

  return deserializeMint(info.data);
};

export const deserializeMint = (data: Buffer): MintInfo => {
  if (data.length !== MintLayout.span) {
    throw new Error("Not a valid Mint");
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

export const getTokenAccount = async (
  connection: Connection,
  pubKey: PublicKey | string

): Promise<AccountInfo | null> => {

  const address = typeof pubKey === "string" ? new PublicKey(pubKey) : pubKey;
  const info = await connection.getAccountInfo(address);

  if (info === null) {
    // throw new Error('Failed to find token account');
    return null;
  }

  return deserializeTokenAccount(info.data);
};

export const deserializeTokenAccount = (data: Buffer): AccountInfo => {
  if (data.length !== AccountLayout.span) {
    throw new Error("Not a valid Token");
  }

  const accountInfo = AccountLayout.decode(data);

  accountInfo.amount = u64.fromBuffer(accountInfo.amount);

  return accountInfo as AccountInfo;
};

export function convertLocalDateToUTCIgnoringTimezone(date: Date) {
  const timestamp = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds()
  );

  return new Date(timestamp);
}

export const calculateActionFees = async (
  connection: Connection,
  action: MSP_ACTIONS

): Promise<TransactionFees> => {

  let recentBlockhash = await connection.getRecentBlockhash(connection.commitment as Commitment),
    lamportsPerSignatureFee = recentBlockhash.feeCalculator.lamportsPerSignature,
    blockchainFee = 0,
    accountsHeaderSize = 128,
    txFees: TransactionFees = {
      blockchainFee: 0.0,
      mspFlatFee: 0.0,
      mspPercentFee: 0.0,
    };

  switch (action) {
    case MSP_ACTIONS.createStream: {
      let accountsSize = 2 * AccountLayout.span + Layout.createStreamLayout.span + Layout.createTreasuryLayout.span;
      const maxAccountsSize = 3 * accountsHeaderSize + accountsSize;
      blockchainFee = await connection.getMinimumBalanceForRentExemption(parseFloat(maxAccountsSize.toFixed(9)));
      txFees.mspFlatFee = 0.00001;
      break;
    }
    case MSP_ACTIONS.createStreamWithFunds: {
      let accountsSize = 2 * AccountLayout.span + Layout.createStreamLayout.span + Layout.createTreasuryLayout.span + MintLayout.span;
      const maxAccountsSize = 4 * accountsHeaderSize + accountsSize;
      lamportsPerSignatureFee = recentBlockhash.feeCalculator.lamportsPerSignature * 2;
      blockchainFee = await connection.getMinimumBalanceForRentExemption(parseFloat(maxAccountsSize.toFixed(9)));
      txFees.mspFlatFee = 0.000035;
      break;
    }
    case MSP_ACTIONS.scheduleOneTimePayment: {
      let accountsSize = 2 * AccountLayout.span + Layout.createStreamLayout.span + Layout.createTreasuryLayout.span;
      const maxAccountsSize = 3 * accountsHeaderSize + accountsSize;
      lamportsPerSignatureFee = recentBlockhash.feeCalculator.lamportsPerSignature * 2;
      blockchainFee = await connection.getMinimumBalanceForRentExemption(parseFloat(maxAccountsSize.toFixed(9)));
      txFees.mspFlatFee = 0.000035;
      break;
    }
    case MSP_ACTIONS.addFunds: {
      txFees.mspFlatFee = 0.000025;
      break;
    }
    case MSP_ACTIONS.withdraw: {
      let accountsSize = 2 * AccountLayout.span;
      const maxAccountsSize = accountsHeaderSize + accountsSize;
      blockchainFee = await connection.getMinimumBalanceForRentExemption(parseFloat(maxAccountsSize.toFixed(9)));
      txFees.mspPercentFee = 0.25;
      break;
    }
    case MSP_ACTIONS.closeStream: {
      txFees.mspFlatFee = 0.00001;
      txFees.mspPercentFee = 0.25;
      break;
    }
    case MSP_ACTIONS.wrap: {
      let accountsSize = 2 * AccountLayout.span;
      const maxAccountsSize = accountsHeaderSize + accountsSize;
      lamportsPerSignatureFee = 2 * recentBlockhash.feeCalculator.lamportsPerSignature;
      blockchainFee = await connection.getMinimumBalanceForRentExemption(parseFloat(maxAccountsSize.toFixed(9)));
      break;
    }
    case MSP_ACTIONS.swap: {
      let accountsSize = 3 * AccountLayout.span;
      const maxAccountsSize = 2 * accountsHeaderSize + accountsSize;
      lamportsPerSignatureFee = recentBlockhash.feeCalculator.lamportsPerSignature * 3;
      blockchainFee = await connection.getMinimumBalanceForRentExemption(parseFloat(maxAccountsSize.toFixed(9)));
      txFees.mspPercentFee = 0.05;
      break;
    }
    default: {
      break;
    }
  }

  txFees.blockchainFee =
    (blockchainFee + lamportsPerSignatureFee) / LAMPORTS_PER_SOL;

  return txFees;
};

export const wrapSol = async (
  connection: Connection,
  from: PublicKey,
  amount: number

): Promise<Transaction> => {

  const ixs: TransactionInstruction[] = [];
  const newAccount = Keypair.generate();
  const minimumWrappedAccountBalance = await connection.getMinimumBalanceForRentExemption(AccountLayout.span);

  ixs.push(
    SystemProgram.createAccount({
      fromPubkey: from,
      newAccountPubkey: newAccount.publicKey,
      lamports: minimumWrappedAccountBalance + amount * LAMPORTS_PER_SOL,
      space: AccountLayout.span,
      programId: TOKEN_PROGRAM_ID,
    }),
    Token.createInitAccountInstruction(
      TOKEN_PROGRAM_ID,
      Constants.WSOL_TOKEN_MINT,
      newAccount.publicKey,
      from
    )
  );

  const aTokenKey = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    Constants.WSOL_TOKEN_MINT,
    from,
    true
  );

  const accountInfo = await connection.getAccountInfo(aTokenKey);

  if (accountInfo === null) {
    ixs.push(
      Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        Constants.WSOL_TOKEN_MINT,
        aTokenKey,
        from,
        from
      )
    );
  }

  ixs.push(
    Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      newAccount.publicKey,
      aTokenKey,
      from,
      [],
      amount * LAMPORTS_PER_SOL
    ),
    Token.createCloseAccountInstruction(
      TOKEN_PROGRAM_ID,
      newAccount.publicKey,
      from,
      from,
      []
    )
  );

  let tx = new Transaction().add(...ixs);
  tx.feePayer = from;
  let hash = await connection.getRecentBlockhash(
    connection.commitment as Commitment
  );
  tx.recentBlockhash = hash.blockhash;
  tx.partialSign(newAccount);

  return tx;
};

export const buildTransactionsMessageData = async (
  connection: Connection,
  transactions: Transaction[]
): Promise<string> => {
  let message = "Sign this test message";
  // TODO: Implement
  return message;
};

export function encode(data: Buffer): string {
  return base64.fromByteArray(data);
}

export function decode(data: string): Buffer {
  return Buffer.from(base64.toByteArray(data));
}