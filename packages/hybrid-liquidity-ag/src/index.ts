import { AmmPoolInfo, Client, MERCURIAL, ORCA, RAYDIUM, SABER, SERUM } from "./types";
import { AMM_POOLS } from "./data";
import { NATIVE_SOL_MINT, WRAPPED_SOL_MINT } from "./types";
import { Connection, Keypair, LAMPORTS_PER_SOL, Signer, SystemProgram, Transaction } from "@solana/web3.js";
import { AccountLayout, ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { RaydiumClient } from "./raydium/client";
import { OrcaClient } from "./orca/client";
import { SerumClient } from "./serum/client";
import { SaberClient } from "./saber/client";
import { MercurialClient } from "./mercurial/client";
import BN from "bn.js";

export const getClient = (
  connection: Connection,
  protocolAddress: string

): Client => {

  let client: any = undefined;

  switch (protocolAddress) {
    case RAYDIUM.toBase58(): {
      client = new RaydiumClient(connection);
      break;
    }
    case ORCA.toBase58(): {
      client = new OrcaClient(connection);
      break;
    }
    case SABER.toBase58(): {
      client = new SaberClient(connection);
      break;
    }
    case MERCURIAL.toBase58(): {
      client = new MercurialClient(connection);
      break;
    }
    case SERUM.toBase58(): {
      client = new SerumClient(connection);
      break;
    }
    default: { break; }
  }

  return client;
}

export const getTokensPools = (
  from: string,
  to: string,
  protocolAddres?: string

): AmmPoolInfo[] => {

  return AMM_POOLS.filter((ammPool) => {

    let fromMint = from;
    let toMint = to;

    if (from === NATIVE_SOL_MINT.toBase58()) {
      fromMint = WRAPPED_SOL_MINT.toBase58();
    }

    if (to === NATIVE_SOL_MINT.toBase58()) {
      toMint = WRAPPED_SOL_MINT.toBase58();
    }

    let include = (
      ammPool.tokenAddresses.includes(fromMint) &&
      ammPool.tokenAddresses.includes(toMint)
    );

    if (protocolAddres !== undefined) {
      include = ammPool.protocolAddress === protocolAddres;
    }

    return include;
  });
}

export const getOptimalPool = (
  pools: AmmPoolInfo[]

): AmmPoolInfo => {

  if (pools.length === 1) {
    return pools[0];
  }

  //TODO: implement get the best pool

  return pools[0];
}

export const getExchangeInfo = async (
  client: Client,
  from: string,
  to: string, 
  amount: number,
  slippage: number

) => {

  return client.getExchangeInfo(
    from,
    to,
    amount,
    slippage
  );
}

export const wrap = async (
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

export const unwrap = async(
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
export * from "./raydium/client";
export * from "./mercurial/client";
export * from "./orca/client";
export * from "./saber/client";
export * from "./serum/client";