import { AmmPoolInfo, Client } from "./types";
import { AMM_POOLS } from "./data";
import { NATIVE_SOL_MINT, WRAPPED_SOL_MINT } from "./types";
import { Connection, Keypair, LAMPORTS_PER_SOL, Signer, SystemProgram, Transaction } from "@solana/web3.js";
import { AccountLayout, ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getOptimalPools, getProtocolClient } from "./utils";
import BN from "bn.js";

export const getClient = (
  connection: Connection,
  protocolAddress: string

): Client => {

  return getProtocolClient(
    connection, 
    protocolAddress
  );
}

export const getPools = async (
  connection: Connection,
  from: string,
  to: string

): Promise<AmmPoolInfo[]> => {

  const pools = AMM_POOLS.filter((ammPool) => {

    let fromIncluded = false;

    if (from === NATIVE_SOL_MINT.toBase58() || from === WRAPPED_SOL_MINT.toBase58()) {
      fromIncluded = (
        ammPool.tokenAddresses.includes(NATIVE_SOL_MINT.toBase58()) || 
        ammPool.tokenAddresses.includes(WRAPPED_SOL_MINT.toBase58())
      );
    } else {
      fromIncluded = ammPool.tokenAddresses.includes(from);
    }

    let toIncluded = false;

    if (to === NATIVE_SOL_MINT.toBase58() || to === WRAPPED_SOL_MINT.toBase58()) {
      toIncluded = (
        ammPool.tokenAddresses.includes(NATIVE_SOL_MINT.toBase58()) || 
        ammPool.tokenAddresses.includes(WRAPPED_SOL_MINT.toBase58())
      );
    } else {
      toIncluded = ammPool.tokenAddresses.includes(to);
    }

    return fromIncluded && toIncluded;

  });

  return await getOptimalPools(connection, from, to, pools);
}

export const wrapSol = async (
  connection: Connection,
  wallet: any,
  account: Keypair,
  amount: number

): Promise<Transaction> => {

  const amountBn = new BN(parseFloat(amount.toFixed(9)) * LAMPORTS_PER_SOL);
  const signers: Signer[] = [account];
  const minimumWrappedAccountBalance = await Token.getMinBalanceRentForExemptAccount(connection);
  
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: account.publicKey,
      lamports: minimumWrappedAccountBalance + amountBn.toNumber(),
      space: AccountLayout.span,
      programId: TOKEN_PROGRAM_ID,
    }),
    Token.createInitAccountInstruction(
      TOKEN_PROGRAM_ID,
      WRAPPED_SOL_MINT,
      account.publicKey,
      wallet.publicKey
    )
  );

  const aTokenKey = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    WRAPPED_SOL_MINT,
    wallet.publicKey,
    true
  );

  const aTokenInfo = await connection.getAccountInfo(aTokenKey);
  
  if (!aTokenInfo) {
    tx.add(
      Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        WRAPPED_SOL_MINT,
        aTokenKey,
        wallet.publicKey,
        wallet.publicKey
      )
    );
  }

  tx.add(
    Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      account.publicKey,
      aTokenKey,
      wallet.publicKey,
      [],
      amountBn.toNumber()
    ),
    Token.createCloseAccountInstruction(
      TOKEN_PROGRAM_ID,
      account.publicKey,
      wallet.publicKey,
      wallet.publicKey,
      []
    )
  );

  tx.feePayer = wallet.publicKey;
  const { blockhash } = await connection.getRecentBlockhash('recent');
  tx.recentBlockhash = blockhash;
  
  if (signers && signers.length) {
    tx.partialSign(...signers as Signer[]);
  }

  return tx;
}

export const unwrapSol = async(
  connection: Connection,
  wallet: any,
  account: Keypair,
  amount: number
  
): Promise<Transaction> => {

  const amountBn = new BN(amount * LAMPORTS_PER_SOL);
  const signers: Signer[] = [account];
  const minimumWrappedAccountBalance = await Token.getMinBalanceRentForExemptAccount(connection);
  const atokenKey = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    WRAPPED_SOL_MINT,
    wallet.publicKey
  );

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: account.publicKey,
      lamports: minimumWrappedAccountBalance,
      space: AccountLayout.span,
      programId: TOKEN_PROGRAM_ID,
    }),
    Token.createInitAccountInstruction(
      TOKEN_PROGRAM_ID,
      WRAPPED_SOL_MINT,
      account.publicKey,
      wallet.publicKey
    ),
    Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      atokenKey,
      account.publicKey,
      wallet.publicKey,
      [],
      amountBn.toNumber()
    ),
    Token.createCloseAccountInstruction(
      TOKEN_PROGRAM_ID,
      account.publicKey,
      wallet.publicKey,
      wallet.publicKey,
      []
    )
  );

  tx.feePayer = wallet.publicKey;
  const { blockhash } = await connection.getRecentBlockhash('recent');
  tx.recentBlockhash = blockhash;
  
  if (signers && signers.length) {
    tx.partialSign(...signers as Signer[]);
  }

  return tx;
}

export * from "./types";
export * from "./data";
export * from "./layouts";
export * from "./raydium/client";
export * from "./mercurial/client";
export * from "./orca/client";
export * from "./saber/client";
export * from "./serum/client";