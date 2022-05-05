import { initializeAccount } from "@project-serum/serum/lib/token-instructions";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  AccountInfo,
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  Signer,
  SystemProgram,
  Transaction

} from "@solana/web3.js";

import { ExchangeInfo, LPClient, NATIVE_SOL_MINT, WRAPPED_SOL_MINT } from "./types";
import { AMM_POOLS } from "./data";
import { ACCOUNT_LAYOUT } from "./layouts";
// import { MercurialClient } from "./mercurial/client";
import { OrcaClient } from "./orca/client";
import { RaydiumClient } from "./raydium/client";
import { SaberClient } from "./saber/client";
import { SerumClient } from "./serum/client";
import { AmmPoolInfo, Client, MERCURIAL, ORCA, RAYDIUM, SABER, SERUM } from "./types";

export async function getMultipleAccounts(
  connection: Connection,
  publicKeys: PublicKey[],
  commitment?: Commitment

): Promise<Array<null | { publicKey: PublicKey; account: AccountInfo<Buffer> }>> {

  const keys: PublicKey[][] = [];
  let tempKeys: PublicKey[] = [];

  publicKeys.forEach((k) => {
    if (tempKeys.length >= 100) {
      keys.push(tempKeys);
      tempKeys = [];
    }
    tempKeys.push(k);
  });

  if (tempKeys.length > 0) {
    keys.push(tempKeys);
  }

  const accounts: Array<null | {
    executable: any;
    owner: PublicKey;
    lamports: any;
    data: Buffer;
  }> = [];

  const resArray: { [key: number]: any } = {};

  await Promise.all(
    keys.map(async (key, index) => {
      const res = await connection.getMultipleAccountsInfo(key, commitment);
      resArray[index] = res;
    })
  );

  Object.keys(resArray)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .forEach((itemIndex) => {
      const res = resArray[parseInt(itemIndex)];
      for (const account of res) {
        accounts.push(account);
      }
    });

  return accounts.map((account, idx) => {
    if (account === null) {
      return null;
    }
    return {
      publicKey: publicKeys[idx],
      account,
    };
  });
}

export async function createProgramAccountIfNotExist(
  connection: Connection,
  account: string | undefined | null,
  owner: PublicKey,
  programId: PublicKey,
  lamports: number | null,
  layout: any,
  transaction: Transaction,
  signer: Signer[]

) {

  let publicKey;

  if (account) {
    publicKey = new PublicKey(account);
  } else {
    const newAccount = Keypair.generate();
    publicKey = newAccount.publicKey;

    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: owner,
        newAccountPubkey: publicKey,
        lamports: lamports ?? (await connection.getMinimumBalanceForRentExemption(layout.span)),
        space: layout.span,
        programId
      })
    );

    signer.push(newAccount);
  }

  return publicKey;
}

export async function createTokenAccountIfNotExist(
  connection: Connection,
  account: string | undefined | null,
  owner: PublicKey,
  mintAddress: string,
  lamports: number | null,
  transaction: Transaction,
  signer: Array<Signer>

) {
  let publicKey;

  if (account) {
    publicKey = new PublicKey(account);
  } else {
    publicKey = await createProgramAccountIfNotExist(
      connection,
      account,
      owner,
      TOKEN_PROGRAM_ID,
      lamports,
      ACCOUNT_LAYOUT,
      transaction,
      signer
    );

    transaction.add(
      initializeAccount({
        account: publicKey,
        mint: new PublicKey(mintAddress),
        owner
      })
    );
  }

  return publicKey;
}

export const getProtocolClient = (
  connection: Connection,
  pool: AmmPoolInfo

): Client => {

  let client: any = undefined;

  switch (pool.protocolAddress) {
    case RAYDIUM.toBase58(): {
      client = new RaydiumClient(connection, pool.address);
      break;
    }
    case ORCA.toBase58(): {
      client = new OrcaClient(connection, pool.address);
      break;
    }
    case SABER.toBase58(): {
      client = new SaberClient(connection, pool.address);
      break;
    }
    case MERCURIAL.toBase58(): {
      // client = new MercurialClient(connection, pool.address);
      break;
    }
    case SERUM.toBase58(): {
      client = new SerumClient(connection, pool.address);
      break;
    }
    default: {
      break;
    }
  }

  return client;
}

export const getAmmPools = (
  from: string,
  to: string,
  protocol?: string | undefined,

): AmmPoolInfo[] => {

  return AMM_POOLS.filter((ammPool) => {

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

    let included = fromIncluded && toIncluded;

    if (protocol && ammPool.protocolAddress !== protocol) {
      included = false;
    }

    return included;

  });
}

export const getBestClients = async (
  connection: Connection,
  from: string,
  to: string,
  pools: AmmPoolInfo[]

): Promise<Client[]> => {

  let clients: Client[] = [];
  let promises: Promise<Client | null>[] = [];  
  
  for (let pool of pools) {

    let promise: () => Promise<Client>;

    const client = getProtocolClient(
      connection,
      pool
    );

    const isSerumClient = client.protocol.equals(SERUM);
      
    if (isSerumClient) {

      promise = async () => {
        const serumClient = (client as SerumClient);
        try { 
          await serumClient.updateExchange(from, to, 1, 1);
          const isFromSol = from === NATIVE_SOL_MINT.toBase58() || from === WRAPPED_SOL_MINT.toBase58();
          const isToSol = to === NATIVE_SOL_MINT.toBase58() || to === WRAPPED_SOL_MINT.toBase58();
          if (isFromSol || isToSol) {
            serumClient.exchange = undefined;
          }
        } 
        catch (error) { console.log(error); }
        return serumClient;
      };

    } else {

      promise = async () => {
        const lpClient = (client as LPClient);
        try { await lpClient.updateExchange(from, to, 1, 1); } 
        catch (error) { console.log(error); }
        return lpClient;
      };
    }

    promises.push(promise());
  }
  
  clients = await Promise.all(promises) as Client[];

  const sortByOutAmount = (
    first: ExchangeInfo | undefined, 
    second: ExchangeInfo | undefined

  ) => {

    let result = 0;

    if (!first) { 
      result = -1;
    } else if (!second) {
      result = 1;
    } else {

      const firstAmountOut = first.amountOut || 0;
      const secondAmountOut = second.amountOut || 0;

      if (firstAmountOut >= secondAmountOut) {
        result = 1; 
      } else {
        result = -1;
      }
    }

    return result;
  };

  clients.sort((a, b) => sortByOutAmount(b?.exchange, a?.exchange));

  return clients;
}