import {
	SYSVAR_RENT_PUBKEY,
	SystemProgram,
	PublicKey,
	Keypair,
    Signer,
    Connection,
    Transaction,
    TransactionInstruction,
    AccountMeta,
} from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as anchor from "@project-serum/anchor";
import { Wallet } from "@project-serum/anchor/src/provider";
import * as idl1 from './idl.json'; // force idl.json to the build output './lib' folder
import { ProgramAccount } from '@project-serum/anchor';
import { DdcaAccount, DdcaDetails } from '.';
const idl = require('./idl.json');

// CONSTANTS
const SYSTEM_PROGRAM_ID = anchor.web3.SystemProgram.programId;
const LAMPORTS_PER_SOL = anchor.web3.LAMPORTS_PER_SOL;
const DDCA_OPERATING_ACCOUNT_ADDRESS = new PublicKey("6u1Hc9AqC6AvpYDQcFjhMVqAwcQ83Kn5TVm6oWMjDDf1");
const HLA_PROGRAM_ADDRESS = new PublicKey("EPa4WdYPcGGdwEbq425DMZukU2wDUE1RWAGrPbRYSLRE");
const HLA_OPERATING_ACCOUNT_ADDRESS = new PublicKey("FZMd4pn9FsvMC55D4XQfaexJvKBtQpVuqMk5zuonLRDX");

/**
 * Anchor based client for the DDCA program
 */
export class DdcaClient {

    public connection: Connection;
    public provider: anchor.Provider;
    public program: anchor.Program;
    private wallet: anchor.Wallet;

    /**
     * Create a DDCA client
     */
    constructor(
        rpcUrl: string,
        anchorWallet: any,
        // commitment: Commitment | string = 'confirmed' as Commitment
        confirmOptions?: anchor.web3.ConfirmOptions
    ) {
        // const confirmationOptions = {
        //     preflightCommitment: commitment, 
        //     commitment: commitment
        // } as anchor.web3.ConfirmOptions;
        // const provider = this.getAnchorProvider(rpcUrl, anchorWallet, confirmationOptions as anchor.web3.Connection);
        this.wallet = anchorWallet;
        const provider = this.getAnchorProvider(rpcUrl, anchorWallet, confirmOptions);
        this.provider = provider;
        this.connection = provider.connection;
        anchor.setProvider(provider);

        const programId = new anchor.web3.PublicKey(idl.metadata.address);
        this.program = new anchor.Program(idl, programId, provider); 
    }

    private getAnchorProvider(
        rpcUrl: string,
        // commitment: Commitment | string = 'confirmed',
        anchorWallet: Wallet,
        opts?: anchor.web3.ConfirmOptions) {

        opts = opts ?? anchor.Provider.defaultOptions();
        const connection = new Connection(rpcUrl, opts.preflightCommitment);
        const provider = new anchor.Provider(
            connection, anchorWallet, opts,
        );
        return provider;
    }

    public async createDdcaTx(
        ownerAccountAddress: PublicKey,
        fromMint: PublicKey,
        toMint: PublicKey,
        depositAmount: number,
        amountPerSwap: number,
        intervalInSeconds: number
    ): Promise<[PublicKey, Transaction]> {

        const blockHeight = await this.connection.getSlot('confirmed');
        const blockHeightBn = new anchor.BN(blockHeight);
        console.log("blockHeightBn", blockHeightBn);
        // const blockHeightBytes = blockHeightBn.toBuffer('be', 8);
        const blockHeightBytes = blockHeightBn.toArrayLike(Buffer, 'be', 8);

        //ddca account pda and bump
        const [ddcaAccountPda, ddcaAccountPdaBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                ownerAccountAddress.toBuffer(),
                blockHeightBytes,
                Buffer.from(anchor.utils.bytes.utf8.encode("ddca-seed")),
            ],
            this.program.programId
        );

        //owner token account (from)
        const ownerFromTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            fromMint,
            ownerAccountAddress,
        );

        //ddca associated token account (from)
        const ddcaFromTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            fromMint,
            ddcaAccountPda,
            true,
        );
        //ddca associated token account (to)
        const ddcaToTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            toMint,
            ddcaAccountPda,
            true,
        );

        //ddca operating token account (from)
        const ddcaOperatingFromTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            fromMint,
            DDCA_OPERATING_ACCOUNT_ADDRESS,
        );

        //hla operating token account (from)
        const hlaOperatingFromTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            fromMint,
            HLA_OPERATING_ACCOUNT_ADDRESS,
        );

        // Instructions
        let ixs: Array<TransactionInstruction> | undefined = new Array<TransactionInstruction>();

        let ddcaOperatingFromAtaCreateInstruction = await createAtaCreateInstructionIfNotExists(
            ddcaOperatingFromTokenAccountAddress,
            fromMint,
            DDCA_OPERATING_ACCOUNT_ADDRESS,
            ownerAccountAddress,
            this.connection);
        if (ddcaOperatingFromAtaCreateInstruction !== null)
            ixs.push(ddcaOperatingFromAtaCreateInstruction);

        let ownerFromAtaCreateInstruction = await createAtaCreateInstructionIfNotExists(
            ownerFromTokenAccountAddress,
            fromMint,
            ownerAccountAddress,
            ownerAccountAddress,
            this.connection);
        if (ownerFromAtaCreateInstruction !== null)
            ixs.push(ownerFromAtaCreateInstruction);

        if(ixs.length === 0)
            ixs = undefined;

        console.log("TEST PARAMETERS:")
        console.log("  Program ID:                           " + this.program.programId);
        console.log("  payer.address:                        " + ownerAccountAddress);
        console.log("  fromMint:                             " + fromMint);
        console.log("  toMint:                               " + toMint);
        console.log("  blockHeight:                          " + blockHeight);
        console.log();
        console.log("  ownerAccountAddress:                  " + ownerAccountAddress);
        console.log("  ownerFromTokenAccountAddress:         " + ownerFromTokenAccountAddress);
        console.log();
        console.log("  ddcaAccountPda:                       " + ddcaAccountPda);
        console.log("  ddcaAccountPdaBump:                   " + ddcaAccountPdaBump);
        console.log("  ddcaFromTokenAccountAddress:          " + ddcaFromTokenAccountAddress);
        console.log("  ddcaToTokenAccountAddress:            " + ddcaToTokenAccountAddress);
        console.log();
        console.log("  DDCA_OPERATING_ACCOUNT_ADDRESS:       " + DDCA_OPERATING_ACCOUNT_ADDRESS);
        console.log("  ddcaOperatingFromTokenAccountAddress: " + ddcaOperatingFromTokenAccountAddress);
        console.log();
        console.log("  HLA_PROGRAM_ADDRESS:                  " + HLA_PROGRAM_ADDRESS);
        console.log("  HLA_OPERATING_ACCOUNT_ADDRESS:        " + HLA_OPERATING_ACCOUNT_ADDRESS);
        console.log("  hlaOperatingFromTokenAccountAddress:  " + hlaOperatingFromTokenAccountAddress);
        console.log();
        console.log("  SYSTEM_PROGRAM_ID:                    " + SYSTEM_PROGRAM_ID);
        console.log("  TOKEN_PROGRAM_ID:                     " + TOKEN_PROGRAM_ID);
        console.log("  ASSOCIATED_TOKEN_PROGRAM_ID:          " + ASSOCIATED_TOKEN_PROGRAM_ID);
        console.log();  

        const createTx = await this.program.transaction.create(new anchor.BN(blockHeight), ddcaAccountPdaBump,
            new anchor.BN(depositAmount), new anchor.BN(amountPerSwap), new anchor.BN(intervalInSeconds),
            {
                accounts: {
                    // owner
                    ownerAccount: ownerAccountAddress,
                    ownerFromTokenAccount: ownerFromTokenAccountAddress,
                    // ddca
                    ddcaAccount: ddcaAccountPda,
                    fromMint: fromMint,
                    fromTokenAccount: ddcaFromTokenAccountAddress,
                    toMint: toMint,
                    toTokenAccount: ddcaToTokenAccountAddress,
                    operatingAccount: DDCA_OPERATING_ACCOUNT_ADDRESS,
                    operatingFromTokenAccount: ddcaOperatingFromTokenAccountAddress,
                    // system accounts
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                    clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
                    systemProgram: SYSTEM_PROGRAM_ID,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
                },
                // signers: [ownerAccountAddress],
                instructions: ixs,
            }
        );
        
        createTx.feePayer = ownerAccountAddress;
        let hash = await this.connection.getRecentBlockhash(this.connection.commitment);
        createTx.recentBlockhash = hash.blockhash;

        console.log("createTx", createTx);
        return [ddcaAccountPda, createTx];
    }

    public async createWakeAndSwapTx(
        ddcaAccountPda: PublicKey,
        fromMint: PublicKey,
        toMint: PublicKey,
        hlaAmmAccounts: Array<AccountMeta>,
        swapMinimumOutAmount: number,
        swapSlippage: number,
    ): Promise<Transaction> {

        console.log("ddcaAccountPda: %s", ddcaAccountPda.toBase58())

        //ddca associated token account (from)
        const ddcaFromTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            fromMint,
            ddcaAccountPda,
            true,
        );
        //ddca associated token account (to)
        const ddcaToTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            toMint,
            ddcaAccountPda,
            true,
        );

        //ddca operating token account (from)
        const ddcaOperatingFromTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            fromMint,
            DDCA_OPERATING_ACCOUNT_ADDRESS,
        );

        //hla operating token account (from)
        const hlaOperatingFromTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            fromMint,
            HLA_OPERATING_ACCOUNT_ADDRESS,
        );

        console.log("TEST PARAMETERS:")
        console.log("  Program ID:                           " + this.program.programId);
        console.log("  ddcaAccountPda:                       " + ddcaAccountPda);
        console.log("  fromMint:                             " + fromMint);
        console.log("  toMint:                               " + toMint);
        console.log();
        console.log("  ddcaFromTokenAccountAddress:          " + ddcaFromTokenAccountAddress);
        console.log("  ddcaToTokenAccountAddress:            " + ddcaToTokenAccountAddress);
        console.log();
        console.log("  DDCA_OPERATING_ACCOUNT_ADDRESS:       " + DDCA_OPERATING_ACCOUNT_ADDRESS);
        console.log("  ddcaOperatingFromTokenAccountAddress: " + ddcaOperatingFromTokenAccountAddress);
        console.log();
        console.log("  HLA_PROGRAM_ADDRESS:                  " + HLA_PROGRAM_ADDRESS);
        console.log("  HLA_OPERATING_ACCOUNT_ADDRESS:        " + HLA_OPERATING_ACCOUNT_ADDRESS);
        console.log("  hlaOperatingFromTokenAccountAddress:  " + hlaOperatingFromTokenAccountAddress);
        console.log();
        console.log("  SYSTEM_PROGRAM_ID:                    " + SYSTEM_PROGRAM_ID);
        console.log("  TOKEN_PROGRAM_ID:                     " + TOKEN_PROGRAM_ID);
        console.log("  ASSOCIATED_TOKEN_PROGRAM_ID:          " + ASSOCIATED_TOKEN_PROGRAM_ID);
        console.log();

        const wakeAndSwapTx = await this.program.transaction.wakeAndSwap(
            new anchor.BN(swapMinimumOutAmount), swapSlippage,
            {
                accounts: {
                    // ddca
                    ddcaAccount: ddcaAccountPda,
                    fromMint: fromMint,
                    fromTokenAccount: ddcaFromTokenAccountAddress,
                    toMint: toMint,
                    toTokenAccount: ddcaToTokenAccountAddress,
                    // hybrid liquidity aggregator accounts
                    hlaProgram: HLA_PROGRAM_ADDRESS,
                    hlaOperatingAccount: HLA_OPERATING_ACCOUNT_ADDRESS,
                    hlaOperatingFromTokenAccount: hlaOperatingFromTokenAccountAddress,
                    // system accounts
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                    clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
                    systemProgram: SYSTEM_PROGRAM_ID,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
                },
                // signers: [ddcaAccountPda],
                // hybrid liquidity aggregator specific amm pool accounts
                remainingAccounts: hlaAmmAccounts,
            }
        );
        
        wakeAndSwapTx.feePayer = ddcaAccountPda;
        let hash = await this.connection.getRecentBlockhash(this.connection.commitment);
        wakeAndSwapTx.recentBlockhash = hash.blockhash;

        return wakeAndSwapTx;
    }

    public async createCloseTx(
        ownerAccountAddress: PublicKey,
        ddcaAccountPda: PublicKey,
        fromMint: PublicKey,
        toMint: PublicKey,
    ): Promise<Transaction> {

        //owner token account (from)
        const ownerFromTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            fromMint,
            ownerAccountAddress,
        );

        //owner token account (from)
        const ownerToTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            toMint,
            ownerAccountAddress,
        );

        //ddca associated token account (from)
        const ddcaFromTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            fromMint,
            ddcaAccountPda,
            true,
        );
        //ddca associated token account (to)
        const ddcaToTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            toMint,
            ddcaAccountPda,
            true,
        );

        //ddca operating token account (from)
        const ddcaOperatingFromTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            fromMint,
            DDCA_OPERATING_ACCOUNT_ADDRESS,
        );

        //ddca operating token account (from)
        const ddcaOperatingToTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            toMint,
            DDCA_OPERATING_ACCOUNT_ADDRESS,
        );

        // Instructions
        let ixs: Array<TransactionInstruction> | undefined = new Array<TransactionInstruction>();

        let ownerFromAtaCreateInstruction = await createAtaCreateInstructionIfNotExists(
            ownerFromTokenAccountAddress,
            fromMint,
            ownerAccountAddress,
            ownerAccountAddress,
            this.connection);
        if (ownerFromAtaCreateInstruction !== null)
            ixs.push(ownerFromAtaCreateInstruction);

        let ownerToAtaCreateInstruction = await createAtaCreateInstructionIfNotExists(
            ownerToTokenAccountAddress,
            toMint,
            ownerAccountAddress,
            ownerAccountAddress,
            this.connection);
        if (ownerToAtaCreateInstruction !== null)
            ixs.push(ownerToAtaCreateInstruction);

        let ddcaOperatingFromAtaCreateInstruction = await createAtaCreateInstructionIfNotExists(
            ddcaOperatingFromTokenAccountAddress,
            fromMint,
            DDCA_OPERATING_ACCOUNT_ADDRESS,
            ownerAccountAddress,
            this.connection);
        if (ddcaOperatingFromAtaCreateInstruction !== null)
            ixs.push(ddcaOperatingFromAtaCreateInstruction);

        let ddcaOperatingToAtaCreateInstruction = await createAtaCreateInstructionIfNotExists(
            ddcaOperatingToTokenAccountAddress,
            toMint,
            DDCA_OPERATING_ACCOUNT_ADDRESS,
            ownerAccountAddress,
            this.connection);
        if (ddcaOperatingToAtaCreateInstruction !== null)
            ixs.push(ddcaOperatingToAtaCreateInstruction);

        if(ixs.length === 0)
            ixs = undefined;

        console.log("TEST PARAMETERS:")
        console.log("  Program ID:                           " + this.program.programId);
        console.log("  payer.address:                        " + ownerAccountAddress);
        console.log("  fromMint:                             " + fromMint);
        console.log("  toMint:                               " + toMint);
        console.log();
        console.log("  ownerAccountAddress:                  " + ownerAccountAddress);
        console.log("  ownerFromTokenAccountAddress:         " + ownerFromTokenAccountAddress);
        console.log();
        console.log("  ddcaAccountPda:                       " + ddcaAccountPda);
        console.log("  ddcaFromTokenAccountAddress:          " + ddcaFromTokenAccountAddress);
        console.log("  ddcaToTokenAccountAddress:            " + ddcaToTokenAccountAddress);
        console.log();
        console.log("  DDCA_OPERATING_ACCOUNT_ADDRESS:       " + DDCA_OPERATING_ACCOUNT_ADDRESS);
        console.log("  ddcaOperatingFromTokenAccountAddress: " + ddcaOperatingFromTokenAccountAddress);
        console.log();
        console.log("  HLA_PROGRAM_ADDRESS:                  " + HLA_PROGRAM_ADDRESS);
        console.log("  HLA_OPERATING_ACCOUNT_ADDRESS:        " + HLA_OPERATING_ACCOUNT_ADDRESS);
        console.log();
        console.log("  SYSTEM_PROGRAM_ID:                    " + SYSTEM_PROGRAM_ID);
        console.log("  TOKEN_PROGRAM_ID:                     " + TOKEN_PROGRAM_ID);
        console.log("  ASSOCIATED_TOKEN_PROGRAM_ID:          " + ASSOCIATED_TOKEN_PROGRAM_ID);
        console.log();  

        const closeTx = await this.program.transaction.close(
            {
                accounts: {
                    // owner
                    ownerAccount: ownerAccountAddress,
                    ownerFromTokenAccount: ownerFromTokenAccountAddress,
                    ownerToTokenAccount: ownerToTokenAccountAddress,
                    // ddca
                    ddcaAccount: ddcaAccountPda,
                    // fromMint: fromMint,
                    ddcaFromTokenAccount: ddcaFromTokenAccountAddress,
                    // toMint: toMint,
                    ddcaToTokenAccount: ddcaToTokenAccountAddress,
                    operatingAccount: DDCA_OPERATING_ACCOUNT_ADDRESS,
                    operatingFromTokenAccount: ddcaOperatingFromTokenAccountAddress,
                    operatingToTokenAccount: ddcaOperatingToTokenAccountAddress,
                    // system accounts
                    // rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                    // systemProgram: SYSTEM_PROGRAM_ID,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
                instructions: ixs,
            }
        );
        
        closeTx.feePayer = ownerAccountAddress;
        let hash = await this.connection.getRecentBlockhash(this.connection.commitment);
        closeTx.recentBlockhash = hash.blockhash;

        return closeTx;
    }

    public async ListDdcas() {
        
        console.log("before buffer");
        // console.log(this.wallet.publicKey.toBuffer());
        console.log("after buffer");
        console.log("before ddcaAccounts");
        const ddcaAccounts = await this.program.account.ddcaAccount.all(this.wallet.publicKey.toBuffer());
        // const ddcaAccounts = await this.program.account.ddcaAccount.all(anchor.web3.Keypair.generate().publicKey.toBuffer());
        console.log("after ddcaAccounts");
        return ddcaAccounts.map(x => {
            const values: DdcaAccount = {
                id: x.publicKey.toBase58(),
                fromMint: x.account.fromMint.toBase58(),
                toMint: x.account.toMint.toBase58(),
                amountPerSwap: x.account.amountPerSwap.toNumber(),
                totalDepositsAmount: x.account.totalDepositsAmount.toNumber(),
                startTs: x.account.startTs.toNumber(),
                startUtc: tsToUTCString(x.account.startTs.toNumber()),
                intervalInSeconds: x.account.intervalInSeconds.toNumber(),
                lastCompletedSwapTs: x.account.lastCompletedSwapTs.toNumber(),
                lastCompletedSwapUtc: tsToUTCString(x.account.lastCompletedSwapTs.toNumber()),
                isPaused: x.account.isPaused
            };
            return values;
        });
    }

    public async GetDdca(ddcaAddress: PublicKey): Promise<DdcaDetails | null> {

        const ddcaAccount = await this.program.account.ddcaAccount.fetch(ddcaAddress);
        console.log("ddca fetch");
        console.log(ddcaAccount);

        if(ddcaAccount === null)
            return null;

        const fromTokenResponse = await this.connection.getTokenAccountBalance(ddcaAccount.fromTaccAddr);
        const fromTokenBalance = fromTokenResponse.value.uiAmount ?? 0;
        const toTokenResponse = await this.connection.getTokenAccountBalance(ddcaAccount.toTaccAddr);
        const toTokenBalance = toTokenResponse.value.uiAmount ?? 0;

        let startTs = ddcaAccount.startTs.toNumber();
        let interval = ddcaAccount.intervalInSeconds.toNumber();
        let lastCompletedSwapTs = ddcaAccount.lastCompletedSwapTs.toNumber();
        let nowTs = Math.floor(Date.now() / 1000);
        let maxDiffInSecs = Math.min(Math.floor(interval / 100), 3600); // +/-1% up to 3600 sec (ok for min interval = 5 min)
        let prevCheckpoint = Math.floor((nowTs - startTs) / interval);
        let prevTs = startTs + prevCheckpoint * interval;
        let nextCheckpoint = prevCheckpoint + 1;
        let nextTs = startTs + nextCheckpoint * interval;
        let nextScheduledTs: number;

        console.log("DDCA schedule: { start_ts: %s, interval:%s, last_completed_ts: %s, now_ts: %s, max_diff_in_secs: %s, low: %s, high: %s, low_ts: %s, high_ts: %s }",
        startTs, interval, lastCompletedSwapTs, nowTs, maxDiffInSecs, prevCheckpoint, nextCheckpoint, prevTs, nextTs);

        if(nowTs <= prevTs + maxDiffInSecs) { // we are in the prevTs swap window
            if(lastCompletedSwapTs != prevTs) // we are in the prevTs swap window and we haven't consumed the swap yet
                nextScheduledTs = prevTs;
            else // we are in the prevTs swap window but we already consumed the swap
                nextScheduledTs = nextTs;
        }
        else if(nowTs >= nextTs - maxDiffInSecs) { // we are in the nextTs swap window
            if(lastCompletedSwapTs != nextTs) // we are in the nextTs swap window and we haven't consumed the swap yet
                nextScheduledTs = nextTs;
            else // we are in the nextTs swap window but we already consumed the swap, so next in schedule will be nextCheckpoint + 1
                nextScheduledTs = startTs + (nextCheckpoint + 1) * interval
        }
        else { // we are in between prevTs and nextTs but no close ennough to any
            nextScheduledTs = nextTs;
        }
        console.log("nextTs: %s", nextTs);

        const amountPerSwap = ddcaAccount.amountPerSwap.toNumber();
        const remainingSwapsCount = Math.floor(fromTokenBalance / amountPerSwap);
        let fromBalanceWillRunOutByUtc = '';
        if(remainingSwapsCount > 0){
            fromBalanceWillRunOutByUtc = tsToUTCString(nextScheduledTs + (remainingSwapsCount - 1) * interval);
        }

        // const ddcaTxsSignature = this.connection.getConfirmedSignaturesForAddress2(ddcaAddress, commitment: "confirmed");
        // const parsedTxs = this.connection.getParsedConfirmedTransactions((await ddcaTxsSignature).map(x => x.signature));
        // console.log(parsedTxs);

        const ddca: DdcaDetails = {
            id: ddcaAddress.toBase58(),
            fromMint: ddcaAccount.fromMint.toBase58(),
            toMint: ddcaAccount.toMint.toBase58(),
            amountPerSwap: amountPerSwap,
            totalDepositsAmount: ddcaAccount.totalDepositsAmount.toNumber(),
            startTs: startTs,
            startUtc: tsToUTCString(startTs),
            intervalInSeconds: interval,
            lastCompletedSwapTs: lastCompletedSwapTs,
            lastCompletedSwapUtc: tsToUTCString(lastCompletedSwapTs),
            isPaused: ddcaAccount.isPaused,

            fromBalance: fromTokenBalance,
            toBalance: toTokenBalance,
            fromBalanceWillRunOutByUtc: fromBalanceWillRunOutByUtc,
            exchangedForAmount: 0, // TODO
            exchangedRateAverage: 0, // TODO
            nextScheduledSwapUtc: tsToUTCString(nextScheduledTs)
        };

        return ddca;
    }
}

function tsToUTCString(ts: number): string {
    return ts === 0 ? '' : new Date(ts * 1000).toUTCString();
}

async function createAtaCreateInstructionIfNotExists(
    ataAddress: PublicKey, 
    mintAddress: PublicKey, 
    ownerAccountAddress: PublicKey, 
    payerAddress: PublicKey, 
    // tokenClient: Token,
    connection: Connection
    ): Promise<TransactionInstruction | null> {
  try{
    const ata = await connection.getAccountInfo(ataAddress);
    if(!ata){
        console.log("ATA: %s for mint: %s was not found. Generating 'create' instruction...", ataAddress.toBase58(), mintAddress.toBase58());
        let [_, createIx] = await createAtaCreateInstruction(ataAddress, mintAddress, ownerAccountAddress, payerAddress);
        return createIx;
    }
    
    console.log("ATA: %s for mint: %s already exists", ataAddress.toBase58(), mintAddress.toBase58());
    return null;
  } catch (err) {
      console.log("Unable to find associated account: %s", err);
      throw Error("Unable to find associated account");
  }
}

async function createAtaCreateInstruction(
    ataAddress: PublicKey, 
    mintAddress: PublicKey, 
    ownerAccountAddress: PublicKey, 
    payerAddress: PublicKey
    ): Promise<[PublicKey, TransactionInstruction]> {
  if(ataAddress === null){
    ataAddress = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mintAddress,
      ownerAccountAddress,
    );
  }

  let ataCreateInstruction = Token.createAssociatedTokenAccountInstruction(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    mintAddress,
    ataAddress,
    ownerAccountAddress,
    payerAddress,
  );
  return [ataAddress, ataCreateInstruction];
}