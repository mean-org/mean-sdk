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
    LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID, NATIVE_MINT as WRAPPED_SOL_MINT, AccountLayout } from '@solana/spl-token';
import * as anchor from "@project-serum/anchor";
import { BN } from "@project-serum/anchor";
import { Wallet } from "@project-serum/anchor/src/provider";
import { DdcaAccount, DdcaAction, DdcaActivity, DdcaDetails, HlaInfo, SOL_MINT, SOL_MINT_DECIMALS } from '.';
import { parseIdlErrors, ProgramError } from '@project-serum/anchor';
import { bs58 } from '@project-serum/anchor/dist/cjs/utils/bytes';
import idl from './idl.json';

// CONSTANTS
const SYSTEM_PROGRAM_ID = anchor.web3.SystemProgram.programId;

const DDCA_OPERATING_ACCOUNT_ADDRESS = new PublicKey("6u1Hc9AqC6AvpYDQcFjhMVqAwcQ83Kn5TVm6oWMjDDf1");
const HLA_PROGRAM_ADDRESS = new PublicKey("B6gLd2uyVQLZMdC1s9C4WR7ZP9fMhJNh7WZYcsibuzN3");
const HLA_OPERATING_ACCOUNT_ADDRESS = new PublicKey("FZMd4pn9FsvMC55D4XQfaexJvKBtQpVuqMk5zuonLRDX");
const DDCA_SWAP_PERCENT_SLIPPAGE = 1.0; // 1 %

/**
 * Anchor based client for the DDCA program
 */
export class DdcaClient {

    private rpcUrl: string;
    public connection: Connection;
    public provider: anchor.Provider;
    public program: anchor.Program;
    private ownerAccountAddress: PublicKey;
    private verbose: boolean;
    private rpcVersion: anchor.web3.Version | null = null;

    /**
     * Create a DDCA client
     */
    constructor(
        rpcUrl: string,
        anchorWallet: any,
        // commitment: Commitment | string = 'confirmed' as Commitment
        confirmOptions?: anchor.web3.ConfirmOptions,
        verbose = false
    ) {
        if(!rpcUrl)
            throw new Error("wallet cannot be null or undefined");

        if(!anchorWallet || !anchorWallet.publicKey)
            throw new Error("wallet's public key cannot be null or undefined");

        // const confirmationOptions = {
        //     preflightCommitment: commitment, 
        //     commitment: commitment
        // } as anchor.web3.ConfirmOptions;
        // const provider = this.getAnchorProvider(rpcUrl, anchorWallet, confirmationOptions as anchor.web3.Connection);
        this.ownerAccountAddress = anchorWallet.publicKey;
        this.rpcUrl = rpcUrl;
        const provider = this.getAnchorProvider(rpcUrl, anchorWallet, confirmOptions);
        this.provider = provider;
        this.connection = provider.connection;
        anchor.setProvider(provider);

        const programId = new anchor.web3.PublicKey(idl.metadata.address);
        this.program = new anchor.Program(idl as anchor.Idl, programId, provider);
        this.verbose = verbose;
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

    private async createWrapSolInstructions(amountOfToWrapInLamports: number, ownerWrapTokenAccountAddress: PublicKey): Promise<[TransactionInstruction[], Keypair]>
    {   
        // Allocate memory for the account
        const minimumAccountBalance = await Token.getMinBalanceRentForExemptAccount(
            this.connection,
        );
        const newWrapAccount = Keypair.generate();

        let wrapIxs: Array<TransactionInstruction> = 
        [
            SystemProgram.createAccount({
                fromPubkey: this.ownerAccountAddress,
                newAccountPubkey: newWrapAccount.publicKey,
                lamports: minimumAccountBalance + amountOfToWrapInLamports,
                space: AccountLayout.span,
                programId: TOKEN_PROGRAM_ID,
            }),
            Token.createInitAccountInstruction(
                TOKEN_PROGRAM_ID,
                WRAPPED_SOL_MINT,
                newWrapAccount.publicKey,
                this.ownerAccountAddress
            ),
            Token.createTransferInstruction(
                TOKEN_PROGRAM_ID,
                newWrapAccount.publicKey,
                ownerWrapTokenAccountAddress,
                this.ownerAccountAddress,
                [],
                amountOfToWrapInLamports // BN to number
            ),
            Token.createCloseAccountInstruction(
                TOKEN_PROGRAM_ID,
                newWrapAccount.publicKey,
                this.ownerAccountAddress,
                this.ownerAccountAddress,
                []
            )
        ];

        return [wrapIxs, newWrapAccount];
    }

    public async createDdcaTx(
        fromMint: PublicKey,
        toMint: PublicKey,
        amountPerSwap: number,
        swapsCount: number,
        intervalInSeconds: number,
        wrapSolIfNeeded: boolean = false
    ): Promise<[PublicKey, Transaction]> {

        const swapCountBn = new BN(swapsCount);
        if(swapCountBn <= new BN(0)) throw new Error("Invalid param 'amountPerSwap'. Needs to be positve.");
        if(swapsCount <= 1) throw new Error("Invalid param 'swapsCount'. Needs to be greater than 1.");

        let changedFromMintTowSol = false;
        if(fromMint.equals(SOL_MINT)){
            fromMint = WRAPPED_SOL_MINT;
            changedFromMintTowSol = true;
        }
        else if(toMint.equals(SOL_MINT)){
            toMint = WRAPPED_SOL_MINT;
        }

        if(fromMint.equals(toMint))
            throw Error("Cannot create DDCA with same 'from' and 'to' mints");

        const fromMintDecimals = fromMint.equals(WRAPPED_SOL_MINT)
            ? SOL_MINT_DECIMALS
            : (await this.connection.getTokenSupply(fromMint)).value.decimals;
        const amountPerSwapBn =  new BN(amountPerSwap * 10 ** fromMintDecimals);
        const depositAmountBn =  amountPerSwapBn.mul(swapCountBn);

        const blockHeight = await this.connection.getSlot('confirmed');
        const blockHeightBn = new BN(blockHeight);
        // const blockHeightBytes = blockHeightBn.toBuffer('be', 8);
        const blockHeightBytes = blockHeightBn.toArrayLike(Buffer, 'be', 8);

        //ddca account pda and bump
        const [ddcaAccountPda, ddcaAccountPdaBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                this.ownerAccountAddress.toBuffer(),
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
            this.ownerAccountAddress,
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

        //hla operating token account (from)
        const hlaOperatingFromTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            fromMint,
            HLA_OPERATING_ACCOUNT_ADDRESS,
        );

        // Instructions
        let ixs: Array<TransactionInstruction> | undefined = new Array<TransactionInstruction>();

        let ownerFromAtaCreateInstruction = await createAtaCreateInstructionIfNotExists(
            ownerFromTokenAccountAddress,
            fromMint,
            this.ownerAccountAddress,
            this.ownerAccountAddress,
            this.connection);
        if (ownerFromAtaCreateInstruction !== null)
            ixs.push(ownerFromAtaCreateInstruction);

        let hlaOperatingFromAtaCreateInstruction = await createAtaCreateInstructionIfNotExists(
            hlaOperatingFromTokenAccountAddress,
            fromMint,
            HLA_OPERATING_ACCOUNT_ADDRESS,
            this.ownerAccountAddress,
            this.connection);
        if (hlaOperatingFromAtaCreateInstruction !== null)
            ixs.push(hlaOperatingFromAtaCreateInstruction);

        let signers: Array<Signer> | undefined = new Array<Signer>(); 
        if (changedFromMintTowSol) {
            const [wrapIxs, newWrapAccount] = await this.createWrapSolInstructions(depositAmountBn.toNumber(), ownerFromTokenAccountAddress);
            ixs.push(...wrapIxs);
            signers.push(newWrapAccount);
        } else if (fromMint.equals(WRAPPED_SOL_MINT) && wrapSolIfNeeded) {
            let ownerWSolAtaBalanceBn = new BN(0);
            if (!ownerFromAtaCreateInstruction) { // owner wSOL ATA account does not exist so balance is zero
                const ownerWSolAtaTokenAmount = (await this.connection.getTokenAccountBalance(ownerFromTokenAccountAddress)).value;
                ownerWSolAtaBalanceBn = new BN(ownerWSolAtaTokenAmount.amount);
            }
            if(depositAmountBn > ownerWSolAtaBalanceBn){
                const amountToWrapBn = depositAmountBn.sub(ownerWSolAtaBalanceBn);
                const [wrapIxs, newWrapAccount] = await this.createWrapSolInstructions(amountToWrapBn.toNumber(), ownerFromTokenAccountAddress);
                ixs.push(...wrapIxs);
                signers.push(newWrapAccount);
            }
        }

        if(ixs.length === 0)
            ixs = undefined;

        if(this.verbose){
            console.log("TEST PARAMETERS:")
            console.log("  Program ID:                           " + this.program.programId);
            console.log("  payer.address:                        " + this.ownerAccountAddress);
            console.log("  fromMint:                             " + fromMint);
            console.log("  toMint:                               " + toMint);
            console.log("  blockHeight:                          " + blockHeight);
            console.log();
            console.log("  ownerAccountAddress:                  " + this.ownerAccountAddress);
            console.log("  ownerFromTokenAccountAddress:         " + ownerFromTokenAccountAddress);
            console.log();
            console.log("  ddcaAccountPda:                       " + ddcaAccountPda);
            console.log("  ddcaAccountPdaBump:                   " + ddcaAccountPdaBump);
            console.log("  ddcaFromTokenAccountAddress:          " + ddcaFromTokenAccountAddress);
            console.log("  ddcaToTokenAccountAddress:            " + ddcaToTokenAccountAddress);
            console.log();
            console.log("  SYSTEM_PROGRAM_ID:                    " + SYSTEM_PROGRAM_ID);
            console.log("  TOKEN_PROGRAM_ID:                     " + TOKEN_PROGRAM_ID);
            console.log("  ASSOCIATED_TOKEN_PROGRAM_ID:          " + ASSOCIATED_TOKEN_PROGRAM_ID);
            console.log();
        }

        const createTx = await this.program.transaction.create(new BN(blockHeight), ddcaAccountPdaBump,
            depositAmountBn, amountPerSwapBn, new BN(intervalInSeconds),
            {
                accounts: {
                    // owner
                    ownerAccount: this.ownerAccountAddress,
                    ownerFromTokenAccount: ownerFromTokenAccountAddress,
                    // ddca
                    ddcaAccount: ddcaAccountPda,
                    fromMint: fromMint,
                    fromTokenAccount: ddcaFromTokenAccountAddress,
                    toMint: toMint,
                    toTokenAccount: ddcaToTokenAccountAddress,
                    // system accounts
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                    clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
                    systemProgram: SYSTEM_PROGRAM_ID,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
                },
                instructions: ixs,
            }
        );
        
        createTx.feePayer = this.ownerAccountAddress;
        let hash = await this.connection.getRecentBlockhash(this.connection.commitment);
        createTx.recentBlockhash = hash.blockhash;
        
        if(signers.length > 0)
            createTx.partialSign(...signers);

        return [ddcaAccountPda, createTx];
    }

    public async createWakeAndSwapTx(
        ddcaAccountAddress: PublicKey,
        hlaInfo: HlaInfo
    ): Promise<Transaction> {

        if(!ddcaAccountAddress) throw new Error("Invalid param 'ddcaAccountAddress'");
        if(!hlaInfo) throw new Error("Invalid param 'hlaInfo'");
        const ddcaAccount = await this.program.account.ddcaAccount.fetch(ddcaAccountAddress);
        if(!ddcaAccount){
            throw new Error(`No DDCA account was found for address: ${ddcaAccountAddress}`);
        }

        const fromMint = ddcaAccount.fromMint;
        const toMint = ddcaAccount.toMint;

        //ddca associated token account (from)
        const ddcaFromTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            fromMint,
            ddcaAccountAddress,
            true,
        );
        //ddca associated token account (to)
        const ddcaToTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            toMint,
            ddcaAccountAddress,
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

        const hlaSwapPctFee = hlaInfo.aggregatorPercentFees;
        const exchangeRate = hlaInfo.exchangeRate; // out price 
        const inAmount = ddcaAccount.amountPerSwap / (10 ** ddcaAccount.fromMintDecimals); // in amount
        const inAmountWithFee = inAmount * (1 - hlaSwapPctFee / 100); // in amount with fee deducted 
        const outAmount = inAmountWithFee * exchangeRate;
        const minOutAmount = outAmount * (1 - DDCA_SWAP_PERCENT_SLIPPAGE / 100);

        const toMintDecimals = (await this.connection.getTokenSupply(toMint)).value.decimals;
        const swapMinimumOutAmountBn =  new BN(minOutAmount * 10 ** toMintDecimals);
        const swapSlippageBn =  new BN(DDCA_SWAP_PERCENT_SLIPPAGE * 100);

        if(this.verbose){
            console.log("TEST PARAMETERS:")
            console.log("  Program ID:                           " + this.program.programId);
            console.log("  ddcaAccountPda:                       " + ddcaAccountAddress);
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
            console.log("  exchangeRate:                         " + exchangeRate);
            console.log("  inAmount:                             " + inAmount);
            console.log("  inAmountWithFee:                      " + inAmountWithFee);
            console.log("  outAmount:                            " + outAmount);
            console.log("  minOutAmount:                         " + minOutAmount);
            console.log("  DDCA_SWAP_PERCENT_SLIPPAGE:           " + DDCA_SWAP_PERCENT_SLIPPAGE);
            console.log();
            console.log("  SYSTEM_PROGRAM_ID:                    " + SYSTEM_PROGRAM_ID);
            console.log("  TOKEN_PROGRAM_ID:                     " + TOKEN_PROGRAM_ID);
            console.log("  ASSOCIATED_TOKEN_PROGRAM_ID:          " + ASSOCIATED_TOKEN_PROGRAM_ID);
            console.log();
        }

        const wakeAndSwapTx = await this.program.transaction.wakeAndSwap(
            swapMinimumOutAmountBn, swapSlippageBn,
            {
                accounts: {
                    // owner
                    ownerAccount: this.ownerAccountAddress,
                    // ddca
                    ddcaAccount: ddcaAccountAddress,
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
                remainingAccounts: hlaInfo.remainingAccounts, // hla specific amm pool accounts
            }
        );
        
        wakeAndSwapTx.feePayer = this.ownerAccountAddress;
        let hash = await this.connection.getRecentBlockhash(this.connection.commitment);
        wakeAndSwapTx.recentBlockhash = hash.blockhash;

        return wakeAndSwapTx;
    }

    public async createAddFundsTx(
        ddcaAccountAddress: PublicKey,
        swapsCount: number,
        wrapSolIfNeeded: boolean = false,
    ): Promise<Transaction> {

        const swapCountBn = new BN(swapsCount);
        if(!ddcaAccountAddress) throw new Error("Invalid param 'ddcaAccountAddress'");
        if(swapsCount <= 1) throw new Error("Invalid param 'swapsCount'. Needs to be greater than 1.");
        
        const ownerAccountAddress = this.ownerAccountAddress;
        const ddcaAccount = await this.program.account.ddcaAccount.fetch(ddcaAccountAddress);
        if(!ddcaAccount){
            throw new Error(`No DDCA account was found for address: ${ddcaAccountAddress}`);
        }

        if(ddcaAccount.ownerAccAddr.toBase58() !== ownerAccountAddress.toBase58()){
            throw new Error(`DDCA account: ${ddcaAccountAddress} ins not owned by this owner`);
        }
        
        const depositAmountBn =  (new BN(ddcaAccount.amountPerSwap)).mul(swapCountBn);
        console.log("depositAmountBn:", depositAmountBn.toNumber())

        //owner token account (from)
        const ownerFromTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            ddcaAccount.fromMint,
            ownerAccountAddress,
        );

        // Instructions
        let ixs: Array<TransactionInstruction> | undefined = new Array<TransactionInstruction>();

        let ownerFromAtaCreateInstruction = await createAtaCreateInstructionIfNotExists(
            ownerFromTokenAccountAddress,
            ddcaAccount.fromMint,
            ownerAccountAddress,
            ownerAccountAddress,
            this.connection);
        if (ownerFromAtaCreateInstruction !== null)
            ixs.push(ownerFromAtaCreateInstruction);

        let signers: Array<Signer> | undefined = new Array<Signer>();
        if(ddcaAccount.fromMint.equals(WRAPPED_SOL_MINT) && wrapSolIfNeeded){
            let ownerWSolAtaBalanceBn = new BN(0);
            if(!ownerFromAtaCreateInstruction) { // owner wSOL ATA account does not exist so balance is zero
                const ownerWSolAtaTokenAmount = (await this.connection.getTokenAccountBalance(ownerFromTokenAccountAddress)).value;
                ownerWSolAtaBalanceBn = new BN(ownerWSolAtaTokenAmount.amount);
            }
            if(depositAmountBn > ownerWSolAtaBalanceBn){
                const amountToWrapBn = depositAmountBn.sub(ownerWSolAtaBalanceBn);
                const [wrapIxs, newWrapAccount] = await this.createWrapSolInstructions(amountToWrapBn.toNumber(), ownerFromTokenAccountAddress);
                ixs.push(...wrapIxs);
                signers.push(newWrapAccount);
            }
        }

        if(ixs.length === 0)
            ixs = undefined;
        
        if(this.verbose){
            console.log("TEST PARAMETERS:")
            console.log("  Program ID:                           " + this.program.programId);
            console.log("  payer.address:                        " + ownerAccountAddress);
            console.log();
            console.log("  ownerAccountAddress:                  " + this.ownerAccountAddress);
            console.log("  ownerFromTokenAccountAddress:         " + ownerFromTokenAccountAddress);
            console.log("  ddcaAccountPda:                       " + ddcaAccountAddress);
            console.log("  fromMint:                             " + ddcaAccount.fromMint);
            console.log("  fromMintDecimals:                     " + ddcaAccount.fromMintDecimals);
            console.log();
        }

        const addFundsTx = await this.program.transaction.addFunds(
            depositAmountBn,
            {
                accounts: {
                    // owner
                    ownerAccount: ownerAccountAddress,
                    ownerFromTokenAccount: ownerFromTokenAccountAddress,
                    // ddca
                    ddcaAccount: ddcaAccountAddress,
                    fromTokenAccount: ddcaAccount.fromTaccAddr,
                    // system accounts
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                    clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
                    systemProgram: SYSTEM_PROGRAM_ID,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
                },
                instructions: ixs,
                // seeds: []
            }
        );
        
        addFundsTx.feePayer = ownerAccountAddress;
        let hash = await this.connection.getRecentBlockhash(this.connection.commitment);
        addFundsTx.recentBlockhash = hash.blockhash;
        
        if(signers.length > 0)
            addFundsTx.partialSign(...signers);

        return addFundsTx;
    }

    public async createWithdrawTx(
        ddcaAccountAddress: PublicKey,
        withdrawAmount: number,
    ): Promise<Transaction> {
        
        if(!ddcaAccountAddress) throw new Error("Invalid param 'ddcaAccountAddress'");
        if(!withdrawAmount || withdrawAmount <= 0) throw new Error("Invalid param 'withdrawAmount'");
        
        const ddcaAccount = await this.program.account.ddcaAccount.fetch(ddcaAccountAddress);
        if(!ddcaAccount){
            throw new Error(`No DDCA account was found for address: ${ddcaAccountAddress}`);
        }

        if(ddcaAccount.ownerAccAddr.toBase58() !== this.ownerAccountAddress.toBase58()){
            throw new Error(`DDCA account: ${ddcaAccountAddress} ins not owned by this owner`);
        }

        const toMint = ddcaAccount.toMint;

        //owner token account (to)
        const ownerToTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            toMint,
            this.ownerAccountAddress,
        );

        //ddca associated token account (to)
        const ddcaToTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            toMint,
            ddcaAccountAddress,
            true,
        );

        //ddca operating token account (to)
        const ddcaOperatingToTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            toMint,
            DDCA_OPERATING_ACCOUNT_ADDRESS,
        );

        // Instructions
        let ixs: Array<TransactionInstruction> | undefined = new Array<TransactionInstruction>();

        let ownerToAtaCreateInstruction = await createAtaCreateInstructionIfNotExists(
            ownerToTokenAccountAddress,
            toMint,
            this.ownerAccountAddress,
            this.ownerAccountAddress,
            this.connection);
        if (ownerToAtaCreateInstruction !== null)
            ixs.push(ownerToAtaCreateInstruction);

        let ddcaOperatingToAtaCreateInstruction = await createAtaCreateInstructionIfNotExists(
            ddcaOperatingToTokenAccountAddress,
            toMint,
            DDCA_OPERATING_ACCOUNT_ADDRESS,
            this.ownerAccountAddress,
            this.connection);
        if (ddcaOperatingToAtaCreateInstruction !== null)
            ixs.push(ddcaOperatingToAtaCreateInstruction);

        if(ixs.length === 0)
            ixs = undefined;

        if(this.verbose){
            console.log("TEST PARAMETERS:")
            console.log("  Program ID:                           " + this.program.programId);
            console.log("  payer.address:                        " + this.ownerAccountAddress);
            console.log("  toMint:                               " + toMint);
            console.log();
            console.log("  ownerAccountAddress:                  " + this.ownerAccountAddress);
            console.log("  ownerToTokenAccountAddress:           " + ownerToTokenAccountAddress);
            console.log();
            console.log("  ddcaAccountPda:                       " + ddcaAccountAddress);
            console.log("  ddcaToTokenAccountAddress:            " + ddcaToTokenAccountAddress);
            console.log();
            console.log("  DDCA_OPERATING_ACCOUNT_ADDRESS:       " + DDCA_OPERATING_ACCOUNT_ADDRESS);
            console.log("  ddcaOperatingFromTokenAccountAddress: " + ddcaOperatingToTokenAccountAddress);
            console.log();
            console.log("  TOKEN_PROGRAM_ID:                     " + TOKEN_PROGRAM_ID);
            console.log();
        }

        const withdrawAmountBn =  new BN(withdrawAmount * 10 ** ddcaAccount.toMintDecimals);

        const closeTx = await this.program.transaction.withdraw(
            withdrawAmountBn,
            {
                accounts: {
                    // owner
                    ownerAccount: this.ownerAccountAddress,
                    ownerToTokenAccount: ownerToTokenAccountAddress,
                    // ddca
                    ddcaAccount: ddcaAccountAddress,
                    ddcaToTokenAccount: ddcaToTokenAccountAddress,
                    // operating
                    operatingAccount: DDCA_OPERATING_ACCOUNT_ADDRESS,
                    operatingToTokenAccount: ddcaOperatingToTokenAccountAddress,
                    // system accounts
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                    systemProgram: SYSTEM_PROGRAM_ID,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
                },
                instructions: ixs,
            }
        );
        
        closeTx.feePayer = this.ownerAccountAddress;
        let hash = await this.connection.getRecentBlockhash(this.connection.commitment);
        closeTx.recentBlockhash = hash.blockhash;

        return closeTx;
    }

    public async createCloseTx(
        ddcaAccountAddress: PublicKey,
    ): Promise<Transaction> {

        const ddcaAccountToClose = await this.program.account.ddcaAccount.fetch(ddcaAccountAddress);
        if(!ddcaAccountToClose){
            throw new Error(`No DDCA account was found for address: ${ddcaAccountAddress}`);
        }

        const fromMint = ddcaAccountToClose.fromMint;
        const toMint = ddcaAccountToClose.toMint;

        //owner token account (from)
        const ownerFromTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            fromMint,
            this.ownerAccountAddress,
        );

        //owner token account (to)
        const ownerToTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            toMint,
            this.ownerAccountAddress,
        );

        //ddca associated token account (from)
        const ddcaFromTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            fromMint,
            ddcaAccountAddress,
            true,
        );
        //ddca associated token account (to)
        const ddcaToTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            toMint,
            ddcaAccountAddress,
            true,
        );

        //ddca operating token account (from)
        const ddcaOperatingFromTokenAccountAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            fromMint,
            DDCA_OPERATING_ACCOUNT_ADDRESS,
        );

        //ddca operating token account (to)
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
            this.ownerAccountAddress,
            this.ownerAccountAddress,
            this.connection);
        if (ownerFromAtaCreateInstruction !== null)
            ixs.push(ownerFromAtaCreateInstruction);

        let ownerToAtaCreateInstruction = await createAtaCreateInstructionIfNotExists(
            ownerToTokenAccountAddress,
            toMint,
            this.ownerAccountAddress,
            this.ownerAccountAddress,
            this.connection);
        if (ownerToAtaCreateInstruction !== null)
            ixs.push(ownerToAtaCreateInstruction);

        let ddcaOperatingFromAtaCreateInstruction = await createAtaCreateInstructionIfNotExists(
            ddcaOperatingFromTokenAccountAddress,
            fromMint,
            DDCA_OPERATING_ACCOUNT_ADDRESS,
            this.ownerAccountAddress,
            this.connection);
        if (ddcaOperatingFromAtaCreateInstruction !== null)
            ixs.push(ddcaOperatingFromAtaCreateInstruction);

        let ddcaOperatingToAtaCreateInstruction = await createAtaCreateInstructionIfNotExists(
            ddcaOperatingToTokenAccountAddress,
            toMint,
            DDCA_OPERATING_ACCOUNT_ADDRESS,
            this.ownerAccountAddress,
            this.connection);
        if (ddcaOperatingToAtaCreateInstruction !== null)
            ixs.push(ddcaOperatingToAtaCreateInstruction);

        if(ixs.length === 0)
            ixs = undefined;

            

        if(this.verbose){
            console.log("TEST PARAMETERS:")
            console.log("  Program ID:                           " + this.program.programId);
            console.log("  payer.address:                        " + this.ownerAccountAddress);
            console.log();
            console.log("  ownerAccountAddress:                  " + this.ownerAccountAddress);
            console.log("  ownerFromTokenAccountAddress:         " + ownerFromTokenAccountAddress);
            console.log("  ownerToTokenAccountAddress:           " + ownerToTokenAccountAddress);
            console.log();
            console.log("  ddcaAccountAddress:                       " + ddcaAccountAddress);
            console.log("  ddcaFromTokenAccountAddress:          " + ddcaFromTokenAccountAddress);
            console.log("  ddcaToTokenAccountAddress:            " + ddcaToTokenAccountAddress);
            console.log();
            console.log("  DDCA_OPERATING_ACCOUNT_ADDRESS:       " + DDCA_OPERATING_ACCOUNT_ADDRESS);
            console.log("  ddcaOperatingFromTokenAccountAddress: " + ddcaOperatingFromTokenAccountAddress);
            console.log("  ddcaOperatingToTokenAccountAddress:   " + ddcaOperatingToTokenAccountAddress);
            console.log();
            console.log("  TOKEN_PROGRAM_ID:                     " + TOKEN_PROGRAM_ID);
            console.log();
        }

        const closeTx = await this.program.transaction.close(
            {
                accounts: {
                    // owner
                    ownerAccount: this.ownerAccountAddress,
                    ownerFromTokenAccount: ownerFromTokenAccountAddress,
                    ownerToTokenAccount: ownerToTokenAccountAddress,
                    // ddca
                    ddcaAccount: ddcaAccountAddress,
                    ddcaFromTokenAccount: ddcaFromTokenAccountAddress,
                    ddcaToTokenAccount: ddcaToTokenAccountAddress,
                    // operating
                    operatingAccount: DDCA_OPERATING_ACCOUNT_ADDRESS,
                    operatingFromTokenAccount: ddcaOperatingFromTokenAccountAddress,
                    operatingToTokenAccount: ddcaOperatingToTokenAccountAddress,
                    // system accounts
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
                instructions: ixs,
            }
        );
        
        closeTx.feePayer = this.ownerAccountAddress;
        let hash = await this.connection.getRecentBlockhash(this.connection.commitment);
        closeTx.recentBlockhash = hash.blockhash;

        return closeTx;
    }

    public async listDdcas() {

        const ddcaAccounts = await this.program.account.ddcaAccount.all(this.ownerAccountAddress.toBuffer());
        return ddcaAccounts.map(x => {
            const values: DdcaAccount = {
                ddcaAccountAddress: x.publicKey.toBase58(),
                fromMint: x.account.fromMint.toBase58(),
                toMint: x.account.toMint.toBase58(),
                amountPerSwap: x.account.amountPerSwap.toNumber() / (10 ** x.account.fromMintDecimals),
                totalDepositsAmount: x.account.totalDepositsAmount.toNumber() / (10 ** x.account.fromMintDecimals),
                startTs: x.account.startTs.toNumber(),
                startUtc: tsToUTCString(x.account.startTs.toNumber()),
                intervalInSeconds: x.account.intervalInSeconds.toNumber(),
                lastCompletedSwapTs: x.account.lastCompletedSwapTs.toNumber(),
                lastCompletedSwapUtc: tsToUTCString(x.account.lastCompletedSwapTs.toNumber()),
                isPaused: x.account.isPaused,
            };
            return values;
        });
    }

    public async getDdca(ddcaAccountAddress: PublicKey): Promise<DdcaDetails | null> {

        const ddcaAccount = await this.program.account.ddcaAccount.fetch(ddcaAccountAddress);
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

        // console.log("DDCA schedule: { start_ts: %s, interval:%s, last_completed_ts: %s, now_ts: %s, max_diff_in_secs: %s, low: %s, high: %s, low_ts: %s, high_ts: %s }",
        // startTs, interval, lastCompletedSwapTs, nowTs, maxDiffInSecs, prevCheckpoint, nextCheckpoint, prevTs, nextTs);

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

        const amountPerSwap = ddcaAccount.amountPerSwap.toNumber() / (10 ** ddcaAccount.fromMintDecimals);
        const remainingSwapsCount = Math.floor(fromTokenBalance / amountPerSwap);
        let fromBalanceWillRunOutByUtc = '';
        if(remainingSwapsCount > 0){
            fromBalanceWillRunOutByUtc = tsToUTCString(nextScheduledTs + (remainingSwapsCount - 1) * interval);
        }

        const ddca: DdcaDetails = {
            ddcaAccountAddress: ddcaAccountAddress.toBase58(),
            fromMint: ddcaAccount.fromMint.toBase58(),
            toMint: ddcaAccount.toMint.toBase58(),
            amountPerSwap: amountPerSwap,
            totalDepositsAmount: ddcaAccount.totalDepositsAmount.toNumber() / (10 ** ddcaAccount.fromMintDecimals),
            startTs: startTs,
            startUtc: tsToUTCString(startTs),
            intervalInSeconds: interval,
            lastCompletedSwapTs: lastCompletedSwapTs,
            lastCompletedSwapUtc: tsToUTCString(lastCompletedSwapTs),
            isPaused: ddcaAccount.isPaused,

            fromBalance: fromTokenBalance,
            toBalance: toTokenBalance,
            fromBalanceWillRunOutByUtc: fromBalanceWillRunOutByUtc,
            nextScheduledSwapUtc: tsToUTCString(nextScheduledTs),
            swapCount: ddcaAccount.swapCount,
            swapAvgRate: ddcaAccount.swapAvgRate.toNumber() / (10 ** ddcaAccount.toMintDecimals),
            lastDepositTs: ddcaAccount.lastDepositTs,
            lastDepositedtUtc: tsToUTCString(ddcaAccount.lastDepositTs),
        };

        return ddca;
    }

    /**
     * ToString
     */
    public toString(): string {
        return `{ rpcUrl: ${this.rpcUrl}, ownerAccountAddress: ${this.ownerAccountAddress?.toBase58()}, commitment: ${this.provider?.opts?.commitment}, preflightCommitment: ${this.provider?.opts?.preflightCommitment}, skipPreflight: ${this.provider?.opts?.skipPreflight} }`;
    }

    /**
     * Attempts to parse an rpc error. Experimental
     */
    public tryParseRpcError(rawError: any): ProgramError | null {

        const errorLogs = rawError?.logs as Array<string> | undefined;
        if(errorLogs){
            for (let i = 0; i < errorLogs.length; i++) {
                const logEntry = errorLogs[i];
                if(logEntry.startsWith(`Program ${HLA_PROGRAM_ADDRESS} failed:`))
                    return null;
            }
        }

        const idlErrors = parseIdlErrors(this.program.idl);
        const parsedError = ProgramError.parse(rawError, idlErrors);
        return parsedError;
    }

    private async getRpcVersion(): Promise<anchor.web3.Version> {
        if(!this.rpcVersion)
            this.rpcVersion = await this.connection.getVersion();

        return this.rpcVersion;
    }

    public async getActivity(ddcaAccountAddress: PublicKey | string): Promise<DdcaActivity[]> {
        const ddcaAccount = await this.program.account.ddcaAccount.fetch(ddcaAccountAddress);
        if(ddcaAccount === null)
            return [];

        if (typeof ddcaAccountAddress === "string") {
            ddcaAccountAddress = new PublicKey(ddcaAccountAddress);
        }
        const confirmedSignatures = await this.connection.getSignaturesForAddress(ddcaAccountAddress, { limit: 5 }, 'finalized');

        // const rpcVersion = await this.getRpcVersion();
        // if(rpcVersion['solana-core']){
        //     //TODO
        // }

        let confirmedTxs: Array<anchor.web3.ParsedConfirmedTransaction | null> | null = null;
        try {
            confirmedTxs = await this.connection.getParsedConfirmedTransactions(confirmedSignatures.map(tx => tx.signature), 'finalized');
        } catch (error) { }

        if(!confirmedTxs || confirmedTxs.length === 0){
            confirmedTxs = []
            for(let sigInfo of confirmedSignatures){
                const tx = await this.connection.getParsedConfirmedTransaction(sigInfo.signature);
                confirmedTxs.push(tx);
            }
        }
        
        let ddcaActivities = Array<DdcaActivity>();
        for (let tx of confirmedTxs) {
            if(!tx){
                continue;
            }
            try {
                let ddcaActivity = this.parseTransaction(tx, ddcaAccount);
                if(ddcaActivity){
                    ddcaActivities.push(ddcaActivity);
                }
            } catch (error) {
                console.log(error);
            }
        }

        return ddcaActivities;
    }

    private parseTransaction(tx: anchor.web3.ParsedConfirmedTransaction, rawDdcaAccount: any): DdcaActivity | null {
        for (let ix of tx.transaction.message.instructions) {
            ix = ix as anchor.web3.PartiallyDecodedInstruction;
            if (!ix?.data) {
                continue;
            }
            let sighash = bs58.encode(
                bs58.decode(ix.data).slice(0, 8)
            );

            const sighashLayouts = this.program.coder.instruction["sighashLayouts"];
            const decoder = sighashLayouts.get(sighash);
            if (!decoder) {
                console.log("No decoder found for sighash:", sighash);
                return null;
            }

            // let buffer = bs58.decode(ix.data);
            // const decodedTxData = decoder.layout.decode(buffer);

            let fromMint: string | null = null;
            let fromUiAmountDelta: number | null = 0;
            let toMint: string | null = null;
            let toUiAmountDelta: number | null = 0;
            let action: DdcaAction = "unknown";

            const txAccountAddresses = tx.transaction.message.accountKeys.map(x => x.pubkey.toBase58());
            let fromTokenAccountAddress = new PublicKey(rawDdcaAccount.fromTaccAddr).toBase58();
            let toTokenAccountAddress = new PublicKey(rawDdcaAccount.toTaccAddr).toBase58();

            switch (decoder.name) {
                case "create":
                    action = "deposited";
                    [fromMint, fromUiAmountDelta] = 
                        calculateTokenBlanaceDelta(fromTokenAccountAddress, 
                            txAccountAddresses, tx.meta?.preTokenBalances, 
                            tx.meta?.postTokenBalances);
                    break;
                case "wakeAndSwap":
                    action = "exchanged";
                    
                    [fromMint, fromUiAmountDelta] = 
                        calculateTokenBlanaceDelta(fromTokenAccountAddress, 
                            txAccountAddresses, tx.meta?.preTokenBalances, 
                            tx.meta?.postTokenBalances);

                    [toMint, toUiAmountDelta] = 
                        calculateTokenBlanaceDelta(toTokenAccountAddress, 
                            txAccountAddresses, tx.meta?.preTokenBalances, 
                            tx.meta?.postTokenBalances);

                    break;
                case "addFunds":
                    action = "deposited";
                    [fromMint, fromUiAmountDelta] = 
                        calculateTokenBlanaceDelta(fromTokenAccountAddress, 
                            txAccountAddresses, tx.meta?.preTokenBalances, 
                            tx.meta?.postTokenBalances);
                    break;
                case "withdraw":
                    action = "withdrew";
                    [toMint, toUiAmountDelta] = 
                        calculateTokenBlanaceDelta(toTokenAccountAddress, 
                            txAccountAddresses, tx.meta?.preTokenBalances, 
                            tx.meta?.postTokenBalances);
                    break;
                default:
                    action = "unknown"
                    break;
            }

            return {
                action: action,
                fromMint: fromMint,
                fromAmount: fromUiAmountDelta ? Math.abs(fromUiAmountDelta): fromUiAmountDelta,
                toMint: toMint,
                toAmount: toUiAmountDelta ? Math.abs(toUiAmountDelta): toUiAmountDelta,
                transactionSignature: tx.transaction.signatures[0],
                networkFeeInLamports: tx.meta?.fee,
                dateUtc: tx.blockTime ? tsToUTCString(tx.blockTime) : ""
            };
        }
        return null;
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
    connection: Connection
    ): Promise<TransactionInstruction | null> {
  try{
    const ata = await connection.getAccountInfo(ataAddress);
    if(!ata){
        // console.log("ATA: %s for mint: %s was not found. Generating 'create' instruction...", ataAddress.toBase58(), mintAddress.toBase58());
        let [_, createIx] = await createAtaCreateInstruction(ataAddress, mintAddress, ownerAccountAddress, payerAddress);
        return createIx;
    }
    
    // console.log("ATA: %s for mint: %s already exists", ataAddress.toBase58(), mintAddress.toBase58());
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

function calculateTokenBlanaceDelta(
    tokenAccountAddressB58: string,
    txAccountAddressesB58: string[],
    preTokenBalances?: anchor.web3.TokenBalance[] | null,
    postTokenBalances?: anchor.web3.TokenBalance[] | null
): [string | null, number | null] {

    if (!preTokenBalances || !postTokenBalances)
        return [null, null];

    const tokenAccountIndex = txAccountAddressesB58.lastIndexOf(tokenAccountAddressB58);
    const preTokenBalance = preTokenBalances?.find(x => x.accountIndex === tokenAccountIndex);
    const postTokenBalance = postTokenBalances?.find(x => x.accountIndex === tokenAccountIndex);

    if (!preTokenBalance?.uiTokenAmount?.uiAmount && !postTokenBalance?.uiTokenAmount?.uiAmount)
        return [null, null];

    const preMint = preTokenBalance?.mint;
    const preUiTokenAmount = preTokenBalance?.uiTokenAmount.uiAmount;

    const postMint = postTokenBalance?.mint;
    const postUiTokenAmount = postTokenBalance?.uiTokenAmount.uiAmount;

    const uiTokenAmountDelta = (postUiTokenAmount ?? 0) - (preUiTokenAmount ?? 0);

    return [preMint ?? postMint ?? null, uiTokenAmountDelta];
}
