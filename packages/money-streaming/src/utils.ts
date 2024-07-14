import base58 from 'bs58';
import { fromByteArray, toByteArray } from 'base64-js';

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
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

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
  Keypair,
  GetProgramAccountsConfig,
  ParsedTransactionWithMeta,
} from '@solana/web3.js';

/**
 * MSP
 */
import * as Layout from './layout';
import { Constants } from './constants';
import {
  MSP_ACTIONS,
  StreamActivity,
  StreamInfo,
  STREAM_STATE,
  TransactionFees,
  TreasuryInfo,
  TreasuryType,
} from './types';
import { TextDecoder } from 'node:util';

String.prototype.toPublicKey = function (): PublicKey {
  return new PublicKey(this.toString());
};

const defaultStreamInfo: StreamInfo = {
  id: undefined,
  initialized: false,
  streamName: '',
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
  allocationLeft: 0,
  allocationAssigned: 0,
  escrowVestedAmountSnap: 0,
  escrowVestedAmountSnapSlot: 0,
  escrowVestedAmountSnapBlockTime: 0,
  streamResumedSlot: 0,
  streamResumedBlockTime: 0,
  autoPauseInSeconds: 0,
  isUpdatePending: false,
  // transactionSignature: undefined,
  createdBlockTime: 0,
  lastRetrievedBlockTime: 0,
  upgradeRequired: false,
  state: STREAM_STATE.Schedule,
  version: 1,
};

const defaultTreasuryInfo: TreasuryInfo = {
  id: '',
  initialized: false,
  slot: 0,
  treasurerAddress: '',
  associatedTokenAddress: '',
  mintAddress: '',
  label: '',
  balance: 0,
  allocationReserved: 0,
  allocationLeft: 0,
  allocationAssigned: 0,
  streamsAmount: 0,
  upgradeRequired: false,
  createdOnUtc: '',
  depletionRate: 0,
  type: TreasuryType.Open,
  autoClose: false,
  version: 0,
};

const defaultStreamActivity: StreamActivity = {
  signature: '',
  initializer: '',
  action: '',
  amount: 0,
  mint: '',
  blockTime: 0,
  utcDate: '',
};

const parseStreamV0Data = (
  streamId: PublicKey,
  streamData: Buffer,
  currentBlockTime: number,
  friendly: boolean = true,
): StreamInfo => {
  const stream: StreamInfo = defaultStreamInfo;
  const decodedData = Layout.streamV0Layout.decode(streamData);
  const fundedOnTimeUtc = decodedData.funded_on_utc;
  const startTimeUtcInMilliseconds = decodedData.start_utc;
  const escrowVestedAmountSnapBlockHeight = parseFloat(
    u64.fromBuffer(decodedData.escrow_vested_amount_snap_block_height).toString(),
  );
  const escrowVestedAmountSnapBlockTime = parseFloat(
    u64.fromBuffer(decodedData.escrow_vested_amount_snap_block_time).toString(),
  );
  const streamResumedBlockHeight = parseFloat(u64.fromBuffer(decodedData.stream_resumed_block_height).toString());
  const streamResumedBlockTime = parseFloat(u64.fromBuffer(decodedData.stream_resumed_block_time).toString());
  const autoPauseInSeconds = parseFloat(u64.fromBuffer(decodedData.auto_pause_in_seconds).toString());
  const rateIntervalInSeconds = parseFloat(u64.fromBuffer(decodedData.rate_interval_in_seconds).toString());

  const now = new Date();
  const isScheduled = startTimeUtcInMilliseconds > now.getTime();
  const isStreaming = streamResumedBlockTime >= escrowVestedAmountSnapBlockTime ? 1 : 0;
  const lastTimeSnap = Math.max(streamResumedBlockTime, escrowVestedAmountSnapBlockTime);
  let escrowVestedAmount = 0.0;
  let escrowUnvestedAmount = 0.0;
  const escrowVestedAmountSnap = 0.0;
  const rateAmount = decodedData.rate_amount;

  // if (decodedData.cliff_vest_amount > 0) {
  //   escrowVestedAmountSnap += decodedData.cliff_vest_amount;
  // }

  // if (decodedData.cliff_vest_percent > 0 && decodedData.cliff_vest_percent < 100) {
  //   escrowVestedAmountSnap += (decodedData.cliff_vest_percent * decodedData.allocation_assigned / 100);
  // }

  const rate = rateIntervalInSeconds > 0 ? (rateAmount / rateIntervalInSeconds) * isStreaming : 1;

  if (isScheduled) {
    escrowVestedAmount = 0;
    escrowUnvestedAmount = decodedData.total_deposits - decodedData.total_withdrawals;
  } else {
    const elapsedTime = currentBlockTime - lastTimeSnap;
    escrowVestedAmount = escrowVestedAmountSnap + rate * elapsedTime;
    if (escrowVestedAmount > decodedData.total_deposits - decodedData.total_withdrawals) {
      escrowVestedAmount = decodedData.total_deposits - decodedData.total_withdrawals;
    }
    escrowUnvestedAmount = decodedData.total_deposits - decodedData.total_withdrawals - escrowVestedAmount;
  }

  const escrowEstimatedDepletionDateUtc = new Date(decodedData.escrow_estimated_depletion_utc);

  if (!decodedData.escrow_estimated_depletion_utc) {
    const depletionTimeInSeconds = rate ? decodedData.total_deposits / rate : 0;
    escrowEstimatedDepletionDateUtc.setTime(startTimeUtcInMilliseconds + depletionTimeInSeconds * 1000);
  }

  const beneficiaryAssociatedToken = new PublicKey(decodedData.stream_associated_token);
  const associatedToken = friendly ? beneficiaryAssociatedToken.toBase58() : beneficiaryAssociatedToken;

  const nameBuffer = Buffer.alloc(decodedData.stream_name.length, decodedData.stream_name).filter(function (elem, index) {
    return elem !== 0;
  });

  const id = friendly ? streamId.toBase58() : streamId;
  const treasurerAddress = new PublicKey(decodedData.treasurer_address);
  const beneficiaryAddress = new PublicKey(decodedData.beneficiary_address);
  const treasuryAddress = new PublicKey(decodedData.treasury_address);

  let state: STREAM_STATE | undefined;

  if (startTimeUtcInMilliseconds > now.getTime()) {
    state = STREAM_STATE.Schedule;
  } else if (escrowVestedAmount < decodedData.total_deposits - decodedData.total_withdrawals && isStreaming) {
    state = STREAM_STATE.Running;
  } else {
    state = STREAM_STATE.Paused;
  }

  Object.assign(
    stream,
    { id },
    {
      initialized: decodedData.initialized ? true : false,
      streamName: new TextDecoder().decode(nameBuffer),
      treasurerAddress: friendly !== undefined ? treasurerAddress.toBase58() : treasurerAddress,
      rateAmount: decodedData.rate_amount,
      rateIntervalInSeconds,
      fundedOnUtc: new Date(fundedOnTimeUtc).toString(),
      startUtc: new Date(startTimeUtcInMilliseconds).toString(),
      rateCliffInSeconds: parseFloat(u64.fromBuffer(decodedData.rate_cliff_in_seconds).toString()),
      cliffVestAmount: 0, //decodedData.cliff_vest_amount,
      cliffVestPercent: 0, //decodedData.cliff_vest_percent,
      beneficiaryAddress: friendly !== undefined ? beneficiaryAddress.toBase58() : beneficiaryAddress,
      associatedToken,
      escrowVestedAmount,
      escrowUnvestedAmount,
      treasuryAddress: friendly !== undefined ? treasuryAddress.toBase58() : treasuryAddress,
      escrowEstimatedDepletionUtc: escrowEstimatedDepletionDateUtc.toString(),
      allocationReserved: 0,
      allocationLeft: decodedData.total_deposits - decodedData.total_withdrawals,
      allocationAssigned: decodedData.total_withdrawals,
      escrowVestedAmountSnap,
      escrowVestedAmountSnapSlot: escrowVestedAmountSnapBlockHeight,
      escrowVestedAmountSnapBlockTime,
      streamResumedSlot: streamResumedBlockHeight,
      streamResumedBlockTime,
      autoPauseInSeconds,
      isUpdatePending: false,
      transactionSignature: '',
      createdBlockTime: Math.round(startTimeUtcInMilliseconds / 1000),
      lastRetrievedBlockTime: currentBlockTime,
      upgradeRequired: true,
      state,
      version: 0,
    },
  );

  return stream;
};

const parseStreamData = (
  streamId: PublicKey,
  streamData: Buffer,
  currentBlockTime: number,
  friendly: boolean = true,
): StreamInfo => {
  const stream: StreamInfo = defaultStreamInfo;
  const decodedData = Layout.streamLayout.decode(streamData);
  const fundedOnTimeUtc = parseFloat(u64.fromBuffer(decodedData.funded_on_utc).toString());
  const startTimeUtcInMilliseconds = parseFloat(u64.fromBuffer(decodedData.start_utc).toString());
  const escrowVestedAmountSnapSlot = parseFloat(u64.fromBuffer(decodedData.escrow_vested_amount_snap_slot).toString());
  const escrowVestedAmountSnapBlockTime = parseFloat(
    u64.fromBuffer(decodedData.escrow_vested_amount_snap_block_time).toString(),
  );
  const streamResumedSlot = parseFloat(u64.fromBuffer(decodedData.stream_resumed_slot).toString());
  const streamResumedBlockTime = parseFloat(u64.fromBuffer(decodedData.stream_resumed_block_time).toString());
  const autoPauseInSeconds = parseFloat(u64.fromBuffer(decodedData.auto_pause_in_seconds).toString());
  const rateIntervalInSeconds = parseFloat(u64.fromBuffer(decodedData.rate_interval_in_seconds).toString());
  const now = new Date();
  const isScheduled = startTimeUtcInMilliseconds > now.getTime();
  const isStreaming = streamResumedBlockTime >= escrowVestedAmountSnapBlockTime ? 1 : 0;
  const lastTimeSnap = Math.max(streamResumedBlockTime, escrowVestedAmountSnapBlockTime);
  let escrowVestedAmount = 0.0;
  let escrowUnvestedAmount = 0.0;
  const escrowVestedAmountSnap = 0.0;
  const rateAmount = decodedData.rate_amount;

  // if (decodedData.cliff_vest_amount > 0 && decodedData.cliff_vest_percent < 100) {
  //   escrowVestedAmountSnap += decodedData.cliff_vest_amount;
  // }

  // const allocation = decodedData.allocation_assigned > 0 ? decodedData.allocation_assigned : decodedData.allocation_reserved;

  // if (decodedData.cliff_vest_percent > 0) {
  //   escrowVestedAmountSnap += (decodedData.cliff_vest_percent * allocation / 100);
  // }

  const rate = rateIntervalInSeconds > 0 ? (rateAmount / rateIntervalInSeconds) * isStreaming : 1;

  if (isScheduled) {
    escrowVestedAmount = 0;
    escrowUnvestedAmount = decodedData.allocation_assigned;
  } else {
    const elapsedTime = currentBlockTime - lastTimeSnap;
    escrowVestedAmount = escrowVestedAmountSnap + rate * elapsedTime;
    if (escrowVestedAmount > decodedData.allocation_left) {
      escrowVestedAmount = decodedData.allocation_left;
    }
    escrowUnvestedAmount = decodedData.allocation_left - escrowVestedAmount;
  }

  const escrowEstimatedDepletionDateUtcValue = parseFloat(
    u64.fromBuffer(decodedData.escrow_estimated_depletion_utc).toString(),
  );

  let escrowEstimatedDepletionDateUtc = new Date();

  if (escrowEstimatedDepletionDateUtcValue === 0) {
    const depletionTimeInSeconds = rate ? decodedData.allocation_left / rate : decodedData.allocation_left / 60;
    escrowEstimatedDepletionDateUtc = new Date(startTimeUtcInMilliseconds + depletionTimeInSeconds * 1000);
  } else {
    escrowEstimatedDepletionDateUtc.setTime(escrowEstimatedDepletionDateUtcValue);
  }

  const beneficiaryAssociatedToken = new PublicKey(decodedData.beneficiary_associated_token);
  const associatedToken = friendly === true ? beneficiaryAssociatedToken.toBase58() : beneficiaryAssociatedToken;

  const nameBuffer = Buffer.alloc(decodedData.stream_name.length, decodedData.stream_name).filter(function (elem, index) {
    return elem !== 0;
  });

  const id = friendly === true ? streamId.toBase58() : streamId;
  const treasurerAddress = new PublicKey(decodedData.treasurer_address);
  const beneficiaryAddress = new PublicKey(decodedData.beneficiary_address);
  const treasuryAddress = new PublicKey(decodedData.treasury_address);

  let state: STREAM_STATE | undefined;

  if (startTimeUtcInMilliseconds > now.getTime()) {
    state = STREAM_STATE.Schedule;
  } else if (escrowVestedAmount < decodedData.allocation_left && isStreaming) {
    state = STREAM_STATE.Running;
  } else {
    state = STREAM_STATE.Paused;
  }

  Object.assign(
    stream,
    { id },
    {
      initialized: decodedData.initialized ? true : false,
      streamName: new TextDecoder().decode(nameBuffer),
      treasurerAddress: friendly !== undefined ? treasurerAddress.toBase58() : treasurerAddress,
      rateAmount: decodedData.rate_amount,
      rateIntervalInSeconds,
      allocationReserved: decodedData.allocation_reserved,
      allocationLeft: decodedData.allocation_left,
      allocationAssigned: decodedData.allocation_assigned,
      fundedOnUtc: new Date(fundedOnTimeUtc).toString(),
      startUtc: new Date(startTimeUtcInMilliseconds).toString(),
      rateCliffInSeconds: parseFloat(u64.fromBuffer(decodedData.rate_cliff_in_seconds).toString()),
      cliffVestAmount: 0, //decodedData.cliff_vest_amount,
      cliffVestPercent: 0, //decodedData.cliff_vest_percent,
      beneficiaryAddress: friendly !== undefined ? beneficiaryAddress.toBase58() : beneficiaryAddress,
      associatedToken,
      escrowVestedAmount,
      escrowUnvestedAmount,
      treasuryAddress: friendly !== undefined ? treasuryAddress.toBase58() : treasuryAddress,
      escrowEstimatedDepletionUtc:
        escrowEstimatedDepletionDateUtcValue === 0 ? '' : escrowEstimatedDepletionDateUtc.toString(),
      escrowVestedAmountSnap,
      escrowVestedAmountSnapSlot,
      escrowVestedAmountSnapBlockTime,
      streamResumedSlot,
      streamResumedBlockTime,
      autoPauseInSeconds,
      isUpdatePending: false,
      transactionSignature: '',
      createdBlockTime: Math.round(startTimeUtcInMilliseconds / 1000),
      lastRetrievedBlockTime: currentBlockTime,
      upgradeRequired: false,
      state,
      version: 1,
    },
  );

  return stream;
};

const parseTreasuryV0Data = async (
  connection: Connection,
  id: PublicKey,
  treasuryData: Buffer,
  friendly: boolean = true,
): Promise<TreasuryInfo> => {
  const treasury: TreasuryInfo = defaultTreasuryInfo;
  const decodedData = Layout.treasuryV0Layout.decode(treasuryData);
  const treasuryId = friendly === true ? id.toBase58() : id;
  const treasuryBlockHeight = parseFloat(u64.fromBuffer(decodedData.treasury_block_height).toString());
  const treasuryMint = new PublicKey(decodedData.treasury_mint_address);
  const treasuryMintAddress = friendly === true ? treasuryMint.toBase58() : treasuryMint;
  const treasuryBase = new PublicKey(decodedData.treasury_base_address);
  const treasuryBaseAddress = friendly === true ? treasuryBase.toBase58() : treasuryBase;
  let associatedToken: any;
  let balance = 0;
  const tokenAccountsResult = await connection.getTokenAccountsByOwner(id, { programId: TOKEN_PROGRAM_ID });

  if (tokenAccountsResult.value?.length) {
    const tokenAccount = AccountLayout.decode(tokenAccountsResult.value[0].account.data);
    associatedToken = new PublicKey(tokenAccount.mint);
    const treasuryToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      associatedToken,
      id,
      true,
    );
    const tokenAmount = await connection.getTokenAccountBalance(treasuryToken);
    balance = tokenAmount?.value ? tokenAmount.value.uiAmount ?? 0 : 0;
  }

  Object.assign(
    treasury,
    { id: treasuryId },
    {
      initialized: decodedData.initialized ? true : false,
      slot: treasuryBlockHeight,
      label: '',
      treasurerAddress: treasuryBaseAddress,
      associatedTokenAddress: associatedToken && friendly ? associatedToken.toBase58() : '',
      mintAddress: treasuryMintAddress,
      balance,
      allocationReserved: 0,
      allocationleft: 0,
      allocation: 0,
      streamsAmount: 0,
      createdOnUtc: '',
      depletionRate: 0,
      type: TreasuryType.Open,
      upgradeRequired: true,
      autoClose: true,
      version: 0,
    },
  );

  return treasury;
};

const parseActivityData = (
  signature: string,
  tx: ParsedTransactionWithMeta,
  friendly: boolean = true,
): StreamActivity => {
  let streamActivity: StreamActivity = defaultStreamActivity;
  const signer = tx.transaction.message.accountKeys.find((a) => a.signer);
  const ix = tx.transaction.message.instructions.find((ix: any) => {
    if (ix && ix.data) {
      let buffer = base58.decode(ix.data);
      let actionIndex = buffer.at(0); // .readUInt8(0);
      return actionIndex === 1 || actionIndex === 2 || actionIndex === 3;
    }
    return false;
  }) as PartiallyDecodedInstruction | undefined;

  if (!ix) {
    return streamActivity;
  }

  const buffer = base58.decode(ix.data);
  // TODO: Verify that this is correct
  const actionIndex = buffer.at(0); // .readUInt8(0);

  if (actionIndex === 1 || actionIndex === 2 || actionIndex === 3) {
    const blockTime = (tx.blockTime as number) * 1000; // mult by 1000 to add milliseconds
    const action = actionIndex === 1 ? 'deposited' : 'withdrew';
    const layoutBuffer = Buffer.alloc(buffer.length, buffer);
    let data: any;
    let amount = 0;

    if (actionIndex === 1) {
      if (layoutBuffer.length === Layout.addFundsLayoutV0.span) {
        data = Layout.addFundsLayoutV0.decode(layoutBuffer);
        amount = data.contribution_amount;
      } else {
        data = Layout.addFundsLayout.decode(layoutBuffer);
        amount = data.amount;
      }
    } else if (actionIndex == 2 && layoutBuffer.length === Layout.withdrawLayout.span) {
      data = Layout.withdrawLayout.decode(layoutBuffer);
      amount = data.amount;
    } else if (actionIndex == 3 && layoutBuffer.length === Layout.withdrawLayoutV0.span) {
      data = Layout.withdrawLayoutV0.decode(layoutBuffer);
      amount = data.withdrawal_amount;
    }

    if (amount) {
      let mint: PublicKey | string;

      if (tx.meta?.preTokenBalances?.length) {
        mint = friendly === true ? tx.meta.preTokenBalances[0].mint : new PublicKey(tx.meta.preTokenBalances[0].mint);
      } else if (tx.meta?.postTokenBalances?.length) {
        mint = friendly === true ? tx.meta.postTokenBalances[0].mint : new PublicKey(tx.meta.postTokenBalances[0].mint);
      } else {
        mint = 'Unknown Token';
      }

      streamActivity = Object.assign({
        signature,
        initializer: friendly === true ? signer?.pubkey.toBase58() : signer?.pubkey,
        blockTime,
        utcDate: new Date(blockTime).toUTCString(),
        action,
        amount: parseFloat(amount.toFixed(9)),
        mint,
      });
    }
  }

  return streamActivity;
};

const parseTreasuryData = (id: PublicKey, treasuryData: Buffer, friendly: boolean = true): TreasuryInfo => {
  const treasuryV1: TreasuryInfo = defaultTreasuryInfo;
  const decodedData = Layout.treasuryLayout.decode(treasuryData);

  const treasuryId = friendly === true ? id.toBase58() : id;
  const slot = parseFloat(u64.fromBuffer(decodedData.slot).toString());
  const treasurer = new PublicKey(decodedData.treasurer_address);
  const treasurerAddress = friendly === true ? treasurer.toBase58() : treasurer;
  const mint = new PublicKey(decodedData.mint_address);
  const mintAddress = friendly === true ? mint.toBase58() : mint;
  const streamsAmount = decodedData.streams_amount
    ? parseFloat(u64.fromBuffer(decodedData.streams_amount).toString())
    : 0;

  const createdOnUtc = decodedData.created_on_utc
    ? parseFloat(u64.fromBuffer(decodedData.created_on_utc).toString())
    : 0;

  const associatedToken = new PublicKey(decodedData.associated_token_address);
  const associatedTokenAddress = associatedToken.equals(PublicKey.default)
    ? ''
    : friendly === true
      ? associatedToken.toBase58()
      : associatedToken;

  const labelBuffer = Buffer.alloc(decodedData.label.length, decodedData.label).filter((elem, index) => elem !== 0);

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
      allocationLeft: decodedData.allocation_left,
      allocationAssigned: decodedData.allocation_assigned,
      streamsAmount,
      createdOnUtc: createdOnUtc === 0 ? '' : new Date(createdOnUtc),
      depletionRate: decodedData.depletion_rate,
      type: decodedData.type === 0 ? TreasuryType.Open : TreasuryType.Lock,
      autoClose: decodedData.auto_close ? true : false,
      upgradeRequired: false,
      version: 1,
    },
  );

  return treasuryV1;
};

export const getStream = async (
  connection: Connection,
  id: PublicKey,
  commitment?: any,
  friendly: boolean = true,
): Promise<StreamInfo | null> => {
  try {
    const accountInfo = await connection.getAccountInfo(id, commitment);
    if (
      accountInfo?.data !== undefined &&
      (accountInfo?.data.length === Layout.streamV0Layout.span || accountInfo?.data.length === Constants.STREAM_SIZE)
    ) {
      const slot = await connection.getSlot(commitment);
      const currentBlockTime = await connection.getBlockTime(slot);
      const parsedStreamData =
        accountInfo.data.length === Layout.streamV0Layout.span
          ? parseStreamV0Data(id, accountInfo.data, currentBlockTime as number, friendly)
          : parseStreamData(
            id,
            accountInfo.data.subarray(0, Layout.streamLayout.span),
            currentBlockTime as number,
            friendly,
          );

      // let terms = await getStreamTerms(
      //   accountInfo.owner,
      //   connection,
      //   stream.id as PublicKey,
      //   friendly
      // );

      // stream.isUpdatePending = terms !== undefined && terms.streamId === stream.id;
      // let signatures = await connection.getConfirmedSignaturesForAddress2(id, {}, "confirmed");

      // if (signatures.length > 0) {
      //   stream.transactionSignature = signatures[0].signature;
      //   stream.createdBlockTime = signatures[0].blockTime as number;
      // }

      return Object.assign({}, parsedStreamData) as StreamInfo;
    }
  } catch (error) {
    console.error(error);
    return null;
  }

  return null;
};

export const getStreamCached = (
  streamInfo: StreamInfo,
  currentBlocktime: number,
  friendly: boolean = true,
): StreamInfo => {
  const copyStreamV1Info = Object.assign({}, streamInfo);
  const startDate = new Date();
  startDate.setTime(
    copyStreamV1Info.startUtc !== undefined && typeof copyStreamV1Info.startUtc !== 'string'
      ? copyStreamV1Info.startUtc.getTime()
      : copyStreamV1Info.startUtc === undefined
        ? new Date().getTime()
        : new Date(Date.parse(copyStreamV1Info.startUtc as string)).getTime(),
  );

  const nowUtc = Date.parse(new Date().toUTCString());
  const isScheduled = startDate.getTime() > nowUtc;
  // refresh copy stream info
  const isStreaming = copyStreamV1Info.streamResumedBlockTime >= copyStreamV1Info.escrowVestedAmountSnapBlockTime ? 1 : 0;
  const lastTimeSnap = Math.max(
    copyStreamV1Info.streamResumedBlockTime,
    copyStreamV1Info.escrowVestedAmountSnapBlockTime,
  );

  const rate =
    copyStreamV1Info.rateIntervalInSeconds > 0
      ? (copyStreamV1Info.rateAmount / copyStreamV1Info.rateIntervalInSeconds) * isStreaming
      : 0;

  copyStreamV1Info.associatedToken =
    friendly === true &&
      copyStreamV1Info.associatedToken !== undefined &&
      typeof copyStreamV1Info.associatedToken !== 'string'
      ? copyStreamV1Info.associatedToken.toBase58()
      : copyStreamV1Info.associatedToken;

  if (isScheduled) {
    copyStreamV1Info.escrowVestedAmount = 0;
    copyStreamV1Info.escrowUnvestedAmount = copyStreamV1Info.allocationAssigned;
  } else {
    const elapsedTime = currentBlocktime - lastTimeSnap;
    copyStreamV1Info.escrowVestedAmount = copyStreamV1Info.escrowVestedAmountSnap + rate * elapsedTime;
    if (copyStreamV1Info.escrowVestedAmount > copyStreamV1Info.allocationLeft) {
      copyStreamV1Info.escrowVestedAmount = copyStreamV1Info.allocationLeft;
    }
    copyStreamV1Info.escrowUnvestedAmount = copyStreamV1Info.allocationLeft - copyStreamV1Info.escrowVestedAmount;
  }

  const escrowEstimatedDepletionDateUtc = new Date();
  escrowEstimatedDepletionDateUtc.setTime(Date.parse(copyStreamV1Info.escrowEstimatedDepletionUtc as string));

  if (escrowEstimatedDepletionDateUtc.getTime() === 0) {
    const depletionTimeInSeconds = rate ? copyStreamV1Info.allocationLeft / rate : 0;
    escrowEstimatedDepletionDateUtc.setTime(startDate.getTime() + depletionTimeInSeconds * 1000);
    copyStreamV1Info.escrowEstimatedDepletionUtc =
      friendly === true ? escrowEstimatedDepletionDateUtc.toUTCString() : escrowEstimatedDepletionDateUtc;
  }

  // const id =
  //   friendly === true && copyStreamV1Info.id !== undefined && typeof copyStreamV1Info.id !== 'string'
  //     ? copyStreamV1Info.id.toBase58()
  //     : copyStreamV1Info.id;

  if (startDate.getTime() > nowUtc) {
    copyStreamV1Info.state = STREAM_STATE.Schedule;
  } else if (copyStreamV1Info.escrowVestedAmount < copyStreamV1Info.allocationLeft && isStreaming) {
    copyStreamV1Info.state = STREAM_STATE.Running;
  } else {
    copyStreamV1Info.state = STREAM_STATE.Paused;
  }

  return copyStreamV1Info;
};

export async function listStreams(
  connection: Connection,
  programId: PublicKey,
  treasurer?: PublicKey | undefined,
  treasury?: PublicKey | undefined,
  beneficiary?: PublicKey | undefined,
  commitment?: Commitment | undefined,
  friendly: boolean = true,
): Promise<StreamInfo[]> {
  const streams: StreamInfo[] = [];
  const accounts: any[] = [];

  if (treasury) {
    const memcmpFilters = [
      {
        memcmp: {
          offset: 185,
          bytes: treasury.toBase58(),
        },
      },
    ];

    const configOrCommitment: GetProgramAccountsConfig = {
      commitment,
      filters: [{ dataSize: Layout.streamV0Layout.span }, ...memcmpFilters],
    };

    const accs = await connection.getProgramAccounts(programId, configOrCommitment);

    if (accs.length) {
      accounts.push(...accs);
    }

    const configOrCommitmentV1: GetProgramAccountsConfig = {
      commitment,
      filters: [{ dataSize: Constants.STREAM_SIZE }, ...memcmpFilters],
    };

    const accs2 = await connection.getProgramAccounts(programId, configOrCommitmentV1);

    if (accs2.length) {
      accounts.push(...accs2);
    }
  } else {
    if (treasurer) {
      const memcmpFilters = [
        {
          memcmp: {
            offset: 33,
            bytes: treasurer.toBase58(),
          },
        },
      ];

      const configOrCommitment: GetProgramAccountsConfig = {
        commitment,
        filters: [{ dataSize: Layout.streamV0Layout.span }, ...memcmpFilters],
      };

      const accs = await connection.getProgramAccounts(programId, configOrCommitment);

      if (accs.length) {
        accounts.push(...accs);
      }

      const configOrCommitmentV1: GetProgramAccountsConfig = {
        commitment,
        filters: [{ dataSize: Constants.STREAM_SIZE }, ...memcmpFilters],
      };

      const accs2 = await connection.getProgramAccounts(programId, configOrCommitmentV1);

      if (accs2.length) {
        accounts.push(...accs2);
      }
    }

    if (beneficiary) {
      const memcmpFilters = [
        {
          memcmp: {
            offset: 121,
            bytes: beneficiary.toBase58(),
          },
        },
      ];

      const configOrCommitment: GetProgramAccountsConfig = {
        commitment,
        filters: [{ dataSize: Layout.streamV0Layout.span }, ...memcmpFilters],
      };

      const accs = await connection.getProgramAccounts(programId, configOrCommitment);

      if (accs.length) {
        accounts.push(...accs);
      }

      const configOrCommitmentV1: GetProgramAccountsConfig = {
        commitment,
        filters: [{ dataSize: Constants.STREAM_SIZE }, ...memcmpFilters],
      };

      const accs2 = await connection.getProgramAccounts(programId, configOrCommitmentV1);

      if (accs2.length) {
        accounts.push(...accs2);
      }
    }
  }

  const slot = await connection.getSlot(commitment);
  const currentBlockTime = await connection.getBlockTime(slot);

  for (const item of accounts) {
    if (item.account.lamports > 0 && item.account.data !== undefined) {
      const parsedStreamData =
        item.account.data.length === Layout.streamV0Layout.span
          ? parseStreamV0Data(item.pubkey, item.account.data, currentBlockTime as number, friendly)
          : parseStreamData(item.pubkey, item.account.data, currentBlockTime as number, friendly);

      const info = Object.assign({}, parsedStreamData);

      // let signatures = await connection.getConfirmedSignaturesForAddress2(
      //   friendly ? new PublicKey(info.id as string) : (info.id as PublicKey),
      //   { limit: 1 },
      //   'confirmed'
      // );

      // if (signatures.length > 0) {
      //   info.createdBlockTime = signatures[0].blockTime as number;
      //   info.transactionSignature = signatures[0].signature;
      // }

      streams.push(info);
    }
  }

  return streams.sort((a, b) => b.createdBlockTime - a.createdBlockTime);
}

export async function listStreamsCached(streams: any[], friendly: boolean = true): Promise<StreamInfo[]> {
  const streamList: StreamInfo[] = [];
  const currentTime = Date.parse(new Date().toUTCString()) / 1000;

  for (const stream of streams) {
    streamList.push(
      getStreamCached(Object.assign({}, stream), currentTime, friendly),
    );
  }

  return streamList;
}

export async function getStreamContributors(
  connection: Connection,
  id: PublicKey,
  commitment?: any,
): Promise<PublicKey[]> {
  const contributors: PublicKey[] = [];
  const signatures = await connection.getSignaturesForAddress(id, {}, commitment);
  const txs = await connection.getParsedTransactions(
    signatures.map((s) => s.signature),
    commitment,
  );

  for (const tx of txs) {
    if (tx === null) continue;

    const lastIxIndex = tx.transaction.message.instructions.length - 1;
    const lastIx = tx.transaction.message.instructions[lastIxIndex] as PartiallyDecodedInstruction;

    if (lastIx.accounts.length) {
      contributors.push(lastIx.accounts[0]);
    }
  }

  return contributors;
}

export async function listStreamActivity(
  connection: Connection,
  streamId: PublicKey,
  commitment?: Finality | undefined,
  friendly: boolean = true,
): Promise<any[]> {
  const activity: any = [];
  const finality = commitment !== undefined ? commitment : 'finalized';
  const signatures = await connection.getSignaturesForAddress(streamId, {}, finality);
  const txs = await connection.getParsedTransactions(
    signatures.map((s) => s.signature),
    finality,
  );
  const streamAccountInfo = await connection.getAccountInfo(streamId, commitment || 'finalized');

  if (!streamAccountInfo) {
    throw Error('Stream not found');
  }

  if (txs?.length) {
    for (const tx of txs) {
      if (tx) {
        const item = Object.assign({}, parseActivityData(tx.transaction.signatures[0], tx, friendly));
        if (item?.signature) {
          activity.push(item);
        }
      }
    }
  }

  return activity.sort((a: { blockTime: number }, b: { blockTime: number }) => b.blockTime - a.blockTime);
}

export async function listTreasuries(
  programId: PublicKey,
  connection: Connection,
  treasurer?: PublicKey | undefined,
  commitment?: any,
  friendly: boolean = true,
): Promise<TreasuryInfo[]> {
  const treasuries: TreasuryInfo[] = [];
  const memcmpFilters: any[] = [];

  if (treasurer) {
    memcmpFilters.push({
      memcmp: {
        offset: 9,
        bytes: treasurer.toBase58(),
      },
    });
  }

  // Lookup treasuries
  const configOrCommitment: GetProgramAccountsConfig = {
    commitment: commitment || 'confirmed',
    filters: [{ dataSize: Constants.TREASURY_SIZE }, ...memcmpFilters],
  };

  const accounts = await connection.getProgramAccounts(programId, configOrCommitment);

  if (accounts.length) {
    for (const item of accounts) {
      if (item.account.data !== undefined) {
        const parsedTreasury = parseTreasuryData(item.pubkey, item.account.data, friendly);

        const info = Object.assign({}, parsedTreasury);

        if ((treasurer && treasurer.toBase58() === info.treasurerAddress) || !treasurer) {
          treasuries.push(info);
        }
      }
    }
  }

  return treasuries.sort((a, b) => b.slot - a.slot);
}

export async function getTreasury(
  connection: Connection,
  id: PublicKey,
  commitment?: any,
  friendly: boolean = true,
): Promise<TreasuryInfo | null> {
  try {
    const accountInfo = await connection.getAccountInfo(id, commitment);
    if (
      accountInfo &&
      accountInfo.data !== undefined &&
      (accountInfo.data.length === Layout.treasuryV0Layout.span || accountInfo.data.length === Constants.TREASURY_SIZE)
    ) {
      const parsedTreasury =
        accountInfo.data.length === Layout.treasuryV0Layout.span
          ? await parseTreasuryV0Data(connection, id, accountInfo.data, friendly)
          : parseTreasuryData(id, accountInfo.data.slice(0, Layout.treasuryLayout.span), friendly);

      if (!parsedTreasury.createdOnUtc) {
        const blockTime = (await connection.getBlockTime(parsedTreasury.slot)) || 0;
        parsedTreasury.createdOnUtc =
          blockTime === 0 ? '' : friendly === true ? new Date(blockTime * 1000).toString() : new Date(blockTime * 1000);
      }

      return Object.assign({}, parsedTreasury);
    }
  } catch (error) {
    console.error(error);
    return null;
  }

  return null;
}

export async function getTreasuryMints(
  connection: Connection,
  programId: PublicKey,
  treasury: PublicKey,
  commitment?: any,
): Promise<PublicKey[]> {
  const mints: PublicKey[] = [];
  const commitmentValue = commitment !== undefined ? (commitment as Finality) : 'confirmed';
  const context = await connection.getParsedTokenAccountsByOwner(treasury, { programId }, commitmentValue);

  for (const resp in context) {
    const tokenAccount = (resp as any).account;
    const parsedTokenAccount = await getTokenAccount(connection, tokenAccount.data);

    if (parsedTokenAccount !== null) {
      mints.push(parsedTokenAccount.mint);
    }
  }

  return mints;
}

export async function findATokenAddress(walletAddress: PublicKey, tokenMintAddress: PublicKey): Promise<PublicKey> {
  return (
    await PublicKey.findProgramAddress(
      [walletAddress.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), tokenMintAddress.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID,
    )
  )[0];
}

export const getMintAccount = async (connection: Connection, pubKey: PublicKey | string): Promise<MintInfo> => {
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
  mintInfo.mintAuthority = mintInfo.mintAuthorityOption === 0 ? null : new PublicKey(mintInfo.mintAuthority);
  mintInfo.supply = u64.fromBuffer(mintInfo.supply);
  mintInfo.isInitialized = mintInfo.isInitialized !== 0;
  mintInfo.freezeAuthority = mintInfo.freezeAuthorityOption === 0 ? null : new PublicKey(mintInfo.freezeAuthority);

  return mintInfo as MintInfo;
};

export const getTokenAccount = async (
  connection: Connection,
  pubKey: PublicKey | string,
): Promise<AccountInfo | null> => {
  const address = typeof pubKey === 'string' ? new PublicKey(pubKey) : pubKey;
  const info = await connection.getAccountInfo(address);

  if (info === null) {
    // throw new Error('Failed to find token account');
    return null;
  }

  return deserializeTokenAccount(info.data);
};

export const deserializeTokenAccount = (data: Buffer): AccountInfo => {
  if (data.length !== AccountLayout.span) {
    throw new Error('Not a valid Token');
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
    date.getUTCMilliseconds(),
  );

  return new Date(timestamp);
}

export const calculateActionFees = async (connection: Connection, action: MSP_ACTIONS): Promise<TransactionFees> => {
  let blockchainFee = 0;
  const txFees: TransactionFees = {
    blockchainFee: 0.0,
    mspFlatFee: 0.0,
    mspPercentFee: 0.0,
  };

  switch (action) {
    case MSP_ACTIONS.createStream: {
      blockchainFee = 15000000;
      txFees.mspFlatFee = 0.00001;
      break;
    }
    case MSP_ACTIONS.createStreamWithFunds: {
      blockchainFee = 20000000;
      txFees.mspFlatFee = 0.000035;
      break;
    }
    case MSP_ACTIONS.scheduleOneTimePayment: {
      blockchainFee = 15000000;
      txFees.mspFlatFee = 0.000035;
      break;
    }
    case MSP_ACTIONS.addFunds: {
      txFees.mspFlatFee = 0.000025;
      break;
    }
    case MSP_ACTIONS.withdraw: {
      blockchainFee = 5000000;
      txFees.mspPercentFee = 0.25;
      break;
    }
    case MSP_ACTIONS.closeStream: {
      txFees.mspFlatFee = 0.00001;
      txFees.mspPercentFee = 0.25;
      break;
    }
    case MSP_ACTIONS.wrap: {
      blockchainFee = 5000000;
      break;
    }
    case MSP_ACTIONS.swap: {
      blockchainFee = 7500000;
      txFees.mspPercentFee = 0.05;
      break;
    }
    default: {
      break;
    }
  }

  txFees.blockchainFee = blockchainFee / LAMPORTS_PER_SOL;

  return txFees;
};

export const wrapSol = async (connection: Connection, from: PublicKey, amount: number): Promise<Transaction> => {
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
    Token.createInitAccountInstruction(TOKEN_PROGRAM_ID, Constants.WSOL_TOKEN_MINT, newAccount.publicKey, from),
  );

  const aTokenKey = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    Constants.WSOL_TOKEN_MINT,
    from,
    true,
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
        from,
      ),
    );
  }

  ixs.push(
    Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      newAccount.publicKey,
      aTokenKey,
      from,
      [],
      amount * LAMPORTS_PER_SOL,
    ),
    Token.createCloseAccountInstruction(TOKEN_PROGRAM_ID, newAccount.publicKey, from, from, []),
  );

  const tx = new Transaction().add(...ixs);
  tx.feePayer = from;
  const hash = await connection.getRecentBlockhash(connection.commitment as Commitment);
  tx.recentBlockhash = hash.blockhash;
  tx.partialSign(newAccount);

  return tx;
};
