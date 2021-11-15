import { AmmPoolInfo, Client, SERUM, WRAPPED_SOL_MINT } from "./types";
import { Connection, Keypair, LAMPORTS_PER_SOL, Signer, SystemProgram, Transaction } from "@solana/web3.js";
import { AccountLayout, ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getAmmPools, getBestClients } from "./utils";
import BN from "bn.js";
import { getMarket } from "./serum/utils";

export const getClients = async (
  connection: Connection,
  from: string,
  to: string,
  protocol?: string | undefined,

): Promise<Client[]> => {

  const pools = [
    ...getAmmPools(
      from,
      to,
      protocol
    )
  ];

  console.log('pools', pools);

  const market = await getMarket(connection, from, to);

  if (market) {
    pools.push({
      protocolAddress: SERUM.toBase58(),
      address: market.ownAddress.toBase58(),
      chainId: 101,
      tokenAddresses: [from, to]

    } as AmmPoolInfo);
  }

  if (pools.length === 0) {
    throw new Error("Pool not found");
  }

  return await getBestClients(connection, from, to, pools);
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