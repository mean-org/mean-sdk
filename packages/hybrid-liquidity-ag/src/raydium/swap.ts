import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Account, Connection, PublicKey, Signer, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { WRAPPED_SOL_MINT } from "../types";
import { TokenAmount } from "../safe-math";
import { ACCOUNT_LAYOUT } from "../layouts";
import BN from "bn.js";

const BufferLayout = require('buffer-layout');

export const getSwapTx = async (
  connection: Connection,
  owner: PublicKey,
  poolInfo: any,
  fromCoinMint: PublicKey,
  toCoinMint: PublicKey,
  fromTokenAccount: PublicKey,
  toTokenAccount: PublicKey,
  fromAmount: BN,
  toSwapAmount: BN,
  feeAccount: PublicKey,
  fee: BN

): Promise<{ transaction: Transaction, signers: Signer[] }> => {

  const tx = new Transaction()
  const signers = new Array<Signer>();
  let wrappedSolAccount: Account | null = null;
  let wrappedSolAccount2: Account | null = null;

  if (fromCoinMint.equals(WRAPPED_SOL_MINT)) {

    wrappedSolAccount = new Account();

    tx.add(
      SystemProgram.createAccount({
        fromPubkey: owner,
        newAccountPubkey: wrappedSolAccount.publicKey,
        lamports: fromAmount.toNumber() + 1e7,
        space: ACCOUNT_LAYOUT.span,
        programId: TOKEN_PROGRAM_ID,
      }),
      Token.createInitAccountInstruction(
        TOKEN_PROGRAM_ID,
        WRAPPED_SOL_MINT,
        wrappedSolAccount.publicKey,
        owner
      )
    );

    signers.push(wrappedSolAccount);
  }

  if (toCoinMint.equals(WRAPPED_SOL_MINT)) {

    wrappedSolAccount2 = new Account();

    tx.add(
      SystemProgram.createAccount({
        fromPubkey: owner,
        newAccountPubkey: wrappedSolAccount2.publicKey,
        lamports: 1e7,
        space: ACCOUNT_LAYOUT.span,
        programId: TOKEN_PROGRAM_ID,
      }),
      Token.createInitAccountInstruction(
        TOKEN_PROGRAM_ID,
        WRAPPED_SOL_MINT,
        wrappedSolAccount2.publicKey,
        owner
      )
    );

    signers.push(wrappedSolAccount2);
  }

  const fromTokenAccountInfo = await connection.getAccountInfo(fromTokenAccount);

  if (!fromTokenAccountInfo) {
    tx.add(
      Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        fromCoinMint,
        fromTokenAccount,
        owner,
        owner
      )
    );
  }

  const toTokenAccountInfo = await connection.getAccountInfo(toTokenAccount);

  if (!toTokenAccountInfo) {
    tx.add(
      Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        toCoinMint,
        toTokenAccount,
        owner,
        owner
      )
    );
  }

  // Swap ix
  tx.add(
    getSwapIx(
      new PublicKey(poolInfo.programId),
      new PublicKey(poolInfo.ammId),
      new PublicKey(poolInfo.ammAuthority),
      new PublicKey(poolInfo.ammOpenOrders),
      new PublicKey(poolInfo.ammTargetOrders),
      new PublicKey(poolInfo.poolCoinTokenAccount),
      new PublicKey(poolInfo.poolPcTokenAccount),
      new PublicKey(poolInfo.serumProgramId),
      new PublicKey(poolInfo.serumMarket),
      new PublicKey(poolInfo.serumBids),
      new PublicKey(poolInfo.serumAsks),
      new PublicKey(poolInfo.serumEventQueue),
      new PublicKey(poolInfo.serumCoinVaultAccount),
      new PublicKey(poolInfo.serumPcVaultAccount),
      new PublicKey(poolInfo.serumVaultSigner),
      wrappedSolAccount ? wrappedSolAccount.publicKey : fromTokenAccount,
      wrappedSolAccount2 ? wrappedSolAccount2.publicKey : toTokenAccount,
      owner,
      fromAmount.toNumber(),
      toSwapAmount.toNumber()
    )
  )

  // Transfer fees
  const feeAccountToken = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    fromCoinMint,
    feeAccount,
    true
  );

  const feeAccountTokenInfo = await connection.getAccountInfo(feeAccountToken);

  if (!feeAccountTokenInfo) {
    tx.add(
      Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        fromCoinMint,
        feeAccountToken,
        feeAccount,
        owner
      )
    );
  }

  if (wrappedSolAccount) {
    tx.add(
      Token.createTransferInstruction(
        TOKEN_PROGRAM_ID,
        wrappedSolAccount.publicKey,
        feeAccountToken,
        owner,
        [],
        fee.toNumber()
      ),
      Token.createCloseAccountInstruction(
        TOKEN_PROGRAM_ID,
        wrappedSolAccount.publicKey,
        owner,
        owner,
        []
      )
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

  if (wrappedSolAccount2) {
    tx.add(
      Token.createCloseAccountInstruction(
        TOKEN_PROGRAM_ID,
        wrappedSolAccount2.publicKey,
        owner,
        owner,
        []
      )
    );
  }

  return { transaction: tx, signers };
}

export function getSwapIx(
  programId: PublicKey,
  // tokenProgramId: PublicKey,
  // amm
  ammId: PublicKey,
  ammAuthority: PublicKey,
  ammOpenOrders: PublicKey,
  ammTargetOrders: PublicKey,
  poolCoinTokenAccount: PublicKey,
  poolPcTokenAccount: PublicKey,
  // serum
  serumProgramId: PublicKey,
  serumMarket: PublicKey,
  serumBids: PublicKey,
  serumAsks: PublicKey,
  serumEventQueue: PublicKey,
  serumCoinVaultAccount: PublicKey,
  serumPcVaultAccount: PublicKey,
  serumVaultSigner: PublicKey,
  // user
  userSourceTokenAccount: PublicKey,
  userDestTokenAccount: PublicKey,
  userOwner: PublicKey,
  amountIn: number,
  minAmountOut: number

): TransactionInstruction {

  const dataLayout = BufferLayout.struct([
    BufferLayout.u8('instruction'), 
    BufferLayout.nu64('amountIn'), 
    BufferLayout.nu64('minAmountOut')
  ]);

  const keys = [
    // spl token
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    // amm
    { pubkey: ammId, isSigner: false, isWritable: true },
    { pubkey: ammAuthority, isSigner: false, isWritable: false },
    { pubkey: ammOpenOrders, isSigner: false, isWritable: true },
    { pubkey: ammTargetOrders, isSigner: false, isWritable: true },
    { pubkey: poolCoinTokenAccount, isSigner: false, isWritable: true },
    { pubkey: poolPcTokenAccount, isSigner: false, isWritable: true },
    // serum
    { pubkey: serumProgramId, isSigner: false, isWritable: false },
    { pubkey: serumMarket, isSigner: false, isWritable: true },
    { pubkey: serumBids, isSigner: false, isWritable: true },
    { pubkey: serumAsks, isSigner: false, isWritable: true },
    { pubkey: serumEventQueue, isSigner: false, isWritable: true },
    { pubkey: serumCoinVaultAccount, isSigner: false, isWritable: true },
    { pubkey: serumPcVaultAccount, isSigner: false, isWritable: true },
    { pubkey: serumVaultSigner, isSigner: false, isWritable: false },
    { pubkey: userSourceTokenAccount, isSigner: false, isWritable: true },
    { pubkey: userDestTokenAccount, isSigner: false, isWritable: true },
    { pubkey: userOwner, isSigner: true, isWritable: false }
  ];

  const data = Buffer.alloc(dataLayout.span);
  dataLayout.encode(
    {
      instruction: 9,
      amountIn,
      minAmountOut
    },
    data
  );

  return new TransactionInstruction({
    keys,
    programId,
    data
  });
}

export function getSwapOutAmount(
  poolInfo: any,
  fromCoinMint: string,
  toCoinMint: string,
  amount: string,
  slippage: number

) {
  const { coin, pc, fees } = poolInfo;
  const { swapFeeNumerator, swapFeeDenominator } = fees;

  if (fromCoinMint === coin.address && toCoinMint === pc.address) {
    // coin2pc
    const fromAmount = new TokenAmount(amount, coin.decimals, false)
    const fromAmountWithFee = fromAmount.wei
      .multipliedBy(swapFeeDenominator - swapFeeNumerator)
      .dividedBy(swapFeeDenominator);

    const denominator = coin.balance.wei.plus(fromAmountWithFee);
    const amountOut = pc.balance.wei.multipliedBy(fromAmountWithFee).dividedBy(denominator);
    const amountOutWithSlippage = amountOut.dividedBy(1 + slippage / 100);
    const outBalance = pc.balance.wei.minus(amountOut);

    const beforePrice = new TokenAmount(
      parseFloat(new TokenAmount(pc.balance.wei, pc.decimals).fixed()) /
        parseFloat(new TokenAmount(coin.balance.wei, coin.decimals).fixed()),
      pc.decimals,
      false
    );

    const afterPrice = new TokenAmount(
      parseFloat(new TokenAmount(outBalance, pc.decimals).fixed()) /
        parseFloat(new TokenAmount(denominator, coin.decimals).fixed()),
      pc.decimals,
      false
    );

    const priceImpact = 
        ((parseFloat(beforePrice.fixed()) - parseFloat(afterPrice.fixed())) / parseFloat(beforePrice.fixed())) * 100;

    return {
      amountIn: fromAmount,
      amountOut: new TokenAmount(amountOut, pc.decimals),
      amountOutWithSlippage: new TokenAmount(amountOutWithSlippage, pc.decimals),
      priceImpact
    };

  } else {
    // pc2coin
    const fromAmount = new TokenAmount(amount, pc.decimals, false);
    const fromAmountWithFee = fromAmount.wei
      .multipliedBy(swapFeeDenominator - swapFeeNumerator)
      .dividedBy(swapFeeDenominator);

    const denominator = pc.balance.wei.plus(fromAmountWithFee);
    const amountOut = coin.balance.wei.multipliedBy(fromAmountWithFee).dividedBy(denominator);
    const amountOutWithSlippage = amountOut.dividedBy(1 + slippage / 100);
    const outBalance = coin.balance.wei.minus(amountOut);

    const beforePrice = new TokenAmount(
      parseFloat(new TokenAmount(pc.balance.wei, pc.decimals).fixed()) /
        parseFloat(new TokenAmount(coin.balance.wei, coin.decimals).fixed()),
      pc.decimals,
      false
    );

    const afterPrice = new TokenAmount(
      parseFloat(new TokenAmount(denominator, pc.decimals).fixed()) /
        parseFloat(new TokenAmount(outBalance, coin.decimals).fixed()),
      pc.decimals,
      false
    );

    const priceImpact =
      ((parseFloat(afterPrice.fixed()) - parseFloat(beforePrice.fixed())) / parseFloat(beforePrice.fixed())) * 100;

    return {
      amountIn: fromAmount,
      amountOut: new TokenAmount(amountOut, coin.decimals),
      amountOutWithSlippage: new TokenAmount(amountOutWithSlippage, coin.decimals),
      priceImpact
    };
  }
}