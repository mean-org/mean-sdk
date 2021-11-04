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
import { ExchangeInfo, LPClient } from ".";

import { ACCOUNT_LAYOUT } from "./layouts";
import { MercurialClient } from "./mercurial/client";
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

export async function getOptimalPools(
  connection: Connection,
  from: string,
  to: string,
  pools: AmmPoolInfo[]

): Promise<AmmPoolInfo[]> {

  let orderedPools: AmmPoolInfo[] = [];
  
  for (let pool of pools) {
    
    let exchangeInfo: ExchangeInfo | undefined;

    const client = getProtocolClient(
      connection,
      pool.protocolAddress
    );

    const isSerumClient = client.protocolAddress === SERUM.toBase58();
      
    if (isSerumClient) {

      const serumClient = (client as SerumClient);
      const serumMarket = await serumClient.getMarketInfo(from, to);

      if (!serumMarket) {
        throw Error('Serum market not found');
      }

      exchangeInfo = await client.getExchangeInfo(from, to, 1, 1);

    } else {

      const lpClient = (client as LPClient);
      const clientPool = await lpClient.getPoolInfo(pool.address);

      if (!clientPool) {
        throw Error('Pool not found');
      }

      exchangeInfo = await lpClient.getExchangeInfo(from, to, 1, 1);
    }

    orderedPools.push(
      Object.assign({ }, 
        pool,
        { 
          exchangeInfo 
        }
      )
    );
  }

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

  const sortByProtocolFees = (
    first: ExchangeInfo | undefined, 
    second: ExchangeInfo | undefined

  ) => {

    let result = 0;

    if (!first) { 
      result = -1;
    } else if (!second) {
      result = 1;
    } else if (first.protocolFees >= second.protocolFees) {
      result = 1; 
    } else {
      result = -1;
    }

    return result;
  };

  const sortByNetworkFees = (
    first: ExchangeInfo | undefined, 
    second: ExchangeInfo | undefined

  ) => {

    let result = 0;

    if (!first) { 
      result = -1;
    } else if (!second) {
      result = 1;
    } else if (first.networkFees >= second.networkFees) {
      result = 1; 
    } else {
      result = -1;
    }

    return result;
  };

  orderedPools.sort((a, b) => sortByOutAmount(b.exchangeInfo, a.exchangeInfo));
  orderedPools.sort((a, b) => sortByProtocolFees(b.exchangeInfo, a.exchangeInfo));
  orderedPools.sort((a, b) => sortByNetworkFees(b.exchangeInfo, a.exchangeInfo));  

  return orderedPools;
}