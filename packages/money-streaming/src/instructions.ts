/**
 * Solana
 */
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';

import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, TransactionInstruction } from '@solana/web3.js';

/**
 * MSP
 */
import * as Layout from './layout';
import { u64Number } from './u64n';
import { Buffer } from 'buffer';
import { AllocationType } from './types';
import { TreasuryType } from '.';
import { TextEncoder } from 'util';

export const createStreamInstruction = async (
  programId: PublicKey,
  treasurer: PublicKey,
  treasury: PublicKey,
  beneficiary: PublicKey,
  associatedToken: PublicKey,
  stream: PublicKey,
  mspOps: PublicKey,
  stream_name: string,
  allocationAssigned: number,
  allocationReserved: number,
  rateAmount: number,
  rateIntervalInSeconds: number,
  startUtcNow: number,
  rateCliffInSeconds?: number,
  cliffVestAmount?: number,
  cliffVestPercent?: number,
  autoPauseInSeconds?: number,
): Promise<TransactionInstruction> => {
  const keys = [
    { pubkey: treasurer, isSigner: true, isWritable: false },
    { pubkey: treasury, isSigner: false, isWritable: true },
    { pubkey: associatedToken, isSigner: false, isWritable: false },
    { pubkey: beneficiary, isSigner: false, isWritable: false },
    { pubkey: stream, isSigner: true, isWritable: true },
    { pubkey: mspOps, isSigner: false, isWritable: true },
    { pubkey: programId, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  const encodedUIntArray = new TextEncoder().encode(stream_name);
  let nameBuffer = Buffer.alloc(32).fill(encodedUIntArray, 0, encodedUIntArray.byteLength);

  const fundedNow = new Date();
  let data = Buffer.alloc(Layout.createStreamLayout.span);
  const decodedData = {
    tag: 0,
    stream_name: nameBuffer,
    rate_amount: rateAmount,
    rate_interval_in_seconds: new u64Number(rateIntervalInSeconds).toBuffer(), // default = MIN
    allocation_reserved: allocationReserved,
    allocation_assigned: allocationAssigned,
    funded_on_utc: new u64Number(fundedNow.getTime()).toBuffer(),
    start_utc: new u64Number(startUtcNow).toBuffer(),
    rate_cliff_in_seconds: new u64Number(rateCliffInSeconds || 0).toBuffer(),
    cliff_vest_amount: cliffVestAmount || 0,
    cliff_vest_percent: cliffVestPercent || 0,
    auto_pause_in_seconds: new u64Number(autoPauseInSeconds || 0).toBuffer(),
  };

  const encodeLength = Layout.createStreamLayout.encode(decodedData, data);
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
  stream: PublicKey | undefined,
  mspOps: PublicKey,
  amount: number,
  allocationType: AllocationType,
): Promise<TransactionInstruction> => {
  const streamAddress = !stream ? PublicKey.default : stream;
  const keys = [
    { pubkey: contributor, isSigner: true, isWritable: false },
    { pubkey: contributorToken, isSigner: false, isWritable: true },
    { pubkey: contributorTreasuryPoolToken, isSigner: false, isWritable: true },
    { pubkey: treasury, isSigner: false, isWritable: true },
    { pubkey: treasuryToken, isSigner: false, isWritable: true },
    { pubkey: associatedToken, isSigner: false, isWritable: false },
    { pubkey: treasuryPoolMint, isSigner: false, isWritable: true },
    { pubkey: streamAddress, isSigner: false, isWritable: true },
    { pubkey: mspOps, isSigner: false, isWritable: true },
    { pubkey: programId, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  const streamAddressBuffer = allocationType == 1 ? streamAddress.toBuffer() : PublicKey.default.toBuffer();

  let data = Buffer.alloc(Layout.addFundsLayout.span);
  {
    const decodedData = {
      tag: 1,
      amount,
      allocation_type: allocationType,
      allocation_stream_address: streamAddressBuffer,
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

export const withdrawInstruction = async (
  programId: PublicKey,
  beneficiary: PublicKey,
  beneficiaryToken: PublicKey,
  associatedToken: PublicKey,
  treasury: PublicKey,
  treasuryToken: PublicKey,
  stream: PublicKey,
  mspOps: PublicKey,
  mspOpsToken: PublicKey,
  amount: number,
): Promise<TransactionInstruction> => {
  const keys = [
    { pubkey: beneficiary, isSigner: true, isWritable: false },
    { pubkey: beneficiaryToken, isSigner: false, isWritable: true },
    { pubkey: associatedToken, isSigner: false, isWritable: true },
    { pubkey: treasury, isSigner: false, isWritable: true },
    { pubkey: treasuryToken, isSigner: false, isWritable: true },
    { pubkey: stream, isSigner: false, isWritable: true },
    { pubkey: mspOps, isSigner: false, isWritable: false },
    { pubkey: mspOpsToken, isSigner: false, isWritable: true },
    { pubkey: programId, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  let data = Buffer.alloc(Layout.withdrawLayout.span);
  const decodedData = { tag: 2, amount };
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
  treasury: PublicKey,
  associatedToken: PublicKey,
  stream: PublicKey,
  mspOps: PublicKey,
): Promise<TransactionInstruction> => {
  const keys = [
    { pubkey: initializer, isSigner: true, isWritable: false },
    { pubkey: treasury, isSigner: false, isWritable: true },
    { pubkey: associatedToken, isSigner: false, isWritable: false },
    { pubkey: stream, isSigner: false, isWritable: true },
    { pubkey: mspOps, isSigner: false, isWritable: true },
    { pubkey: programId, isSigner: false, isWritable: false },
  ];

  let data = Buffer.alloc(1);
  {
    const decodedData = { tag: 3 };
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
  treasury: PublicKey,
  associatedToken: PublicKey,
  stream: PublicKey,
  mspOps: PublicKey,
): Promise<TransactionInstruction> => {
  const keys = [
    { pubkey: initializer, isSigner: true, isWritable: false },
    { pubkey: treasury, isSigner: false, isWritable: true },
    { pubkey: associatedToken, isSigner: false, isWritable: false },
    { pubkey: stream, isSigner: false, isWritable: true },
    { pubkey: mspOps, isSigner: false, isWritable: true },
    { pubkey: programId, isSigner: false, isWritable: false },
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

export const closeStreamInstruction = async (
  programId: PublicKey,
  initializer: PublicKey,
  treasurer: PublicKey,
  treasurerToken: PublicKey,
  treasurerTreasuryPoolToken: PublicKey,
  beneficiary: PublicKey,
  beneficiaryToken: PublicKey,
  associatedToken: PublicKey,
  treasury: PublicKey,
  treasuryToken: PublicKey,
  treasuryPoolTokenMint: PublicKey,
  stream: PublicKey,
  mspOps: PublicKey,
  mspOpsToken: PublicKey,
  autoCloseTreasury: boolean = false,
): Promise<TransactionInstruction> => {
  const keys = [
    { pubkey: initializer, isSigner: true, isWritable: false },
    { pubkey: treasurer, isSigner: false, isWritable: true },
    { pubkey: treasurerToken, isSigner: false, isWritable: true },
    { pubkey: treasurerTreasuryPoolToken, isSigner: false, isWritable: true },
    { pubkey: beneficiary, isSigner: false, isWritable: false },
    { pubkey: beneficiaryToken, isSigner: false, isWritable: true },
    { pubkey: associatedToken, isSigner: false, isWritable: false },
    { pubkey: treasury, isSigner: false, isWritable: true },
    { pubkey: treasuryToken, isSigner: false, isWritable: true },
    { pubkey: treasuryPoolTokenMint, isSigner: false, isWritable: true },
    { pubkey: stream, isSigner: false, isWritable: true },
    { pubkey: mspOps, isSigner: false, isWritable: true },
    { pubkey: mspOpsToken, isSigner: false, isWritable: true },
    { pubkey: programId, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  let data = Buffer.alloc(Layout.closeStreamLayout.span);
  {
    const decodedData = {
      tag: 5,
      auto_close_treasury: autoCloseTreasury === true ? 1 : 0,
    };
    const encodeLength = Layout.closeStreamLayout.encode(decodedData, data);
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
  treasury: PublicKey,
  treasuryPoolMint: PublicKey,
  mspOps: PublicKey,
  label: string,
  type: TreasuryType,
  slot: number,
  autoClose: boolean = false,
): Promise<TransactionInstruction> => {
  const keys = [
    { pubkey: treasurer, isSigner: true, isWritable: false },
    { pubkey: treasury, isSigner: false, isWritable: true },
    { pubkey: treasuryPoolMint, isSigner: false, isWritable: true },
    { pubkey: mspOps, isSigner: false, isWritable: true },
    { pubkey: programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  const encodedUIntArray = new TextEncoder().encode(label.trim());
  let labelBuffer = Buffer.alloc(32).fill(encodedUIntArray, 0, encodedUIntArray.byteLength);

  let data = Buffer.alloc(Layout.createTreasuryLayout.span);
  const decodedData = {
    tag: 6,
    slot: new u64Number(slot).toBuffer(),
    label: labelBuffer,
    treasury_type: parseInt(type.toString()),
    auto_close: autoClose === false ? 0 : 1,
  };

  const encodeLength = Layout.createTreasuryLayout.encode(decodedData, data);
  data = data.slice(0, encodeLength);

  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
};

export const closeTreasuryInstruction = async (
  programId: PublicKey,
  treasurer: PublicKey,
  treasurerToken: PublicKey,
  treasurerTreasuryPoolToken: PublicKey,
  associatedToken: PublicKey,
  treasury: PublicKey,
  treasuryToken: PublicKey,
  treasuryPoolTokenMint: PublicKey,
  mspOps: PublicKey,
  mspOpsToken: PublicKey,
): Promise<TransactionInstruction> => {
  const keys = [
    { pubkey: treasurer, isSigner: true, isWritable: true },
    { pubkey: treasurerToken, isSigner: false, isWritable: true },
    { pubkey: treasurerTreasuryPoolToken, isSigner: false, isWritable: true },
    { pubkey: associatedToken, isSigner: false, isWritable: false },
    { pubkey: treasury, isSigner: false, isWritable: true },
    { pubkey: treasuryToken, isSigner: false, isWritable: true },
    { pubkey: treasuryPoolTokenMint, isSigner: false, isWritable: true },
    { pubkey: mspOps, isSigner: false, isWritable: true },
    { pubkey: mspOpsToken, isSigner: false, isWritable: true },
    { pubkey: programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  let data = Buffer.alloc(Layout.closeTreasuryLayout.span);
  {
    const decodedData = { tag: 7 };
    const encodeLength = Layout.closeTreasuryLayout.encode(decodedData, data);
    data = data.slice(0, encodeLength);
  }

  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
};

export const refreshTreasuryBalanceInstruction = async (
  programId: PublicKey,
  treasurer: PublicKey,
  associatedToken: PublicKey,
  treasury: PublicKey,
  treasuryToken: PublicKey,
  mspOps: PublicKey,
): Promise<TransactionInstruction> => {
  const keys = [
    { pubkey: treasurer, isSigner: true, isWritable: false },
    { pubkey: associatedToken, isSigner: false, isWritable: false },
    { pubkey: treasury, isSigner: false, isWritable: true },
    { pubkey: treasuryToken, isSigner: false, isWritable: false },
    { pubkey: mspOps, isSigner: false, isWritable: false },
  ];

  let data = Buffer.alloc(1);
  {
    const decodedData = { tag: 8 };
    const encodeLength = Layout.refreshTreasuryBalanceLayout.encode(decodedData, data);
    data = data.slice(0, encodeLength);
  }

  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
};

export const createStream2Instruction = async (
  programId: PublicKey,
  treasurer: PublicKey,
  treasury: PublicKey,
  beneficiary: PublicKey,
  associatedToken: PublicKey,
  stream: PublicKey,
  mspOps: PublicKey,
  stream_name: string,
  allocationAssigned: number,
  allocationReserved: number,
  rateAmount: number,
  rateIntervalInSeconds: number,
  startUtcNow: number,
  rateCliffInSeconds?: number,
  cliffVestAmount?: number,
  cliffVestPercent?: number,
  autoPauseInSeconds?: number,
): Promise<TransactionInstruction> => {
  const keys = [
    { pubkey: treasurer, isSigner: true, isWritable: false },
    { pubkey: beneficiary, isSigner: true, isWritable: false },
    { pubkey: treasury, isSigner: false, isWritable: true },
    { pubkey: associatedToken, isSigner: false, isWritable: false },
    { pubkey: stream, isSigner: true, isWritable: true },
    { pubkey: mspOps, isSigner: false, isWritable: true },
    { pubkey: programId, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  const encodedUIntArray = new TextEncoder().encode(stream_name);
  let nameBuffer = Buffer.alloc(32).fill(encodedUIntArray, 0, encodedUIntArray.byteLength);

  const fundedNow = new Date();
  let data = Buffer.alloc(Layout.createStreamLayout.span);
  const decodedData = {
    tag: 9,
    stream_name: nameBuffer,
    rate_amount: rateAmount,
    rate_interval_in_seconds: new u64Number(rateIntervalInSeconds).toBuffer(), // default = MIN
    allocation_reserved: allocationReserved,
    allocation_assigned: allocationAssigned,
    funded_on_utc: new u64Number(fundedNow.getTime()).toBuffer(),
    start_utc: new u64Number(startUtcNow).toBuffer(),
    rate_cliff_in_seconds: new u64Number(rateCliffInSeconds || 0).toBuffer(),
    cliff_vest_amount: cliffVestAmount || 0,
    cliff_vest_percent: cliffVestPercent || 0,
    auto_pause_in_seconds: new u64Number(autoPauseInSeconds || 0).toBuffer(),
  };

  const encodeLength = Layout.createStreamLayout.encode(decodedData, data);
  data = data.slice(0, encodeLength);

  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
};
