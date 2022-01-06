import { Commitment, Connection, PublicKey, ConfirmOptions } from "@solana/web3.js";
import { BN, Idl, Program, Provider } from "@project-serum/anchor";
/**
 * MSP
 */
import MSP_IDL from './idl';
import { Constants } from "./constants";
import { StreamInfo } from "./types";

String.prototype.toPublicKey = function (): PublicKey {
  return new PublicKey(this.toString());
};

// let defaultStreamInfo: StreamInfo = {
//   id: '',
//   version: 0,
//   initialized: false,
//   name: '',
//   treasurer: '',
//   rateAmount: 0,
//   rateIntervalInSeconds: 0,    
//   startUtc: '',
//   cliffVestAmount: 0,
//   cliffVestPercent: 0,
//   beneficiary: '',
//   associatedToken: '',
//   treasury: '',    
//   allocationAssigned: 0,
//   allocationReserved: 0,
//   totalWithdrawalsAmount: 0,
//   lastWithdrawalAmount: 0,
//   lastWithdrawalSlot: 0,
//   lastWithdrawalBlockTime: 0,
//   lastManualStopWithdrawableSnap: 0, 
//   lastManualStopSlot: 0,
//   lastManualStopBlockTime: 0,
//   lastManualResumeAllocationChangeAmount: 0,
//   lastManualResumeSlot: 0,
//   lastManualResumeBlockTime: 0,
//   lastKnownTotalSecondsInPause: 0,
//   transactionSignature: '',
//   createdBlockTime: 0,
//   lastRetrievedBlockTime: 0,
//   status: '',
//   withdrawableAmount: 0,
//   fundsLeftInStream: 0,
//   fundsSentToBeneficiary: 0,
//   remainingAllocationAmount: 0,
//   estimatedDepletionDate: ''
// };

// let defaultTreasuryInfo: TreasuryInfo = {
//   id: "",
//   initialized: false,
//   slot: 0,
//   treasurer: "",
//   associatedTokenAddress: "",
//   mintAddress: "",  
//   label: "",
//   balance: 0,
//   allocationReserved: 0,
//   allocationLeft: 0,
//   allocationAssigned: 0,
//   streamsAmount: 0,
//   upgradeRequired: false,
//   createdOnUtc: "",
//   depletionRate: 0,
//   type: TreasuryType.Open,
//   autoClose: false
// };

export const createProgram = (
  connection: Connection,
  wallet: any

): Program<Idl> => {
  
  const opts: ConfirmOptions = {
    preflightCommitment: "recent",
    commitment: "recent",
  };

  const provider = new Provider(connection, wallet as any, opts);
  
  return new Program(MSP_IDL, Constants.MSP, provider);
}

export const getStream = async (
  program: Program<Idl>,
  address: PublicKey,
  commitment: Commitment = "finalized",
  friendly: boolean = true

): Promise<StreamInfo> => {
  
  throw Error('Not implemented');
}