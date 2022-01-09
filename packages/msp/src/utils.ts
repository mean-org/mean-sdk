import { Commitment, Connection, PublicKey, ConfirmOptions, GetProgramAccountsConfig, Finality, ParsedConfirmedTransaction, PartiallyDecodedInstruction, GetProgramAccountsFilter, ParsedInstruction, LAMPORTS_PER_SOL, ParsedInnerInstruction, Transaction } from "@solana/web3.js";
import { Idl, Program, Provider } from "@project-serum/anchor";
/**
 * MSP
 */
import { Constants } from "./constants";
import { StreamActivity, Stream, MSP_ACTIONS, TransactionFees } from "./types";
import { STREAM_STATUS, Treasury, TreasuryType } from "./types";
import MSP_IDL from './idl';
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { Wallet } from "@project-serum/anchor/dist/cjs/provider";

String.prototype.toPublicKey = function (): PublicKey {
  return new PublicKey(this.toString());
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

export const createProgram = (
  connection: Connection,
  walletAddress: PublicKey

): Program<Idl> => {
  
  const opts: ConfirmOptions = {
    preflightCommitment: "recent",
    commitment: "recent",
  };

  let wallet: Wallet = {
    publicKey: !isNotValidWallet(walletAddress) ? new PublicKey(walletAddress.toBase58()) : walletAddress,
    signAllTransactions: async (txs) => txs, 
    signTransaction: async (tx) => tx
  };

  const provider = new Provider(connection, wallet, opts);
  
  return new Program(MSP_IDL, Constants.MSP, provider);
}

export const getStream = async (
  program: Program<Idl>,
  address: PublicKey,
  commitment: Commitment = "finalized",
  friendly: boolean = true

): Promise<Stream> => {
  
  let stream = await program.account.stream.fetch(address);
  console.log(stream);
  let associatedTokenInfo = await program.provider.connection.getAccountInfo(
    stream.beneficiaryAssociatedToken, 
    commitment
  );

  if (!associatedTokenInfo) {
    throw Error("Associated token doesn't exists");
  }

  let streamInfo = parseStreamData(stream, address, friendly);

  return streamInfo;
}

export const getStreamCached = async (
  streamInfo: Stream,
  currentBlockTime: number,
  friendly: boolean = true

): Promise<Stream> => {

  streamInfo.estimatedDepletionDate = friendly 
    ? getStreamEstDepletionDate(streamInfo.data).toString() 
    : getStreamEstDepletionDate(streamInfo.data);

  let fundsLeftInStream = getFundsLeftInStream(streamInfo.data);
  let fundsSentToBeneficiary = getFundsSentToBeneficiary(streamInfo.data);
  let remainingAllocationAmount = getStreamRemainingAllocation(streamInfo.data);
  let withdrawableAmount = getStreamWithdrawableAmount(streamInfo.data);
  let status = getStreamStatus(streamInfo.data);

  streamInfo.fundsLeftInStream = fundsLeftInStream;
  streamInfo.fundsSentToBeneficiary = fundsSentToBeneficiary;
  streamInfo.remainingAllocationAmount = remainingAllocationAmount;
  streamInfo.withdrawableAmount = withdrawableAmount;
  streamInfo.status = status;
  streamInfo.lastRetrievedBlockTime = currentBlockTime;

  return streamInfo;
}

export const listStreams = async (
  program: Program<Idl>,
  treasurer?: PublicKey | undefined,
  treasury?: PublicKey | undefined,
  beneficiary?: PublicKey | undefined,
  friendly: boolean = true

): Promise<Stream[]> => {

  let streamInfoList: Stream[] = [];
  let accounts = await getFilteredStreamAccounts(program, treasurer, treasury, beneficiary);

  for (let item of accounts) {
    if (item.account !== undefined) {
      let parsedStream = parseStreamData(item.account, item.publicKey, friendly);              
      let info = Object.assign({}, parsedStream);
      let signatures = await program.provider.connection.getConfirmedSignaturesForAddress2(
        friendly ? new PublicKey(info.id as string) : (info.id as PublicKey),
        { limit: 1 }, 
        'confirmed'
      );

      if (signatures.length > 0) {
        info.createdBlockTime = signatures[0].blockTime as number;
        info.transactionSignature = signatures[0].signature;
      }

      streamInfoList.push(info);
    }
  }

  let orderedStreams = streamInfoList.sort((a, b) => b.createdBlockTime - a.createdBlockTime);

  return orderedStreams;
}

export const listStreamsCached = async (
  streamInfoList: Stream[],
  friendly: boolean = true

): Promise<Stream[]> => {

  let streamList: Stream[] = [];
  const currentTime = Date.parse(new Date().toUTCString()) / 1000;

  for (let streamInfo of streamInfoList) {
    streamList.push(
      await getStreamCached(streamInfo, currentTime, friendly)
    );
  }  

  return streamList;
}

export const listStreamActivity = async (
  program: Program<Idl>,
  address: PublicKey,
  commitment?: Finality | undefined,
  friendly: boolean = true

): Promise<StreamActivity[]> => {

  let activity: any = [];
  let finality = commitment !== undefined ? commitment : "finalized";
  let signatures = await program.provider.connection.getConfirmedSignaturesForAddress2(address, {}, finality);
  let txs = await program.provider.connection.getParsedConfirmedTransactions(signatures.map((s: any) => s.signature), finality);
  const streamAccountInfo = await program.provider.connection.getAccountInfo(address, commitment || "finalized");

  if (!streamAccountInfo) {
    throw Error("Stream not found");
  }

  if (txs && txs.length) {
    txs.forEach((tx: any) => {
      if (tx) {
        let item = Object.assign({}, parseStreamActivityData(program, tx.transaction.signatures[0], tx, friendly));
        if (item && item.signature) {
          activity.push(item);
        }
      }
    });
  }

  return activity.sort(
    (a: { blockTime: number }, b: { blockTime: number }) => b.blockTime - a.blockTime
  );
}

export const getTreasury = async (
  program: Program<Idl>,
  address: PublicKey,
  friendly: boolean = true

): Promise<Treasury> => {

  let treasury = await program.account.treasury.fetch(address);
  let parsedTreasury = parseTreasuryData(treasury, address, friendly); 

  if (!parsedTreasury.createdOnUtc) {
    try {
      const blockTime = await program.provider.connection.getBlockTime(parsedTreasury.slot) || 0;
      parsedTreasury.createdOnUtc = blockTime === 0 
        ? "" 
        : friendly === true 
        ? new Date(blockTime * 1000).toString()
        : new Date(blockTime * 1000);
        
    } catch {}
  }

  return parsedTreasury;
}

export const listTreasuries = async (
  program: Program<Idl>,
  treasurer?: PublicKey | undefined,
  friendly: boolean = true

): Promise<Treasury[]> => {

  let treasuries: Treasury[] = [];
  let memcmpFilters: any[] = [];

  if (treasurer) {
    memcmpFilters.push({ memcmp: { offset: 8 + 43, bytes: treasurer.toBase58() }});
  }

  const accounts = await program.account.treasury.all(memcmpFilters);

  if (accounts.length) {
    for (let item of accounts) {
      if (item.account !== undefined) {
        let parsedTreasury = parseTreasuryData(item.account, item.publicKey, friendly);
        let info = Object.assign({}, parsedTreasury);

        if ((treasurer && treasurer.toBase58() === info.treasurer) || !treasurer) {
          treasuries.push(info);
        }
      }
    }
  }

  const sortedTreasuries = treasuries.sort((a, b) => b.slot - a.slot);

  return sortedTreasuries;
}

export const calculateActionFees = async (
  connection: Connection,
  action: MSP_ACTIONS

): Promise<TransactionFees> => {

  let recentBlockhash = await connection.getRecentBlockhash(connection.commitment as Commitment),
    blockchainFee = 0,
    txFees: TransactionFees = {
      blockchainFee: 0.0,
      mspFlatFee: 0.0,
      mspPercentFee: 0.0,
    };

  switch (action) {
    case MSP_ACTIONS.createTreasury: {
      blockchainFee = 15000000;
      txFees.mspFlatFee = 0.00001;
      break;
    }
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
      blockchainFee = 15000000
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
    case MSP_ACTIONS.closeTreasury: {
      txFees.mspFlatFee = 0.00001;
      break;
    }
    default: {
      break;
    }
  }

  txFees.blockchainFee = blockchainFee / LAMPORTS_PER_SOL;

  return txFees;
};

const getFilteredStreamAccounts = async (
  program: Program<Idl>,
  treasurer?: PublicKey | undefined,
  treasury?: PublicKey | undefined,
  beneficiary?: PublicKey | undefined

) => {

  let accounts: any[] = [];

  if (treasury) {

    let memcmpFilters = [{ memcmp: { offset: 8 + 138, bytes: treasury.toBase58() }}];
    const accs = await program.account.stream.all(memcmpFilters);
  
    if (accs.length) {
      accounts.push(...accs);
    }

  } else {

    if (treasurer) {

      let memcmpFilters = [{ memcmp: { offset: 8 + 34, bytes: treasurer.toBase58() }}];  
      const accs = await program.account.stream.all(memcmpFilters);
    
      if (accs.length) {
        accounts.push(...accs);
      }
    }
  
    if (beneficiary) {
  
      let memcmpFilters = [{ memcmp: { offset: 8 + 106, bytes: beneficiary.toBase58() }}];
      const accs = await program.account.stream.all(memcmpFilters);
    
      if (accs.length) {
        accounts.push(...accs);
      }
    }
  }

  return accounts;
}

const parseStreamData = (
  stream: any,
  address: PublicKey,
  friendly: boolean = true

) => {

  let nameBuffer = Buffer.from(stream.name);

  return {
    id: friendly ? address.toBase58() : address,
    version: stream.version,
    initialized: stream.initialized === 1 ? true : false,
    name: new TextDecoder().decode(nameBuffer),
    startUtc: !friendly ? new Date(stream.startUtc.toNumber()).toString() : new Date(stream.startUtc.toNumber()),
    treasurer: friendly ? stream.treasurerAddress.toBase58() : stream.treasurerAddress,
    treasury: friendly ? stream.treasuryAddress.toBase58() : stream.treasuryAddress,
    beneficiary: friendly ? stream.beneficiaryAddress.toBase58() : stream.beneficiaryAddress,
    associatedToken: friendly ? stream.beneficiaryAssociatedToken.toBase58() : stream.beneficiaryAssociatedToken,
    cliffVestAmount: stream.cliffVestAmountUnits.toNumber(),
    cliffVestPercent: stream.cliffVestPercent.toNumber() / 10_000,
    allocationAssigned: stream.allocationAssignedUnits.toNumber(),
    allocationReserved: stream.allocationReservedUnits.toNumber(),
    estimatedDepletionDate: getStreamEstDepletionDate(stream),
    rateAmount: stream.rateAmountUnits.toNumber(),
    rateIntervalInSeconds: stream.rateIntervalInSeconds.toNumber(),
    totalWithdrawalsAmount: stream.totalWithdrawalsUnits.toNumber(),
    fundsLeftInStream: getFundsLeftInStream(stream),
    fundsSentToBeneficiary: getFundsSentToBeneficiary(stream),
    remainingAllocationAmount: getStreamRemainingAllocation(stream),
    withdrawableAmount: getStreamWithdrawableAmount(stream),
    streamUnitsPerSecond: getStreamUnitsPerSecond(stream),
    status: getStreamStatus(stream),
    lastRetrievedBlockTime: new Date().getTime() / 1_000,
    transactionSignature: '',
    createdBlockTime: 0,
    upgradeRequired: false,
    data: stream
    
  } as Stream;
}

const parseStreamActivityData = (
  program: Program<Idl>,
  signature: string,
  tx: ParsedConfirmedTransaction,
  friendly: boolean = true

): StreamActivity => {

  let streamActivity: StreamActivity = defaultStreamActivity;
  let signer = tx.transaction.message.accountKeys.filter((a) => a.signer)[0];
  if (!tx.meta || !tx.meta.innerInstructions || !tx.meta.innerInstructions.length) {
    return streamActivity;
  }
  let instruction = tx.transaction.message.instructions.filter((ix: any) => {
    let buffer = bs58.decode(ix.data);
    let info = program.coder.instruction.decode(buffer);
    return info && (info.name === 'addFunds' || info.name === 'withdraw');
  })[0] as PartiallyDecodedInstruction;

  if (!instruction) {
    return streamActivity;
  }

  let buffer = bs58.decode(instruction.data);
  let info = program.coder.instruction.decode(buffer);
  
  if (info && (info.name === 'addFunds' || info.name === 'withdraw')) {

    let blockTime = (tx.blockTime as number) * 1000; // mult by 1000 to add milliseconds
    let action = info.name === 'addFunds' ? "deposited" : "withdrew";
    let data = info.data as any;
    let amount = data.amount.toNumber();
 
    if (amount) {
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

      streamActivity = Object.assign(
        {
          signature,
          initializer: friendly === true ? signer.pubkey.toBase58() : signer.pubkey,
          blockTime,
          utcDate: new Date(blockTime).toUTCString(),
          action,
          amount: parseFloat(amount.toFixed(9)),
          mint,
        }
      );
    }
  }

  return streamActivity;
};

const parseTreasuryData = (
  treasury: any,
  address: PublicKey,
  friendly: boolean = true

) => {

  const nameBuffer = Buffer.from(treasury.name);

  const treasuryAssocatedTokenMint = friendly 
    ? (treasury.associatedTokenAddress as PublicKey).equals(PublicKey.default) ? "" : treasury.associatedTokenAddress.toBase58() 
    : treasury.associatedTokenAddress;

  return {
    id: friendly ? address.toBase58() : address,
    version: treasury.version,
    initialized: treasury.initialized === 1 ? true : false,
    name: new TextDecoder().decode(nameBuffer),
    bump: treasury.bump,
    slot: treasury.slot.toNumber(),
    labels: treasury.labels,
    mint: friendly ? treasury.mintAddress.toBase58() : treasury.mintAddress,
    autoClose: treasury.autoClose === 0 ? false : true,
    createdOnUtc: friendly 
      ? new Date(treasury.createdOnUtc.toNumber()).toString()
      : new Date(treasury.createdOnUtc.toNumber()),

    treasuryType: treasury.treasuryType === 0 ? TreasuryType.Open : TreasuryType.Lock,
    treasurer: friendly ? treasury.treasurerAddress.toBase58() : treasury.treasurerAddress,
    associatedToken: treasuryAssocatedTokenMint,
    balance: treasury.lastKnownBalanceUnits.toNumber(),
    allocationReserved: treasury.allocationReservedUnits.toNumber(),
    allocationAssigned: treasury.allocationAssignedUnits.toNumber(),
    totalWithdrawals: treasury.totalWithdrawalsUnits.toNumber(),
    totalStreams: treasury.totalStreams.toNumber(),
    data: treasury
    
  } as Treasury;
}

const getStreamEstDepletionDate = (stream: any) => {

  if (stream.rateIntervalInSeconds == 0) {
    return new Date();
  }

  let cliffAmount = getStreamCliffAmount(stream);
  let streamableAmount = stream.allocationAssignedUnits.toNumber() - cliffAmount;
  let durationSeconds = streamableAmount / stream.rateIntervalInSeconds;
  let estDepletionTime = stream.startUtc.toNumber() + durationSeconds * 1000; // milliseconds

  return new Date(estDepletionTime);
}

const getStreamCliffAmount = (stream: any) => {

  let cliffAmount = stream.cliffVestAmountUnits.toNumber();

  if (stream.cliffVestPercent > 0) {
    cliffAmount = stream.cliffVestPercent * stream.allocationAssignedUnits / 100;
  }

  return cliffAmount;
}

const getFundsLeftInStream = (stream: any) => {

  let withdrawableAmount = getStreamWithdrawableAmount(stream);
  let fundsLeft = (
    stream.allocationAssignedUnits.toNumber() -
    stream.totalWithdrawalsUnits.toNumber() -
    withdrawableAmount
  );

  return fundsLeft;
}

const getFundsSentToBeneficiary = (stream: any) => {

  let withdrawableAmount = getStreamWithdrawableAmount(stream);
  let fundsSent = (
    stream.totalWithdrawalsUnits.toNumber() +
    withdrawableAmount
  );

  return fundsSent;
}

const getStreamRemainingAllocation = (stream: any) => {
  return stream.allocationAssignedUnits.toNumber() - stream.totalWithdrawalsUnits.toNumber();
}

const getStreamWithdrawableAmount = (stream: any) => {

  let remainingAllocation = getStreamRemainingAllocation(stream);

  if (remainingAllocation === 0) {
    return 0;
  }

  let status = getStreamStatus(stream);

  // Check if SCHEDULED
  if (status === STREAM_STATUS.Schedule) {
    return 0;
  }

  // Check if PAUSED
  if (status === STREAM_STATUS.Paused) {
    let manuallyPaused = isStreamManuallyPaused(stream);
    let withdrawableWhilePausedAmount = manuallyPaused 
      ? stream.lastManualStopWithdrawableUnitsSnap.toNumber()
      : stream.allocationAssignedUnits.toNumber() - stream.totalWithdrawalsUnits.toNumber();

    return withdrawableWhilePausedAmount;
  }

  // Check if RUNNING
  if (stream.rateAmountUnits.toNumber() === 0 || stream.rateIntervalInSeconds.toNumber() === 0) {
    throw Error("Invalid stream data");
  }

  let streamedUnitsPerSecond = getStreamUnitsPerSecond(stream);
  let cliffAmount = getStreamCliffAmount(stream);
  let now = new Date();
  let timeSinceStart = (now.getTime() - stream.startUtc.toNumber()) / 1000; // milliseconds
  let nonStopEarningUnits = cliffAmount + (streamedUnitsPerSecond * timeSinceStart);
  let missedEarningUnitsWhilePaused = 
    streamedUnitsPerSecond * stream.lastKnownTotalSecondsInPausedStatus.toNumber();

  let entitledEarnings = nonStopEarningUnits - missedEarningUnitsWhilePaused;
  let withdrawableUnitsWhileRunning = entitledEarnings - stream.totalWithdrawalsUnits.toNumber();
  let withdrawableAmount = Math.min(remainingAllocation, withdrawableUnitsWhileRunning);

  return withdrawableAmount;
}

const getStreamStatus = (stream: any) => {

  let now = new Date();
  let startTime = stream.startUtc.toNumber();

  // Scheduled
  if (startTime > now.getTime()) { 
    return STREAM_STATUS.Schedule;
  }

  // Manually paused
  let manuallyPaused = isStreamManuallyPaused(stream);

  if (manuallyPaused) {
    return STREAM_STATUS.Paused;
  }

  // Running or automatically paused (ran out of funds)
  let streamedUnitsPerSecond = getStreamUnitsPerSecond(stream);
  let cliffAmount = getStreamCliffAmount(stream);
  let timeSinceStart = (now.getTime() - startTime) / 1000; // milliseconds
  let nonStopEarningUnits = cliffAmount + (streamedUnitsPerSecond * timeSinceStart);
  let missedEarningUnitsWhilePaused = 
    streamedUnitsPerSecond * stream.lastKnownTotalSecondsInPausedStatus.toNumber();

  let entitledEarnings = nonStopEarningUnits - missedEarningUnitsWhilePaused;
  // Running
  if (stream.allocationAssignedUnits.toNumber() > entitledEarnings) {
    return STREAM_STATUS.Running;
  }

  // Automatically paused (ran out of funds)
  return STREAM_STATUS.Paused;
}

const isStreamManuallyPaused = (stream: any) => {
  if (stream.lastManualStopBlockTime.toNumber() === 0) {
    return false;
  }
  return stream.lastManualStopBlockTime.toNumber() > stream.lastManualResumeBlockTime.toNumber();
}

const getStreamUnitsPerSecond = (stream: any) => {
  if (stream.rateIntervalInSeconds.toNumber() === 0) {
    return 0;
  }
  return stream.rateAmountUnits.toNumber() / (stream.rateIntervalInSeconds.toNumber());
}

const isNotValidWallet = (address: PublicKey): boolean => {
  if (typeof address !== 'string' && address.constructor.name !== 'PublicKey') {
    return false;
  }
  return true;
}