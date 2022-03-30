import {
    PublicKey,
    Keypair,
    Connection,
    Transaction,
    TransactionInstruction
} from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as anchor from "@project-serum/anchor";
import { BN, IdlAccounts, parseIdlErrors, Program, ProgramError, Provider, Wallet } from "@project-serum/anchor";
import { IDL } from './idl/mean_stake';
import { MeanStake } from "./idl/mean_stake";
import {fetch, Headers} from 'cross-fetch';

// CONSTANTS
const SYSTEM_PROGRAM_ID = anchor.web3.SystemProgram.programId;
const SYSVAR_RENT_PUBKEY = anchor.web3.SYSVAR_RENT_PUBKEY;
const DECIMALS = 6;
const E6 = 1_000_000;
const E9 = 1_000_000_000;
const DECIMALS_BN = new BN(DECIMALS);
const READONLY_PUBKEY = new PublicKey("3KmMEv7A8R3MMhScQceXBQe69qLmnFfxSM3q8HyzkrSx");
const MEAN_STAKE_ID = new PublicKey('MSTKTNxDrVTd32qF8kyaiUhFidmgPaYGU932FbRa7eK');
const DEPOSITS_HISTORY_N_DAYS = 6;

const prodEnv: Env = {
    mean: new PublicKey('MEANeD3XDdUmNMsRGjASkSWdC8prLYsoRJ61pPeHctD'),
    sMean: new PublicKey('sMEANebFMnd9uTYpyntGzBmTmzEukRFwCjEcnXT2E8z'),
    apiUrl: "https://tempo-api.meanops.com",
};

const testEnv: Env = {
    mean: new PublicKey('MNZeoVuS87pFssHCbxKHfddvJk4MjmM2RHjQskrk7qs'),
    sMean: new PublicKey('sMNxc4HFhtyY9adKKmE2TBq4poD36moXN8W7YiQMsTA'),
    apiUrl: "https://tempo-api-dev.meanops.com",
};

/**
 * Anchor based client for the Mean Staking program
 */
export class StakingClient {
    private cluster: string;
    private rpcUrl: string;
    public connection: Connection;
    public provider: Provider;
    public program: Program<MeanStake>;
    public walletPubKey: PublicKey | null | undefined;
    private verbose: boolean;
    public mintPubkey: PublicKey = PublicKey.default;
    public xMintPubkey: PublicKey = PublicKey.default;
    public apiUrl: string = '';

    /**
     * Create a Mean Staking client
     */
    constructor(
        cluster: string,
        rpcUrl: string,
        walletPubKey: PublicKey | null | undefined,
        confirmOptions?: anchor.web3.ConfirmOptions,
        verbose = false,
    ) {
        if (!rpcUrl)
            throw new Error("wallet cannot be null or undefined");

        this.walletPubKey = walletPubKey;
        this.cluster = cluster;
        this.rpcUrl = rpcUrl;
        const readonlyWallet = StakingClient.createReadonlyWallet(walletPubKey ?? READONLY_PUBKEY);
        this.program = StakingClient.createProgram(rpcUrl, readonlyWallet, confirmOptions);
        this.provider = this.program.provider;
        this.connection = this.program.provider.connection;
        this.verbose = verbose;

        const env = this.cluster === 'mainnet-beta' ? prodEnv : testEnv;
        this.mintPubkey = env.mean;
        this.xMintPubkey = env.sMean;
        this.apiUrl = env.apiUrl;
    }

    private static createReadonlyWallet(pubKey: PublicKey): Wallet {
        return {
            publicKey: pubKey,
            signAllTransactions: async (txs: any) => txs,
            signTransaction: async (tx: any) => tx,
            payer: Keypair.generate(), // dummy unused payer
        };
    }

    private static createAnchorProvider(
        rpcUrl: string,
        wallet: Wallet,
        opts?: anchor.web3.ConfirmOptions) {

        opts = opts ?? Provider.defaultOptions();
        const connection = new Connection(rpcUrl, opts.preflightCommitment);
        const provider = new Provider(
            connection, wallet, opts,
        );
        return provider;
    }

    private static createProgram(
        rpcUrl: string,
        wallet: Wallet,
        confirmOptions?: anchor.web3.ConfirmOptions
    ): Program<MeanStake> {

        const provider = StakingClient.createAnchorProvider(rpcUrl, wallet, confirmOptions);
        // anchor.setProvider(provider);
        // const program = anchor.workspace.MeanStake as Program<MeanStake>;
        const program = new Program(IDL, MEAN_STAKE_ID, provider);
        return program;
    }

    public async findVaultAddress(): Promise<[PublicKey, number]> {
        return await anchor.web3.PublicKey.findProgramAddress(
            [this.mintPubkey.toBuffer()],
            this.program.programId
        );
    }

    public async findStateAddress(): Promise<[PublicKey, number]> {
        return await anchor.web3.PublicKey.findProgramAddress(
            [this.mintPubkey.toBuffer(), Buffer.from(anchor.utils.bytes.utf8.encode("staking-state"))],
            this.program.programId
        );
    }

    public async stakeTransaction(uiAmount: number): Promise<Transaction> {

        if (!this.walletPubKey)
            throw new Error("Wallet not connected");

        const [vaultPubkey, vaultBump] = await this.findVaultAddress();
        const [statePubkey, stateBump] = await this.findStateAddress();

        const walletTokenAccount = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            this.mintPubkey,
            this.program.provider.wallet.publicKey,
        );

        const walletXTokenAccount = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            this.xMintPubkey,
            this.program.provider.wallet.publicKey,
        );

        // Instructions
        let ixs: Array<TransactionInstruction> | undefined = new Array<TransactionInstruction>();

        let walletXTokenCreateInstruction = await createAtaCreateInstructionIfNotExists(
            walletXTokenAccount,
            this.xMintPubkey,
            this.program.provider.wallet.publicKey,
            this.program.provider.wallet.publicKey,
            this.connection);
        if (walletXTokenCreateInstruction)
            ixs.push(walletXTokenCreateInstruction);

        const tx = await this.program.transaction.stake(
            // vaultBump,
            new anchor.BN(uiAmount * E6),
            {
                preInstructions: ixs,
                accounts: {
                    tokenMint: this.mintPubkey,
                    xTokenMint: this.xMintPubkey,
                    tokenFrom: walletTokenAccount,
                    tokenFromAuthority: this.program.provider.wallet.publicKey,
                    tokenVault: vaultPubkey,
                    xTokenTo: walletXTokenAccount,
                    stakingState: statePubkey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            }
        );

        tx.feePayer = this.program.provider.wallet.publicKey;
        // this line fails in local with 'failed to get recent blockhash: Error: failed to get latest blockhash: Method not found'
        // let hash = await this.connection.getLatestBlockhash(this.connection.commitment);
        let hash = await this.connection.getRecentBlockhash(this.connection.commitment);
        tx.recentBlockhash = hash.blockhash;

        return tx;
    }

    public async unstakeTransaction(uiAmount: number): Promise<Transaction> {

        if (!this.walletPubKey)
            throw new Error("Wallet not connected");

        const [vaultPubkey, vaultBump] = await this.findVaultAddress();
        const [statePubkey, stateBump] = await this.findStateAddress();

        const walletTokenAccount = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            this.mintPubkey,
            this.program.provider.wallet.publicKey,
        );

        const walletXTokenAccount = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            this.xMintPubkey,
            this.program.provider.wallet.publicKey,
        );

        // Instructions
        let ixs: Array<TransactionInstruction> | undefined = new Array<TransactionInstruction>();

        let walletTokenCreateInstruction = await createAtaCreateInstructionIfNotExists(
            walletTokenAccount,
            this.mintPubkey,
            this.program.provider.wallet.publicKey,
            this.program.provider.wallet.publicKey,
            this.connection);
        if (walletTokenCreateInstruction)
            ixs.push(walletTokenCreateInstruction);

        const tx = await this.program.transaction.unstake(
            // vaultBump,
            new anchor.BN(uiAmount * E6),
            {
                preInstructions: ixs,
                accounts: {
                    tokenMint: this.mintPubkey,
                    xTokenMint: this.xMintPubkey,
                    xTokenFrom: walletXTokenAccount,
                    xTokenFromAuthority: this.program.provider.wallet.publicKey,
                    tokenVault: vaultPubkey,
                    tokenTo: walletTokenAccount,
                    stakingState: statePubkey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            }
        );

        tx.feePayer = this.program.provider.wallet.publicKey;
        // let hash = await this.connection.getLatestBlockhash(this.connection.commitment);
        let hash = await this.connection.getRecentBlockhash(this.connection.commitment);
        tx.recentBlockhash = hash.blockhash;

        return tx;
    }

    /**
     * 
     * @param depositPercentage 0-1 based percentage
     * @returns 
     */
    public async depositTransaction(depositPercentage: number): Promise<Transaction> {

        if (!this.walletPubKey)
            throw new Error("Wallet not connected");

        const [vaultPubkey, vaultBump] = await this.findVaultAddress();
        const [statePubkey, stateBump] = await this.findStateAddress();

        const walletTokenAccount = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            this.mintPubkey,
            this.program.provider.wallet.publicKey,
        );

        // Instructions
        let ixs: Array<TransactionInstruction> | undefined = new Array<TransactionInstruction>();

        const tx = await this.program.transaction.deposit(
            new anchor.BN(depositPercentage * 10_000),
            {
                preInstructions: ixs,
                accounts: {
                    tokenMint: this.mintPubkey,
                    tokenFrom: walletTokenAccount,
                    tokenFromAuthority: this.program.provider.wallet.publicKey,
                    tokenVault: vaultPubkey,
                    stakingState: statePubkey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            }
        );

        tx.feePayer = this.program.provider.wallet.publicKey;
        // this line fails in local with 'failed to get recent blockhash: Error: failed to get latest blockhash: Method not found'
        // let hash = await this.connection.getLatestBlockhash(this.connection.commitment);
        let hash = await this.connection.getRecentBlockhash(this.connection.commitment);
        tx.recentBlockhash = hash.blockhash;

        return tx;
    }

    public async getStakeTokenAmounts(): Promise<StakeTokenAmounts> {

        const [vaultPubkey, ] = await this.findVaultAddress();
        const stakeVaultMeanBalanceResponse = await this.connection.getTokenAccountBalance(vaultPubkey);
        if(!stakeVaultMeanBalanceResponse?.value)
            throw Error("Unable to MEAN token balance");
        const totalMeanAmount = new BN(stakeVaultMeanBalanceResponse.value.amount ?? 0);

        const sMeanSupplyResponse = await this.connection.getTokenSupply(this.xMintPubkey)
        if(!sMeanSupplyResponse?.value)
            throw Error("Unable to get sMEAN token supply");
        const sMeanSupplyAmount = new BN(sMeanSupplyResponse.value.amount ?? 0);

        const amounts: StakeTokenAmounts = {
            meanPoolTotalAmount: totalMeanAmount,
            sMeanTotalSupply: sMeanSupplyAmount,
        }
        // console.log("amounts.meanPoolTotalAmount:", amounts.meanPoolTotalAmount.toNumber());
        // console.log("amounts.sMeanTotalSupply:", amounts.sMeanTotalSupply.toNumber());
        
        return amounts;

    }

    public async getStakePoolInfo(meanPrice?: number): Promise<StakePoolInfo> {
        if(meanPrice && meanPrice <= 0)
            throw new Error("Invalid price input");

        meanPrice = meanPrice ?? await this.getMeanPrice();

        const [vaultPubkey, ] = await this.findVaultAddress();
        const [statePubkey, ] = await this.findStateAddress();
        const stakeVaultMeanBalanceResponse = await this.connection.getTokenAccountBalance(vaultPubkey);
        
        if(!stakeVaultMeanBalanceResponse?.value)
            throw Error("Unable to get stake pool info");

        const sMeanPrice = await this.getSMeanPrice();
        const sMeanToMeanRate = sMeanPrice.sMeanToMeanRateE9.toNumber() / E9;
        const meanToSMeanRate = new BN(E9)
            .mul(new BN(E9))
            .div(sMeanPrice.sMeanToMeanRateE9)
            .toNumber() / E9;
    
        const totalMeanUiAmount = stakeVaultMeanBalanceResponse.value.uiAmount ?? 0;
        const state = await this.program.account.stakingState.fetch(statePubkey);
        const depositsRaw = state.deposits as any[];
        const depositsDataLength = Math.min(state.depositsHead.toNumber(), depositsRaw.length);
        

        const numberOfDays = Math.min(depositsRaw.length, DEPOSITS_HISTORY_N_DAYS);
        const nowTs = Math.floor(Date.now() / 1000);
        const todayStartTs = Math.floor(nowTs / 86400) * 86400;
        const historyStartTs = todayStartTs - 86400 * numberOfDays;
        
        const deposits = this.getDepositRecords(depositsRaw, depositsDataLength, historyStartTs);
        const hasMissingDepositsData = depositsDataLength < depositsRaw.length;
        const apr = this.calculateApr(deposits, new BN(stakeVaultMeanBalanceResponse.value.amount), hasMissingDepositsData, historyStartTs);

        return {
            meanPrice: meanPrice, // sMEAN price TODO
            meanToSMeanRate: meanToSMeanRate, // amount of sMEAN per 1 MEAN
            sMeanToMeanRate: sMeanToMeanRate, // amount of MEAN per 1 sMEAN
            totalMeanAmount: stakeVaultMeanBalanceResponse.value,
            tvl: Math.round((totalMeanUiAmount * meanPrice + Number.EPSILON) * 1_000_000) / 1_000_000,
            apr: apr,
            totalMeanRewards: Math.max(totalMeanUiAmount - (state.totalStaked.toNumber() - state.totalUnstaked.toNumber()) / E6, 0) *  meanPrice,
        }
    }

    public getMintAddresses(): Env {
        return this.cluster === 'mainnet-beta' ? prodEnv : testEnv;
    }

    public async getSMeanPrice(): Promise<sMeanPrice> {
        const [vault, _] = await this.findVaultAddress();
        // simulate emit_price instruction
        const eventsResponse = await this.program.simulate.emitPrice({
            accounts: {
                tokenMint: this.mintPubkey,
                xTokenMint: this.xMintPubkey,
                tokenVault: vault,
            },
        });
        
        if (eventsResponse.events.length === 0)
            throw new Error("Unable to fetch price");

        const priceEvent = eventsResponse.events[0].data;
        const currentPrice: sMeanPrice = {
            sMeanToMeanRateE9: priceEvent.meanPerSmeanE9,
            sMeanToMeanRate: priceEvent.meanPerSmean
        };

        return currentPrice;
    }

    public async getStakeQuote(meanUiAmount: number): Promise<StakeQuote> {
        if(meanUiAmount === 0)
            throw new Error("Invalid input amount");

        // console.log(`meanUiAmount * E6: ${meanUiAmount * E6}`);
        
        const meanIn = new BN(meanUiAmount * E6);
        const sMeanPrice = await this.getSMeanPrice();
        // const sMeanOut = meanIn
        //     .mul(new BN(E9))
        //     .div(sMeanPrice.sMeanToMeanRateE9);

        const stakeTokenAmounts = await this.getStakeTokenAmounts();
        const sMeanOut = meanIn
            .mul(stakeTokenAmounts.sMeanTotalSupply)
            .div(stakeTokenAmounts.meanPoolTotalAmount);

        return {
            meanIn: meanIn,
            meanInUiAmount: meanUiAmount,
            sMeanOut: sMeanOut,
            sMeanOutUiAmount: sMeanOut.toNumber() / E6,
            sMeanToMeanRateE9: sMeanPrice.sMeanToMeanRateE9,
            sMeanToMeanRateUiAmount: sMeanPrice.sMeanToMeanRateE9.toNumber() / E9
        }
    }

    public async getUnstakeQuote(sMeanUiAmount: number): Promise<UnstakeQuote> {
        if(sMeanUiAmount === 0)
            throw new Error("Invalid input amount");
            
        // console.log(`sMeanUiAmount * E6: ${sMeanUiAmount * E6}`);

        const sMeanIn = new BN(sMeanUiAmount * E6);
        const sMeanPrice = await this.getSMeanPrice();
        // const meanOut = sMeanIn
        //     .mul(sMeanPrice.sMeanToMeanRateE9)
        //     .div(new BN(10 ** 9));
        
        const stakeTokenAmounts = await this.getStakeTokenAmounts();
        const meanOut = sMeanIn
            .mul(stakeTokenAmounts.meanPoolTotalAmount)
            .div(stakeTokenAmounts.sMeanTotalSupply);

        return {
            sMeanIn: sMeanIn,
            sMeanInUiAmount: sMeanUiAmount,
            meanOut: meanOut,
            meanOutUiAmount: meanOut.toNumber() / E6,
            sMeanToMeanRateE9: sMeanPrice.sMeanToMeanRateE9,
            sMeanToMeanRateUiAmount: sMeanPrice.sMeanToMeanRateE9.toNumber() / E9
        }
    }

    private getDepositRecords(
        depositsRaw: any[], 
        lenght: number, 
        historyStartTs: number
        ): DepositRecord[] {
        const deposits: DepositRecord[] = [];
        if (lenght === 0) {
            return deposits;
        }

        for (let i = 0; i < lenght; i++) {

            const depositRaw = depositsRaw[i];
            if (depositRaw.depositedTs < historyStartTs) {
                continue;
            }

            const deposit: DepositRecord = {
                totalStakeUiAmount: depositRaw.totalStaked.toNumber() / E6,
                totalStakedPlusRewardsUiAmount: depositRaw.totalStakedPlusRewards.toNumber() / E6,
                depositedTs: depositRaw.depositedTs.toNumber(),
                depositedUtc: tsToUTCString(depositRaw.depositedTs.toNumber()),
                depositedPercentage: depositRaw.depositedPercentageE4.toNumber() / 10_000,
                depositedUiAmount: depositRaw.depositedAmount.toNumber() / E6,
            };

            deposits.push(deposit);
        }

        deposits.sort((a, b) => b.depositedTs - a.depositedTs);
        return deposits;
    }

    private async getMeanPrice(): Promise<number> {
        // const options: RequestInit = {
        //     method: "GET",
        //     // headers: tempoHeaders
        // }
        
        try {
            const response = await fetch('https://api.raydium.io/coin/price')
            if (response.status !== 200) {
                throw new Error("Unable to get token prices");
            }

            const prices = (await response.json()) as any;
            return prices.MEAN;

        } catch (error) {
            throw (error);
        }
    }

    private calculateApr(
        depositRecords: DepositRecord[], 
        latestStakedPlusRewardsAmount: BN, 
        hasMissingDepositsData: boolean,
        historyStartTs: number,
        ): number {

        return 0.21; // TODO

        if(depositRecords.length === 0) {
            return 0;
        }
        
        const group: { [id: number] : DepositRecord[] } = {};
        for (let i = 0; i < depositRecords.length; i++) {
            const d = depositRecords[i];
            const tsKey = Math.floor(d.depositedTs / 86400) * 86400;
            if(!(tsKey in group)) {
                group[tsKey] = [d];
            }
            else {
                group[tsKey].push(d);
            }
        }

        // const aprs: number[] = [];
        // for (var k in group) {
        //     group[k].sort((a, b) => b.depositedTs - a.depositedTs);
        //     const dayRoi = group[k]
        //         .map(d => d.depositedUiAmount / d.totalStakedPlusRewardsUiAmount)
        //         .reduce((partialSum, r) => partialSum + r);
        //     aprs.push(dayRoi * 365);
        // }

        const dayDeposits: DayDepositRecord[] = [];
        for (var k in group) {
            group[k].sort((a, b) => b.depositedTs - a.depositedTs);
            const dayTotalDepositedUiAmount = group[k]
                .map(d => d.depositedUiAmount)
                .reduce((partialSum, r) => partialSum + r);
            const dayRoi = group[k]
                .map(d => d.depositedUiAmount / d.totalStakedPlusRewardsUiAmount)
                .reduce((partialSum, r) => partialSum + r);
            const dayDeposit: DayDepositRecord = {
                dayTs: parseInt(k),
                totalDepositedUiAmount: dayTotalDepositedUiAmount,
                totalApr: dayRoi * 365
            };
            dayDeposits.push(dayDeposit);
        }
        dayDeposits.sort((a, b) => b.dayTs - a.dayTs);

        if(dayDeposits.length < DEPOSITS_HISTORY_N_DAYS && hasMissingDepositsData) {
            const lastDayDeposit = dayDeposits[dayDeposits.length - 1];
            const nDaysToFill = (lastDayDeposit.dayTs - historyStartTs) / 86400;
            // console.log(`\nnDaysToFill: ${nDaysToFill}`);
            for (let i = 0; i < nDaysToFill; i++) {
                dayDeposits.push(lastDayDeposit);  
            }
            // console.log(`\ndayDeposits: ${dayDeposits}`);
        }

        // const apr = dayDeposits
        //     .map(d => d.totalApr)
        //     .reduce((partialSum, a) => partialSum + a) / DEPOSITS_HISTORY_N_DAYS;

        let aprSum = dayDeposits
            .map(d => d.totalApr)
            .reduce((partialSum, a) => partialSum + a);
        // aprSum += dayDeposits[0].totalDepositedUiAmount / (latestStakedPlusRewardsAmount.toNumber() / 1_000_000) * 365;
        // const apr = aprSum / (DEPOSITS_HISTORY_N_DAYS + 2);
        const apr = aprSum / (DEPOSITS_HISTORY_N_DAYS + 1)
        return apr;
    }

    public async getDepositsInfo(): Promise<DepositsInfo> {
        const [statePubkey, ] = await this.findStateAddress();
        const state = await this.program.account.stakingState.fetch(statePubkey);
        const depositsRaw = state.deposits as any[];
        
        
        const depositsDataLength = Math.min(state.depositsHead.toNumber(), depositsRaw.length);
        const numberOfDays = Math.min(depositsRaw.length, DEPOSITS_HISTORY_N_DAYS);
        const nowTs = Math.floor(Date.now() / 1000);
        const todayStartTs = Math.floor(nowTs / 86400) * 86400;
        const historyStartTs = todayStartTs - 86400 * numberOfDays;
        
        const deposits = this.getDepositRecords(depositsRaw, depositsDataLength, historyStartTs);
        const hasMissingDepositsData = depositsDataLength < depositsRaw.length;

        const [vaultPubkey, ] = await this.findVaultAddress();
        const stakeVaultMeanBalanceResponse = await this.connection.getTokenAccountBalance(vaultPubkey);
        if(!stakeVaultMeanBalanceResponse?.value)
            throw Error("Unable to get stake pool info");

        const apr = this.calculateApr(deposits, new BN(stakeVaultMeanBalanceResponse.value.amount), hasMissingDepositsData, historyStartTs); // todo

        return {
            apr: apr,
            depositRecords: deposits,
        }
    }
}

async function createAtaCreateInstructionIfNotExists(
    ataAddress: PublicKey,
    mintAddress: PublicKey,
    ownerAccountAddress: PublicKey,
    payerAddress: PublicKey,
    connection: Connection
): Promise<TransactionInstruction | null> {
    try {
        const ata = await connection.getAccountInfo(ataAddress);
        if (!ata) {
            let [_, createIx] = await createAtaCreateInstruction(ataAddress, mintAddress, ownerAccountAddress, payerAddress);
            return createIx;
        }

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
    if (ataAddress === null) {
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

function tsToUTCString(ts: number): string {
    return ts === 0 ? '' : new Date(ts * 1000).toUTCString();
}

export type Env = {
    mean: PublicKey,
    sMean: PublicKey,
    apiUrl: string,
}

export type StakeTokenAmounts = {
    meanPoolTotalAmount: BN,
    sMeanTotalSupply: BN,
}

export type StakePoolInfo = {
    meanPrice: number, // sMEAN price
    meanToSMeanRate: number, // amount of sMEAN per 1 MEAN
    sMeanToMeanRate: number, // amount of MEAN per 1 sMEAN
    totalMeanAmount: anchor.web3.TokenAmount,
    tvl: number, // USD
    apr: number, // 1-based percentage
    totalMeanRewards: number, // USD
}

export type sMeanPrice = {
    sMeanToMeanRateE9: BN, // 1 sMEAN = ? MEAN
    sMeanToMeanRate: string,
}

export type StakeQuote = {
    meanIn: BN,
    meanInUiAmount: number,
    sMeanOut: BN,
    sMeanOutUiAmount: number,
    sMeanToMeanRateE9: BN,
    sMeanToMeanRateUiAmount: number,
}

export type UnstakeQuote = {
    sMeanIn: BN,
    sMeanInUiAmount: number,
    meanOut: BN,
    meanOutUiAmount: number,
    sMeanToMeanRateE9: BN,
    sMeanToMeanRateUiAmount: number,
}

export type DepositRecord = {
    // totalStaked: BN,
    totalStakeUiAmount: number,
    // totalStakedPlusRewards: BN,
    totalStakedPlusRewardsUiAmount: number,
    depositedTs: number,
    depositedUtc: string,
    // depositedPercentageE4: BN,
    depositedPercentage: number,
    // depositedAmount: BN,
    depositedUiAmount: number,
}

export type DayDepositRecord = {
    dayTs: number,
    totalDepositedUiAmount: number,
    totalApr: number,
}

export type DepositsInfo = {
    apr: number, // 1-based percentage
    depositRecords: DepositRecord[],
}
