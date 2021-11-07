import { Market } from "@project-serum/serum";
import { OpenOrders, _OPEN_ORDERS_LAYOUT_V2 } from "@project-serum/serum/lib/market";
import { closeAccount } from "@project-serum/serum/lib/token-instructions";
import { AccountLayout, ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Account, Connection, LAMPORTS_PER_SOL, PublicKey, Signer, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction } from "@solana/web3.js";
import { getTokenByMintAddress } from "../raydium/utils";
import { NATIVE_SOL_MINT, SERUM_PROGRAM_ID_V3, WRAPPED_SOL_MINT } from "../types";
import { createTokenAccountIfNotExist } from "../utils";
import BN from "bn.js";

export const placeOrderTx = async (
  connection: Connection,
  owner: PublicKey,
  market: Market,
  asks: any,
  bids: any,
  fromCoinMint: PublicKey,
  toCoinMint: PublicKey,
  fromTokenAccount: PublicKey,
  toTokenAccount: PublicKey,
  fromAmount: BN,
  slippage: number,
  feeAccount: PublicKey,
  fee: BN
  
): Promise<{ transaction: Transaction, signers: Signer[] }> => {
    
  const tx = new Transaction();
  const signers: Signer[] = [];
  const fromMintAccount = getTokenByMintAddress(fromCoinMint.toBase58());
  const toMintAccount = getTokenByMintAddress(toCoinMint.toBase58());
  const swapAmount = fromAmount.toNumber() / 10 ** (fromMintAccount?.decimals || 9);

  console.log('swapAmount.toString()', swapAmount.toString());

  const forecastConfig = getOutAmount(
    market,
    asks,
    bids,
    fromCoinMint.toBase58(),
    toCoinMint.toBase58(),
    swapAmount.toString(), //fromAmount.sub(fee).toNumber().toString(),
    slippage
  );

  const serumProgramId = new PublicKey(SERUM_PROGRAM_ID_V3);
  const openOrdersAccounts = await market.findOpenOrdersAccountsForOwner(
    connection,
    owner,
    0
  );
  
  let openOrdersAddress: PublicKey;

  if (openOrdersAccounts.length > 0) {
    openOrdersAddress = openOrdersAccounts[0].address;
  } else {
    const openOrderNewAccount = new Account(); //Keypair.generate();
    openOrdersAddress = openOrderNewAccount.publicKey;

    tx.add(
      SystemProgram.createAccount({
        fromPubkey: owner,
        newAccountPubkey: openOrdersAddress,
        lamports: await connection.getMinimumBalanceForRentExemption(
          _OPEN_ORDERS_LAYOUT_V2.span
        ),
        space: _OPEN_ORDERS_LAYOUT_V2.span,
        programId: serumProgramId,
      })
    );

    signers.push(openOrderNewAccount);
  }

  let fromMint = fromCoinMint;
  let toMint = toCoinMint;

  if (fromCoinMint.equals(NATIVE_SOL_MINT)) {
    fromMint = WRAPPED_SOL_MINT;
  }

  if (toCoinMint.equals(NATIVE_SOL_MINT)) {
    toMint = WRAPPED_SOL_MINT;
  }

  let wrappedSolAccount: PublicKey | null = null;

  if (fromCoinMint.equals(NATIVE_SOL_MINT)) {
    // let lamports;

    // if (forecastConfig.side === "buy") {

    //   lamports =
    //     forecastConfig.worstPrice *
    //     forecastConfig.amountOut *
    //     1.01 *
    //     LAMPORTS_PER_SOL;

    //   if (openOrdersAccounts.length > 0) {
    //     lamports -= openOrdersAccounts[0].baseTokenFree.toNumber();
    //   }

    // } else {
        
    //   lamports = forecastConfig.maxInAllow * LAMPORTS_PER_SOL;

    //   if (openOrdersAccounts.length > 0) {
    //     lamports -= openOrdersAccounts[0].baseTokenFree.toNumber();
    //   }
    // }

    let lamports = swapAmount * LAMPORTS_PER_SOL + await Token.getMinBalanceRentForExemptAccount(connection);

    if (openOrdersAccounts.length > 0) {
      lamports -= openOrdersAccounts[0].baseTokenFree.toNumber();
    }

    wrappedSolAccount = await createTokenAccountIfNotExist(
      connection,
      wrappedSolAccount,
      owner,
      WRAPPED_SOL_MINT.toBase58(),
      lamports,
      tx,
      signers
    );
  }

  const fromTokenAccountInfo = await connection.getAccountInfo(fromTokenAccount);

  if (!fromTokenAccountInfo) {
    tx.add(
      Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        fromMint,
        fromTokenAccount,
        owner,
        owner
      )
    );
  }

  console.log('forecastConfig', forecastConfig);
  
  tx.add(
    market.makePlaceOrderInstruction(connection, {
      owner,
      payer: wrappedSolAccount ?? fromTokenAccount,
      side: forecastConfig.side === "buy" ? "buy" : "sell",
      price: forecastConfig.worstPrice,
      size:
        forecastConfig.side === 'buy'
          ? parseFloat(forecastConfig.amountOut.toFixed(fromMintAccount?.decimals || 9))
          : parseFloat(forecastConfig.maxInAllow.toFixed(toMintAccount?.decimals || 9)),

      orderType: 'ioc',
      openOrdersAddressKey: openOrdersAddress
    })
  )

  const toTokenAccountInfo = await connection.getAccountInfo(toTokenAccount);

  if (!toTokenAccountInfo) {
    tx.add(
      Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        toMint,
        toTokenAccount,
        owner,
        owner
      )
    );
  }

  const userAccounts = [fromTokenAccount, toTokenAccount];

  if (
    market.baseMintAddress.equals(toMint) &&
    market.quoteMintAddress.equals(fromMint)
  ) {
    userAccounts.reverse();
  }

  const baseTokenAccount = userAccounts[0];
  const quoteTokenAccount = userAccounts[1];
  let referrerQuoteWallet: PublicKey | null = null;

  if (market.supportsReferralFees) {
    const quoteToken = getTokenByMintAddress(
      market.quoteMintAddress.toBase58()
    );

    if (quoteToken?.referrer) {
      referrerQuoteWallet = new PublicKey(quoteToken?.referrer);
    }
  }

  const settleTx = await market.makeSettleFundsTransaction(
    connection,
    new OpenOrders(
      openOrdersAddress,
      { owner },
      serumProgramId
    ),
    baseTokenAccount,
    quoteTokenAccount,
    referrerQuoteWallet
  );

  signers.push(...settleTx.signers);
  tx.add(settleTx.transaction);

  // Transfer fees
  const feeAccountToken = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    fromMint,
    feeAccount,
    true
  );

  const feeAccountTokenInfo = await connection.getAccountInfo(feeAccountToken);

  if (!feeAccountTokenInfo) {
    Token.createAssociatedTokenAccountInstruction(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      fromCoinMint,
      feeAccountToken,
      owner,
      owner
    )
  }

  if (wrappedSolAccount) {
    tx.add(
      Token.createTransferInstruction(
        TOKEN_PROGRAM_ID,
        wrappedSolAccount,
        feeAccountToken,
        owner,
        [],
        fee.toNumber()
      ),
      closeAccount({
        source: wrappedSolAccount,
        destination: owner,
        owner,
      })
    );
  } else {
    tx.add(
      Token.createTransferInstruction(
        TOKEN_PROGRAM_ID,
        fromTokenAccount,
        feeAccountToken,
        owner,
        [],
        fee.toNumber()
      )
    );
  }

  return { transaction: tx, signers };
}

export const getOutAmount = (
  market: any,
  asks: any,
  bids: any,
  fromCoinMint: string,
  toCoinMint: string,
  amount: string,
  slippage: number

) => {

  const fromAmount = amount ? parseFloat(amount) : 1;
  let fromMint = fromCoinMint;
  let toMint = toCoinMint;

  if (fromMint === NATIVE_SOL_MINT.toBase58()) {
    fromMint = WRAPPED_SOL_MINT.toBase58();
  }
  
  if (toMint === NATIVE_SOL_MINT.toBase58()) {
    toMint = WRAPPED_SOL_MINT.toBase58();
  }

  if (
    fromMint === market.quoteMintAddress.toBase58() &&
    toMint === market.baseMintAddress.toBase58()
  ) {
    // buy
    return forecastBuy(market, asks, fromAmount, slippage);
  } else {
    return forecastSell(market, bids, fromAmount, slippage);
  }
}

export const forecastBuy = (
  market: any,
  orderBook: any,
  amount: number,
  slippage: number

) => {

  let coinOut = 0;
  let bestPrice = null;
  let worstPrice = 0;
  let availablePc = amount;

  for (const { key, quantity } of orderBook.items(false)) {
    const price = market.priceLotsToNumber(key.ushrn(64)) || 0;
    const size = market.baseSizeLotsToNumber(quantity) || 0;

    if (!bestPrice && price !== 0) {
      bestPrice = price;
    }

    const orderPcVaule = price * size;
    worstPrice = price;

    if (orderPcVaule >= availablePc) {
      coinOut += availablePc / price;
      availablePc = 0;
      break;
    } else {
      coinOut += size;
      availablePc -= orderPcVaule;
    }
  }

  // coinOut = coinOut * 0.993;
  const priceImpact = ((worstPrice - bestPrice) / bestPrice) * 100;
  worstPrice = (worstPrice * (100 - slippage)) / 100;
  const amountOutWithSlippage = (coinOut * (100 - slippage)) / 100;
  // const avgPrice = (pcIn - availablePc) / coinOut;
  const maxInAllow = amount - availablePc;

  return {
    side: "buy",
    maxInAllow: maxInAllow === 0 ? amount : maxInAllow,
    amountOut: coinOut,
    amountOutWithSlippage,
    worstPrice,
    priceImpact,
  };
};

export const forecastSell = (
  market: any,
  orderBook: any,
  amount: number,
  slippage: number

) => {

  let pcOut = 0;
  let bestPrice = null;
  let worstPrice = 0;
  let availableCoin = amount;

  for (const { key, quantity } of orderBook.items(true)) {
    const price = market.priceLotsToNumber(key.ushrn(64));
    const size = market.baseSizeLotsToNumber(quantity);

    if (!bestPrice && price !== 0) {
      bestPrice = price;
    }

    worstPrice = price;

    if (availableCoin < size) {
      pcOut += availableCoin * price;
      availableCoin = amount;
      break;
    } else {
      pcOut += price * size;
      availableCoin -= size;
    }
  }

  // pcOut = pcOut * 0.993;
  const priceImpact = ((bestPrice - worstPrice) / bestPrice) * 100;
  worstPrice = (worstPrice * (100 - slippage)) / 100;
  const amountOutWithSlippage = (pcOut * (100 - slippage)) / 100;
  // const avgPrice = pcOut / (coinIn - availableCoin);
  const maxInAllow = amount - availableCoin;

  return {
    side: "sell",
    maxInAllow: maxInAllow === 0 ? amount : maxInAllow,
    amountOut: pcOut,
    amountOutWithSlippage,
    worstPrice,
    priceImpact,
  };
}
