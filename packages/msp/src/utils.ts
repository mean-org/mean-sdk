import { Commitment, Connection, PublicKey, ConfirmOptions, Finality, ParsedConfirmedTransaction, PartiallyDecodedInstruction, GetProgramAccountsFilter, ParsedInstruction, LAMPORTS_PER_SOL, ParsedInnerInstruction, Transaction, Enum, TokenAmount, ConfirmedSignaturesForAddress2Options } from "@solana/web3.js";
import { BN, Idl, Program, Provider } from "@project-serum/anchor";
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
  walletAddress: string

): Program<Idl> => {
  
  const opts: ConfirmOptions = {
    preflightCommitment: "finalized",
    commitment: "finalized",
  };

  let wallet: Wallet = {
    publicKey: new PublicKey(walletAddress),
    signAllTransactions: async (txs) => txs, 
    signTransaction: async (tx) => tx
  };

  const provider = new Provider(connection, wallet, opts);
  
  return new Program(MSP_IDL, Constants.MSP, provider);
}

export const getStream = async (
  program: Program<Idl>,
  address: PublicKey,
  friendly: boolean = true

): Promise<any> => {
  
  try {

    const streamEventResponse = await program.simulate.getStream({
      accounts: {
        stream: address
      }
    });
  
    if (
      !streamEventResponse || 
      !streamEventResponse.events || 
      !streamEventResponse.events.length ||
      !streamEventResponse.events[0].data
    ) {
      return null;
    }

    const event: any = streamEventResponse.events[0].data;
    let streamInfo = parseGetStreamData(
      event, 
      address, 
      friendly
    );
  
    return streamInfo;

  } catch (error: any) {
    console.log(error);
    return null;
  }
}

export const getStreamCached = async (
  streamInfo: Stream,
  friendly: boolean = true

): Promise<Stream> => {

  const timeDiff = streamInfo.lastRetrievedTimeInSeconds - streamInfo.lastRetrievedBlockTime;
  const blocktime = parseInt((Date.now() / 1_000).toString()) - timeDiff;

  const parsedStream = parseStreamItemData(
    streamInfo.data,
    new PublicKey(streamInfo.id as string),
    blocktime,
    friendly
  );

  parsedStream.createdBlockTime = streamInfo.createdBlockTime;

  return parsedStream;
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
  let slot = await program.provider.connection.getSlot("finalized");
  let blockTime = await program.provider.connection.getBlockTime(slot) as number;

  for (let item of accounts) {
    if (item.account !== undefined) {
      let parsedStream = parseStreamItemData(item.account, item.publicKey, blockTime, friendly);
      let info = Object.assign({ }, parsedStream);
      let signatures = await program.provider.connection.getConfirmedSignaturesForAddress2(
        friendly ? new PublicKey(info.id as string) : (info.id as PublicKey),
        { limit: 1 }, 
        'confirmed'
      );

      if (signatures.length > 0) {
        info.createdBlockTime = signatures[0].blockTime as number;
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

  for (let streamInfo of streamInfoList) {
    let timeDiff = streamInfo.lastRetrievedTimeInSeconds - streamInfo.lastRetrievedBlockTime;
    let blockTime = parseInt((Date.now() / 1_000).toString()) - timeDiff;
    
    let parsedStream = parseStreamItemData(
      streamInfo.data, 
      new PublicKey(streamInfo.id as string), 
      blockTime, 
      friendly
    );

    parsedStream.createdBlockTime = streamInfo.createdBlockTime;
    streamList.push(parsedStream);
  }  

  return streamList;
}

export const listStreamActivity = async (
  program: Program<Idl>,
  address: PublicKey,
  before: string = '',
  limit: number = 10,
  commitment?: Finality | undefined,
  friendly: boolean = true

): Promise<StreamActivity[]> => {

  let activity: any = [];
  let finality = commitment !== undefined ? commitment : "finalized";
  let filter = { limit: limit } as ConfirmedSignaturesForAddress2Options;
  if (before) { filter['before'] = before };
  let signatures = await program.provider.connection.getConfirmedSignaturesForAddress2(address, filter, finality);
  let txs = await program.provider.connection.getParsedConfirmedTransactions(signatures.map((s: any) => s.signature), finality);

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
  let parsedTreasury = parseTreasuryData(treasury, address, friendly)

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
    case MSP_ACTIONS.transferStream: {
      blockchainFee = 5000;
      txFees.mspFlatFee = 0.00001;
      break;
    }
    case MSP_ACTIONS.treasuryWithdraw: {
      // txFees.mspFlatFee = 0.00001;
      txFees.mspPercentFee = 0.25;
      break;
    }
    default: {
      break;
    }
  }

  txFees.blockchainFee = blockchainFee / LAMPORTS_PER_SOL;

  return txFees;
};

export const getValidTreasuryAllocation = async (
  connection: Connection,
  treasury: Treasury,
  allocation: number

) => {

  const fees = await calculateActionFees(connection, MSP_ACTIONS.withdraw);
  //
  const BASE_100_TO_BASE_1_MULTIPLIER = 10_000;
  const feeNumerator = fees.mspPercentFee * BASE_100_TO_BASE_1_MULTIPLIER;
  const feeDenaminator = 1_000_000;
  const unallocatedBalance = new BN(treasury.balance).sub(new BN(treasury.allocationAssigned));
  const allocationAmountBn = new BN(allocation).add(unallocatedBalance);
  const badStreamAllocationAmount = allocationAmountBn
    .mul(new BN(feeDenaminator))
    .div(new BN(feeNumerator + feeDenaminator));

  const feeAmount = badStreamAllocationAmount
    .mul(new BN(feeNumerator))
    .div(new BN(feeDenaminator));
  
  if (unallocatedBalance.gte(feeAmount)) {
    return badStreamAllocationAmount;
  }

  const goodStreamMaxAllocation = allocationAmountBn.sub(feeAmount);

  return goodStreamMaxAllocation;
}

const getFilteredStreamAccounts = async (
  program: Program<Idl>,
  treasurer?: PublicKey | undefined,
  treasury?: PublicKey | undefined,
  beneficiary?: PublicKey | undefined

) => {

  let accounts: any[] = [];

  if (treasury) {

    let memcmpFilters = [{ memcmp: { offset: 8 + 170, bytes: treasury.toBase58() }}];
    const accs = await program.account.stream.all(memcmpFilters);
  
    if (accs.length) {
      accounts.push(...accs);
    }

  } else {

    if (treasurer) {

      let memcmpFilters = [{ memcmp: { offset: 8 + 34, bytes: treasurer.toBase58() }}];  
      const accs = await program.account.stream.all(memcmpFilters);
    
      if (accs.length) {
        for (let acc of accs) {
          if (accounts.indexOf(acc) === -1) {
            accounts.push(acc);
          }
        }
      }
    }
  
    if (beneficiary) {
  
      let memcmpFilters = [{ memcmp: { offset: 8 + 106, bytes: beneficiary.toBase58() }}];
      const accs = await program.account.stream.all(memcmpFilters);
    
      if (accs.length) {
        for (let acc of accs) {
          if (accounts.indexOf(acc) === -1) {
            accounts.push(acc);
          }
        }
      }
    }
  }

  return accounts;
}

const parseGetStreamData = (
  event: any,
  address: PublicKey,
  friendly: boolean = true

) => {

  let nameBuffer = Buffer.from(event.name);
  let startUtc = parseInt((event.startUtc.toNumber() * 1_000).toString());

  const stream = {
    id: friendly ? address.toBase58() : address,
    version: event.version,
    initialized: event.initialized,
    name: new TextDecoder().decode(nameBuffer),
    startUtc: !friendly ? new Date(startUtc).toString() : new Date(startUtc),
    treasurer: friendly ? event.treasurerAddress.toBase58() : event.treasurerAddress,
    treasury: friendly ? event.treasuryAddress.toBase58() : event.treasuryAddress,
    beneficiary: friendly ? event.beneficiaryAddress.toBase58() : event.beneficiaryAddress,
    associatedToken: friendly ? event.beneficiaryAssociatedToken.toBase58() : event.beneficiaryAssociatedToken,
    cliffVestAmount: friendly ? event.cliffVestAmountUnits.toNumber() : event.cliffVestAmountUnits,
    cliffVestPercent: friendly ? event.cliffVestPercent.toNumber() / 10_000 : event.cliffVestPercent.div(new BN(10_000)),
    allocationAssigned: friendly ? event.allocationAssignedUnits.toNumber() : event.allocationAssignedUnits,
    // allocationReserved: friendly ? event.allocationReservedUnits.toNumber() : event.allocationReservedUnits,

    secondsSinceStart: friendly 
      ? Math.max(0, event.currentBlockTime.toNumber() - event.startUtc.toNumber()) 
      : event.currentBlockTime.sub(new BN(event.startUtc)),

    estimatedDepletionDate: friendly 
      ? new Date(event.estDepletionTime.toNumber() * 1_000).toString() 
      : new Date(event.estDepletionTime.toNumber() * 1_000),
      
    rateAmount: friendly ? event.rateAmountUnits.toNumber() : event.rateAmountUnits,
    rateIntervalInSeconds: friendly ? event.rateIntervalInSeconds.toNumber() : event.rateIntervalInSeconds,
    totalWithdrawalsAmount: friendly ? event.totalWithdrawalsUnits.toNumber() : event.totalWithdrawalsUnits,
    fundsLeftInStream: friendly ? event.fundsLeftInStream.toNumber() : event.fundsLeftInStream,

    fundsSentToBeneficiary: friendly 
      ? event.fundsSentToBeneficiary.toNumber() 
      : new BN(event.fundsSentToBeneficiary),

    remainingAllocationAmount: friendly 
      ? event.beneficiaryRemainingAllocation.toNumber() 
      : event.beneficiaryRemainingAllocation,

    withdrawableAmount: friendly 
      ? event.beneficiaryWithdrawableAmount.toNumber() 
      : event.beneficiaryWithdrawableAmount,

    streamUnitsPerSecond: getStreamUnitsPerSecond(event),
    isManuallyPaused: event.isManualPause,
    status: event.status === 'Scheduled' ? 1 : (event.status === 'Running' ? 2 : 3),
    lastRetrievedBlockTime: friendly ? event.currentBlockTime.toNumber() : event.currentBlockTime,
    lastRetrievedTimeInSeconds: friendly 
      ? parseInt((Date.now() / 1_000).toString()) 
      : new BN(parseInt((Date.now() / 1_000).toString())),

    totalWithdrawals: friendly ? event.totalWithdrawalsUnits.toNumber() : event.totalWithdrawalsUnits,
    feePayedByTreasurer: event.feePayedByTreasurer,
    createdBlockTime: event.startUtc.toNumber(),
    upgradeRequired: false,
    data: event
    
  } as Stream;

  return stream;
}

const parseStreamItemData = (
  stream: any,
  address: PublicKey,
  blockTime: number, 
  friendly: boolean = true

) => {

  let nameBuffer = Buffer.from(stream.name);
  let startUtc = getStreamStartUtcInSeconds(stream) * 1_000;
  let timeDiff = parseInt((Date.now() / 1_000).toString()) - blockTime;

  let streamInfo = {
    id: friendly ? address.toBase58() : address,
    version: stream.version,
    initialized: stream.initialized,
    name: new TextDecoder().decode(nameBuffer),
    startUtc: !friendly ? new Date(startUtc).toString() : new Date(startUtc),
    treasurer: friendly ? stream.treasurerAddress.toBase58() : stream.treasurerAddress,
    treasury: friendly ? stream.treasuryAddress.toBase58() : stream.treasuryAddress,
    beneficiary: friendly ? stream.beneficiaryAddress.toBase58() : stream.beneficiaryAddress,
    associatedToken: friendly ? stream.beneficiaryAssociatedToken.toBase58() : stream.beneficiaryAssociatedToken,
    cliffVestAmount: friendly ? stream.cliffVestAmountUnits.toNumber() : stream.cliffVestAmountUnits,
    cliffVestPercent: friendly ? stream.cliffVestPercent.toNumber() / 10_000 : stream.cliffVestPercent.div(new BN(10_000)),
    allocationAssigned: friendly ? stream.allocationAssignedUnits.toNumber() : stream.allocationAssignedUnits,
    // allocationReserved: friendly ? stream.allocationReservedUnits.toNumber() : stream.allocationReservedUnits,
    secondsSinceStart: friendly ? (blockTime - getStreamStartUtcInSeconds(stream)) : new BN(blockTime).sub(new BN(startUtc)),
    estimatedDepletionDate: friendly ? getStreamEstDepletionDate(stream).toString() : getStreamEstDepletionDate(stream),
    rateAmount: friendly ? stream.rateAmountUnits.toNumber() : stream.rateAmountUnits,
    rateIntervalInSeconds: friendly ? stream.rateIntervalInSeconds.toNumber() : stream.rateIntervalInSeconds,
    totalWithdrawalsAmount: friendly ? stream.totalWithdrawalsUnits.toNumber() : stream.totalWithdrawalsUnits,
    fundsLeftInStream: friendly ? getFundsLeftInStream(stream, timeDiff) : new BN(getFundsLeftInStream(stream, timeDiff)),
    fundsSentToBeneficiary: friendly ? getFundsSentToBeneficiary(stream, timeDiff) : new BN(getFundsSentToBeneficiary(stream, timeDiff)),
    remainingAllocationAmount: friendly ? getStreamRemainingAllocation(stream) : new BN(getStreamRemainingAllocation(stream)),
    withdrawableAmount: friendly ? getStreamWithdrawableAmount(stream, timeDiff) : new BN(getStreamWithdrawableAmount(stream, timeDiff)),
    streamUnitsPerSecond: getStreamUnitsPerSecond(stream),
    isManuallyPaused: isStreamManuallyPaused(stream),
    status: getStreamStatus(stream, timeDiff),
    lastRetrievedBlockTime: friendly ? blockTime : new BN(blockTime),
    lastRetrievedTimeInSeconds: friendly ? parseInt((Date.now() / 1_000).toString()) : new BN(parseInt((Date.now() / 1_000).toString())),
    totalWithdrawals: friendly ? stream.totalWithdrawalsUnits.toNumber() : stream.totalWithdrawalsUnits,
    feePayedByTreasurer: stream.feePayedByTreasurer,
    transactionSignature: '',
    createdBlockTime: 0,
    upgradeRequired: false,
    data: {
      version: stream.version,
      initialized: stream.initialized,
      name: stream.name,
      startUtc: stream.startUtc,
      treasurerAddress: stream.treasurerAddress,
      rateAmountUnits: stream.rateAmountUnits,
      rateIntervalInSeconds: stream.rateIntervalInSeconds,
      cliffVestAmountUnits: stream.cliffVestAmountUnits,
      cliffVestPercent: stream.cliffVestPercent,
      beneficiaryAddress: stream.beneficiaryAddress,
      beneficiaryAssociatedToken: stream.beneficiaryAssociatedToken,
      treasuryAddress: stream.treasuryAddress,    
      allocationAssignedUnits: stream.allocationAssignedUnits,
      allocationReservedUnits: stream.allocationReservedUnits,
      totalWithdrawalsUnits: stream.totalWithdrawalsUnits,
      lastWithdrawalUnits: stream.lastWithdrawalUnits,
      lastWithdrawalSlot: stream.lastWithdrawalSlot,
      lastWithdrawalBlockTime: stream.lastWithdrawalBlockTime,
      lastManualStopWithdrawableUnitsSnap: stream.lastManualStopWithdrawableUnitsSnap, 
      lastManualStopSlot: stream.lastManualStopSlot,
      lastManualStopBlockTime: stream.lastManualStopBlockTime,
      lastManualResumeRemainingAllocationUnitsSnap: stream.lastManualResumeRemainingAllocationUnitsSnap,
      lastManualResumeSlot: stream.lastManualResumeSlot,
      lastManualResumeBlockTime: stream.lastManualResumeBlockTime,
      lastKnownTotalSecondsInPausedStatus: stream.lastKnownTotalSecondsInPausedStatus,
      lastAutoStopBlockTime: stream.lastAutoStopBlockTime,
      feePayedByTreasurer: stream.feePayedByTreasurer,
      // calculated data
      status: getStreamStatus(stream, timeDiff) === 1 ? "Scheduled" : (getStreamStatus(stream, 0) === 2 ? "Running" : "Paused"),
      isManualPause: isStreamManuallyPaused(stream),
      cliffUnits: new BN(getStreamCliffAmount(stream)),
      currentBlockTime: new BN(blockTime),
      secondsSinceStart: new BN(blockTime).sub(new BN(getStreamStartUtcInSeconds(stream))),
      estDepletionTime: new BN(parseInt((getStreamEstDepletionDate(stream).getTime() / 1_000).toString())),
      fundsLeftInStream: new BN(getFundsLeftInStream(stream, timeDiff)),
      fundsSentToBeneficiary: new BN(getFundsSentToBeneficiary(stream, timeDiff)),
      withdrawableUnitsWhilePaused: new BN(getStreamWithdrawableUnitsWhilePaused(stream)),
      nonStopEarningUnits: new BN(getStreamNonStopEarningUnits(stream, timeDiff)),
      missedUnitsWhilePaused: new BN(getStreamMissedEarningUnitsWhilePaused(stream)),
      entitledEarningsUnits: new BN(
        Math.max(0, getStreamNonStopEarningUnits(stream, timeDiff) - getStreamMissedEarningUnitsWhilePaused(stream))
      ),
      withdrawableUnitsWhileRunning: 
        new BN(
          Math.max(getStreamNonStopEarningUnits(stream, timeDiff) - getStreamMissedEarningUnitsWhilePaused(stream)) + 
          stream.totalWithdrawalsUnits.toNumber()
        ),
      beneficiaryRemainingAllocation: new BN(getStreamRemainingAllocation(stream)),
      beneficiaryWithdrawableAmount: new BN(getStreamWithdrawableAmount(stream, 0)),
      lastKnownStopBlockTime: new BN(
        Math.max(stream.lastAutoStopBlockTime.toNumber(), stream.lastManualStopBlockTime.toNumber())
      )
    },
    
  } as Stream;

  return streamInfo;
}

const parseStreamActivityData = (
  program: Program<Idl>,
  signature: string,
  tx: ParsedConfirmedTransaction,
  friendly: boolean = true

): StreamActivity => {

  let streamActivity: StreamActivity = defaultStreamActivity;
  let signer = tx.transaction.message.accountKeys.filter((a) => a.signer)[0];
  if (!tx.transaction.message.instructions.length) {
    return streamActivity;
  }
  let instruction = tx.transaction.message.instructions.filter((ix: any) => {
    try {
      let buffer = bs58.decode(ix.data);
      if (ix.programId.equals(Constants.MSP) && buffer.length < 80) {
        let info = program.coder.instruction.decode(buffer.slice(0, buffer.length));
        return info && (info.name === "createStream" || info.name === "addFunds" || info.name === "withdraw");
      }
    } catch {
      return false;
    }
    return false;
  })[0] as PartiallyDecodedInstruction;

  if (!instruction) {
    return streamActivity;
  }

  let buffer = bs58.decode(instruction.data);
  let info = program.coder.instruction.decode(buffer);
  
  if (info && (info.name === 'createStream' || info.name === 'addFunds' || info.name === 'withdraw')) {

    let blockTime = (tx.blockTime as number) * 1000; // mult by 1000 to add milliseconds
    let action = info.name === 'createStream' || info.name === 'addFunds' ? "deposited" : "withdrew";
    let data = info.data as any;
    let amount = info.name === 'createStream' ? data.allocationAssignedUnits.toNumber() : data.amount.toNumber();
 
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

  const treasuryCreatedUtc = treasury.createdOnUtc.toString().length > 10 
    ? parseInt(treasury.createdOnUtc.toString().substring(0, 10)) 
    : treasury.createdOnUtc.toNumber();

  return {
    id: friendly ? address.toBase58() : address,
    version: treasury.version,
    initialized: treasury.initialized,
    name: new TextDecoder().decode(nameBuffer),
    bump: treasury.bump,
    slot: treasury.slot.toNumber(),
    labels: treasury.labels,
    mint: friendly ? treasury.mintAddress.toBase58() : treasury.mintAddress,
    autoClose: treasury.autoClose,
    createdOnUtc: friendly 
      ? new Date(treasuryCreatedUtc * 1_000).toString()
      : new Date(treasuryCreatedUtc * 1_000),

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
  let streamableAmount = Math.max(0, stream.allocationAssignedUnits.toNumber() - cliffAmount);
  let rateAmount = stream.rateIntervalInSeconds.toNumber() === 0 
    ? 0 : stream.rateAmountUnits.toNumber() / stream.rateIntervalInSeconds.toNumber();

  let streamableSeconds = streamableAmount / rateAmount;
  let duration = streamableSeconds + stream.lastKnownTotalSecondsInPausedStatus.toNumber();
  const startUtcInSeconds = getStreamStartUtcInSeconds(stream);

  return new Date((startUtcInSeconds + duration) * 1_000);
}

const getStreamCliffAmount = (stream: any) => {

  let cliffAmount = stream.cliffVestAmountUnits.toNumber();

  if (stream.cliffVestPercent > 0) {
    cliffAmount = 
      stream.cliffVestPercent.toNumber() * 
      stream.allocationAssignedUnits.toNumber() / 
      Constants.CLIFF_PERCENT_DENOMINATOR;
  }

  return parseInt(cliffAmount.toString());
}

const getFundsLeftInStream = (stream: any, timeDiff: number = 0) => {

  let withdrawableAmount = getStreamWithdrawableAmount(stream, timeDiff);
  let fundsLeft = (
    stream.allocationAssignedUnits.toNumber() -
    stream.totalWithdrawalsUnits.toNumber() -
    withdrawableAmount
  );

  return Math.max(0, fundsLeft);
}

const getFundsSentToBeneficiary = (stream: any, timeDiff: number = 0) => {

  let withdrawableAmount = getStreamWithdrawableAmount(stream, timeDiff);
  let fundsSent = (
    stream.totalWithdrawalsUnits.toNumber() +
    withdrawableAmount
  );
  return fundsSent;
}

const getStreamRemainingAllocation = (stream: any) => {
  let remainingAlloc = stream.allocationAssignedUnits.toNumber() - stream.totalWithdrawalsUnits.toNumber();
  return Math.max(0, remainingAlloc);
}

const getStreamWithdrawableAmount = (stream: any, timeDiff: number = 0) => {

  let remainingAllocation = getStreamRemainingAllocation(stream);

  if (remainingAllocation === 0) {
    return 0;
  }

  let status = getStreamStatus(stream, timeDiff);

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

    return Math.max(0, withdrawableWhilePausedAmount);
  }

  // Check if RUNNING
  if (stream.rateAmountUnits.toNumber() === 0 || stream.rateIntervalInSeconds.toNumber() === 0) {
    return 0;
  }

  let streamedUnitsPerSecond = getStreamUnitsPerSecond(stream);
  let cliffAmount = getStreamCliffAmount(stream);
  let blocktime = (parseInt((Date.now() / 1_000).toString()) - timeDiff);
  let startUtcInSeconds = getStreamStartUtcInSeconds(stream);
  let timeSinceStart = (blocktime - startUtcInSeconds);
  let nonStopEarningUnits = cliffAmount + (streamedUnitsPerSecond * timeSinceStart);
  let totalSecondsPaused = stream.lastKnownTotalSecondsInPausedStatus.toNumber().length >= 10
    ? parseInt((stream.lastKnownTotalSecondsInPausedStatus.toNumber() / 1_000).toString())
    : stream.lastKnownTotalSecondsInPausedStatus.toNumber();

  let missedEarningUnitsWhilePaused = streamedUnitsPerSecond * totalSecondsPaused;
  let entitledEarnings = nonStopEarningUnits;

  if (nonStopEarningUnits >= missedEarningUnitsWhilePaused) {
    entitledEarnings = nonStopEarningUnits - missedEarningUnitsWhilePaused;
  }

  let withdrawableUnitsWhileRunning = entitledEarnings;

  if (entitledEarnings >= stream.totalWithdrawalsUnits.toNumber()) {
    withdrawableUnitsWhileRunning = entitledEarnings - stream.totalWithdrawalsUnits.toNumber();
  }

  let withdrawableAmount = Math.min(remainingAllocation, withdrawableUnitsWhileRunning);

  return Math.max(0, parseInt(withdrawableAmount.toString()));
}

const getStreamStatus = (stream: any, timeDiff: number) => {

  let now = (parseInt((Date.now() / 1_000).toString()) - timeDiff);
  const startUtcInSeconds = getStreamStartUtcInSeconds(stream);

  // Scheduled
  if (startUtcInSeconds > now) { 
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
  let timeSinceStart = (now - startUtcInSeconds);
  let nonStopEarningUnits = cliffAmount + (streamedUnitsPerSecond * timeSinceStart);
  let missedEarningUnitsWhilePaused = streamedUnitsPerSecond * stream.lastKnownTotalSecondsInPausedStatus.toNumber();
  let entitledEarnings = nonStopEarningUnits;

  if (nonStopEarningUnits >= missedEarningUnitsWhilePaused) {
    entitledEarnings = nonStopEarningUnits - missedEarningUnitsWhilePaused;
  }

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

const getStreamStartUtcInSeconds = (stream: any) => {
  let startUtcFixed = 0;
  if (stream.startUtc.toString().length > 10) {
    startUtcFixed = parseInt(stream.startUtc.toString().substr(0, 10));
    return startUtcFixed;
  }
  if (stream.startUtcInSeconds && stream.startUtcInSeconds.toNumber() > 0) {
    return stream.startUtcInSeconds.toNumber();
  }
  return stream.startUtc.toNumber();
}

const getStreamWithdrawableUnitsWhilePaused = (stream: any) => {

  let withdrawableWhilePaused = 0;
  let isManuallyPaused = isStreamManuallyPaused(stream);

  if (isManuallyPaused) {
    withdrawableWhilePaused = stream.lastManualStopWithdrawableUnitsSnap.toNumber();
  } else {
      withdrawableWhilePaused = stream.allocationAssignedUnits
        .sub(stream.totalWithdrawalsUnits).toNumber();
  }

  return Math.max(0, withdrawableWhilePaused);
}

const getStreamNonStopEarningUnits = (stream: any, timeDiff: number) => {

  let cliffUnits = getStreamCliffAmount(stream);
  let blocktime = parseInt((Date.now() / 1_000).toString()) - timeDiff;
  let secondsSinceStart = Math.max(0, blocktime - getStreamStartUtcInSeconds(stream));
  let streamUnitsSinceStarted =
    stream.rateIntervalInSeconds.toNumber() *
    secondsSinceStart /
    stream.rateAmountUnits.toNumber();

  let nonStopEarningUnits = cliffUnits + parseInt(streamUnitsSinceStarted.toString());

  return parseInt(nonStopEarningUnits.toString());
}

const getStreamMissedEarningUnitsWhilePaused = (stream: any) => {
  if (stream.rateIntervalInSeconds.toNumber() === 0) {
    return 0;
  }  

  let totalSecondsPaused = stream.lastKnownTotalSecondsInPausedStatus.toString().length > 10 
    ? parseInt(stream.startUtc.toString().substring(0, 10))
    : stream.lastKnownTotalSecondsInPausedStatus.toNumber();

  let withdrawableWhilePaused =
    stream.rateIntervalInSeconds.toNumber() *
    totalSecondsPaused /
    stream.rateAmountUnits.toNumber();

  return parseInt(withdrawableWhilePaused.toString());
}