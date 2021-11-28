/**
 * Solana
 */
 import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID

} from "@solana/spl-token";

import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction

} from "@solana/web3.js";

/**
 * MSP
 */
import * as Utils from "./utils";
import * as Layout from "./layout";
import { u64Number } from "./u64n";
import { Buffer } from "buffer";
import { StreamInfo, StreamTermsInfo } from "./types";

export const createStreamInstruction = async (
  programId: PublicKey,
  treasurer: PublicKey,
  treasury: PublicKey,
  beneficiary: PublicKey,
  associatedToken: PublicKey,
  stream: PublicKey,
  mspOps: PublicKey,
  stream_name: string,
  rateAmount: number,
  rateIntervalInSeconds: number,
  allocationReserved: number,
  allocationCommitted: number,
  startUtcNow: number,
  rateCliffInSeconds?: number,
  cliffVestAmount?: number,
  cliffVestPercent?: number,
  autoPauseInSeconds?: number

): Promise<TransactionInstruction> => {

  const keys = [
    { pubkey: treasurer, isSigner: true, isWritable: false },
    { pubkey: treasury, isSigner: false, isWritable: true },
    { pubkey: associatedToken, isSigner: false, isWritable: false },
    { pubkey: stream, isSigner: true, isWritable: true },
    { pubkey: mspOps, isSigner: false, isWritable: true },
    { pubkey: programId, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  const encodedUIntArray = new TextEncoder().encode(stream_name);
  let nameBuffer = Buffer
    .alloc(32)
    .fill(encodedUIntArray, 0, encodedUIntArray.byteLength);

  const fundedNow = new Date();
  let data = Buffer.alloc(Layout.createStreamV1Layout.span);
  const decodedData = {
    tag: 11,
    beneficiary_address: beneficiary.toBuffer(),
    stream_name: nameBuffer,
    rate_amount: rateAmount,
    rate_interval_in_seconds: new u64Number(rateIntervalInSeconds).toBuffer(), // default = MIN
    allocation_reserved: allocationReserved,
    allocation_committed: allocationCommitted,
    funded_on_utc: new u64Number(fundedNow.getTime()).toBuffer(),
    start_utc: new u64Number(startUtcNow).toBuffer(),
    rate_cliff_in_seconds: new u64Number(rateCliffInSeconds || 0).toBuffer(),
    cliff_vest_amount: cliffVestAmount || 0,
    cliff_vest_percent: cliffVestPercent || 0,
    auto_pause_in_seconds: new u64Number(autoPauseInSeconds || 0).toBuffer(),
  };

  const encodeLength = Layout.createStreamV1Layout.encode(decodedData, data);
  data = data.slice(0, encodeLength);

  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
};

export const addFundsInstruction = async (
  programId: PublicKey,
  contributor: PublicKey,
  contributorToken: PublicKey,
  contributorTreasuryPoolToken: PublicKey,
  treasury: PublicKey,
  treasuryToken: PublicKey,
  associatedToken: PublicKey,  
  treasuryPoolMint: PublicKey,
  mspOps: PublicKey,
  amount: number,
  resume?: boolean

): Promise<TransactionInstruction> => {

  const keys = [
    { pubkey: contributor, isSigner: true, isWritable: false },
    { pubkey: contributorToken, isSigner: false, isWritable: true },
    { pubkey: contributorTreasuryPoolToken, isSigner: false, isWritable: true },
    { pubkey: treasury, isSigner: false, isWritable: true },
    { pubkey: treasuryToken, isSigner: false, isWritable: true },
    { pubkey: associatedToken, isSigner: false, isWritable: false },
    { pubkey: treasuryPoolMint, isSigner: false, isWritable: true },
    { pubkey: mspOps, isSigner: false, isWritable: true },
    { pubkey: programId, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  let data = Buffer.alloc(Layout.addFundsLayout.span);
  {
    let fundedOnUtcDate = Utils.convertLocalDateToUTCIgnoringTimezone(new Date());

    const decodedData = {
      tag: 1,
      amount,
      funded_on_utc: fundedOnUtcDate.getTime(),
      resume: resume && resume === true ? resume : false,
    };

    const encodeLength = Layout.addFundsLayout.encode(decodedData, data);
    data = data.slice(0, encodeLength);
  }

  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
};

export const recoverFundsInstruction = async (
  programId: PublicKey,
  contributor: PublicKey,
  contributorToken: PublicKey,
  contributorTreasuryPoolTokenMint: PublicKey,
  associatedToken: PublicKey,
  treasury: PublicKey,
  treasuryToken: PublicKey,
  treasuryPoolMint: PublicKey,
  mspOps: PublicKey,
  mspOpsToken: PublicKey,
  amount: number

): Promise<TransactionInstruction> => {

  const keys = [
    { pubkey: contributor, isSigner: true, isWritable: false },
    { pubkey: contributorToken, isSigner: false, isWritable: true },
    { pubkey: contributorTreasuryPoolTokenMint, isSigner: false, isWritable: true },
    { pubkey: associatedToken, isSigner: false, isWritable: false },
    { pubkey: treasury, isSigner: false, isWritable: true },
    { pubkey: treasuryToken, isSigner: false, isWritable: true },
    { pubkey: treasuryPoolMint, isSigner: false, isWritable: true },
    { pubkey: mspOps, isSigner: false, isWritable: false },
    { pubkey: mspOpsToken, isSigner: false, isWritable: true },
    { pubkey: programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  let data = Buffer.alloc(Layout.withdrawLayout.span);
  const decodedData = { tag: 2, amount }
  const encodeLength = Layout.withdrawLayout.encode(decodedData, data);
  data = data.slice(0, encodeLength);

  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
};

export const withdrawInstruction = async (
  programId: PublicKey,
  beneficiary: PublicKey,
  beneficiaryToken: PublicKey,
  beneficiaryTokenMint: PublicKey,
  treasury: PublicKey,
  treasuryToken: PublicKey,
  stream: PublicKey,
  mspOpsToken: PublicKey,
  amount: number

): Promise<TransactionInstruction> => {

  const keys = [
    { pubkey: beneficiary, isSigner: true, isWritable: false },
    { pubkey: beneficiaryToken, isSigner: false, isWritable: true },
    { pubkey: beneficiaryTokenMint, isSigner: false, isWritable: true },
    { pubkey: treasury, isSigner: false, isWritable: true },
    { pubkey: treasuryToken, isSigner: false, isWritable: true },
    { pubkey: stream, isSigner: false, isWritable: true },
    { pubkey: mspOpsToken, isSigner: false, isWritable: true },
    { pubkey: programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  let data = Buffer.alloc(Layout.withdrawLayout.span);
  const decodedData = { tag: 3, amount };
  const encodeLength = Layout.withdrawLayout.encode(decodedData, data);
  data = data.slice(0, encodeLength);

  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
};

export const pauseStreamInstruction = async (
  programId: PublicKey,
  initializer: PublicKey,
  stream: PublicKey,
  mspOps: PublicKey

): Promise<TransactionInstruction> => {

  const keys = [
    { pubkey: initializer, isSigner: true, isWritable: false },
    { pubkey: stream, isSigner: false, isWritable: true },
    { pubkey: mspOps, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  let data = Buffer.alloc(1);
  {
    const decodedData = { tag: 4 };
    const encodeLength = Layout.pauseOrResumeLayout.encode(decodedData, data);
    data = data.slice(0, encodeLength);
  }

  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
};

export const resumeStreamInstruction = async (
  programId: PublicKey,
  initializer: PublicKey,
  stream: PublicKey,
  mspOps: PublicKey

): Promise<TransactionInstruction> => {

  const keys = [
    { pubkey: initializer, isSigner: true, isWritable: false },
    { pubkey: stream, isSigner: false, isWritable: true },
    { pubkey: mspOps, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  let data = Buffer.alloc(1);
  {
    const decodedData = { tag: 5 };
    const encodeLength = Layout.pauseOrResumeLayout.encode(decodedData, data);
    data = data.slice(0, encodeLength);
  }

  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
};

export const closeStreamInstruction = async (
  programId: PublicKey,
  initializer: PublicKey,
  treasurerToken: PublicKey,
  beneficiaryToken: PublicKey,
  associatedToken: PublicKey,
  treasury: PublicKey,
  treasuryToken: PublicKey,
  stream: PublicKey,
  mspOps: PublicKey,
  mspOpsToken: PublicKey

): Promise<TransactionInstruction> => {

  const keys = [
    { pubkey: initializer, isSigner: true, isWritable: false },
    { pubkey: treasurerToken, isSigner: false, isWritable: true },
    { pubkey: beneficiaryToken, isSigner: false, isWritable: true },
    { pubkey: associatedToken, isSigner: false, isWritable: false },
    { pubkey: treasury, isSigner: false, isWritable: false },
    { pubkey: treasuryToken, isSigner: false, isWritable: true },
    { pubkey: stream, isSigner: false, isWritable: true },
    { pubkey: mspOps, isSigner: false, isWritable: true },
    { pubkey: mspOpsToken, isSigner: false, isWritable: true },
    { pubkey: programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  let data = Buffer.alloc(1);
  {
    const decodedData = { tag: 8 };
    const encodeLength = Layout.closeStreamLayout.encode(decodedData, data);
    data = data.slice(0, encodeLength);
  }

  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
};

export const proposeUpdateInstruction = async (
  programId: PublicKey,
  streamInfo: StreamInfo,
  streamTerms: PublicKey,
  initializer: PublicKey,
  counterparty: PublicKey,
  mspOps: PublicKey,
  streamName?: string,
  associatedToken?: PublicKey,
  rateAmount?: number,
  rateIntervalInSeconds?: number,
  rateCliffInSeconds?: number,
  cliffVestAmount?: number,
  cliffVestPercent?: number,
  autoPauseInSeconds?: number

): Promise<TransactionInstruction> => {

  const keys = [
    { pubkey: initializer, isSigner: true, isWritable: false },
    { pubkey: streamTerms, isSigner: false, isWritable: true },
    { pubkey: counterparty, isSigner: false, isWritable: false },
    { pubkey: streamInfo.id as PublicKey, isSigner: false, isWritable: true },
    { pubkey: mspOps, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  let data = Buffer.alloc(Layout.proposeUpdateLayout.span);
  {
    const encodedUIntArray = new TextEncoder().encode(streamName);
    let nameBuffer = Buffer
      .alloc(32)
      .fill(encodedUIntArray, 0, encodedUIntArray.byteLength);

    const decodedData = {
      tag: 6,
      proposed_by: initializer,
      stream_name: nameBuffer,
      treasurer_address: streamInfo.treasurerAddress as PublicKey,
      beneficiary_address: streamInfo.beneficiaryAddress as PublicKey,
      associated_token_address: associatedToken as PublicKey,
      rate_amount: rateAmount as number,
      rate_interval_in_seconds: new u64Number(rateIntervalInSeconds as number).toBuffer(),
      rate_cliff_in_seconds: new u64Number(rateCliffInSeconds as number).toBuffer(),
      cliff_vest_amount: cliffVestAmount as number,
      cliff_vest_percent: cliffVestPercent as number,
      auto_pause_in_seconds: new u64Number(autoPauseInSeconds as number).toBuffer(),
    };

    const encodeLength = Layout.proposeUpdateLayout.encode(decodedData, data);
    data = data.slice(0, encodeLength);
  }

  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
};

export const answerUpdateInstruction = async (
  programId: PublicKey,
  streamTerms: StreamTermsInfo,
  initializer: PublicKey,
  counterparty: PublicKey,
  mspOps: PublicKey,
  approve: true

): Promise<TransactionInstruction> => {

  const keys = [
    { pubkey: initializer, isSigner: true, isWritable: false },
    { pubkey: streamTerms.id as PublicKey, isSigner: false, isWritable: true },
    { pubkey: counterparty, isSigner: false, isWritable: false },
    {
      pubkey: streamTerms.streamId as PublicKey,
      isSigner: false,
      isWritable: true,
    },
    { pubkey: mspOps, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  let data = Buffer.alloc(Layout.answerUpdateLayout.span);
  {
    const decodedData = {
      tag: 7,
      approve: approve === true ? 1 : 0,
    };

    const encodeLength = Layout.proposeUpdateLayout.encode(decodedData, data);
    data = data.slice(0, encodeLength);
  }

  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
};

export const createTreasuryInstruction = async (
  programId: PublicKey,
  treasurer: PublicKey,
  treasurerTreasuryPoolToken: PublicKey,
  treasury: PublicKey,
  treasuryPoolMint: PublicKey,
  mspOps: PublicKey,
  label: string,
  slot: number

): Promise<TransactionInstruction> => {
    
  const keys = [
    { pubkey: treasurer, isSigner: true, isWritable: false },
    { pubkey: treasurerTreasuryPoolToken, isSigner: false, isWritable: true },
    { pubkey: treasury, isSigner: false, isWritable: true },
    { pubkey: treasuryPoolMint, isSigner: false, isWritable: true },
    { pubkey: mspOps, isSigner: false, isWritable: true },
    { pubkey: programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  const encodedUIntArray = new TextEncoder().encode(label.trim());
  let labelBuffer = Buffer
    .alloc(32)
    .fill(encodedUIntArray, 0, encodedUIntArray.byteLength);

  let data = Buffer.alloc(Layout.createTreasuryLayout.span);
  const decodedData = {
    tag: 9,
    slot: new u64Number(slot).toBuffer(),
    label: labelBuffer
  };

  const encodeLength = Layout.createTreasuryLayout.encode(decodedData, data);
  data = data.slice(0, encodeLength);

  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
};
