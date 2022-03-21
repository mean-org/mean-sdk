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

// CONSTANTS
const SYSTEM_PROGRAM_ID = anchor.web3.SystemProgram.programId;
const SYSVAR_RENT_PUBKEY = anchor.web3.SYSVAR_RENT_PUBKEY;
const DECIMALS = 6;
const E6 = 1_000_000;
const E9 = 1_000_000_000;
const DECIMALS_BN = new BN(DECIMALS);
const READONLY_PUBKEY = new PublicKey("3KmMEv7A8R3MMhScQceXBQe69qLmnFfxSM3q8HyzkrSx");
const MEAN_STAKE_ID = new PublicKey('MSTKTNxDrVTd32qF8kyaiUhFidmgPaYGU932FbRa7eK');

const mainnetMintAddresses: EnvMintAddresses = {
    mean: new PublicKey('MEANeD3XDdUmNMsRGjASkSWdC8prLYsoRJ61pPeHctD'),
    sMean: new PublicKey('sMEANebFMnd9uTYpyntGzBmTmzEukRFwCjEcnXT2E8z'),
};

const testMintAddresses: EnvMintAddresses = {
    mean: new PublicKey('MNZeoVuS87pFssHCbxKHfddvJk4MjmM2RHjQskrk7qs'),
    sMean: new PublicKey('sMNxc4HFhtyY9adKKmE2TBq4poD36moXN8W7YiQMsTA'),
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

        const mints = this.cluster === 'mainnet-beta' ? mainnetMintAddresses : testMintAddresses;
        this.mintPubkey = mints.mean;
        this.xMintPubkey = mints.sMean;
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
            [this.mintPubkey.toBuffer(), Buffer.from(anchor.utils.bytes.utf8.encode("state"))],
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
                    state: statePubkey,
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
                    state: statePubkey,
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

    public async getStakePoolInfo(): Promise<StakePoolInfo> {

        const [vaultPubkey, _] = await this.findVaultAddress();
        const stakeVaultMeanBalanceResponse = await this.connection.getTokenAccountBalance(vaultPubkey);
        if(!stakeVaultMeanBalanceResponse?.value)
            throw Error("Unable to get stake pool info");

        const sMeanPrice = await this.getSMeanPrice();
        const sMeanToMeanRate = sMeanPrice.sMeanToMeanRateE9.toNumber() / E9;
        const meanToSMeanRate = new BN(E9)
            .mul(new BN(E9))
            .div(sMeanPrice.sMeanToMeanRateE9)
            .toNumber() / E9;

        return {
            sMeanToUsdcRate: 0, // sMEAN price TODO
            meanToSMeanRate: meanToSMeanRate, // amount of sMEAN per 1 MEAN
            sMeanToMeanRate: sMeanToMeanRate, // amount of MEAN per 1 sMEAN
            tvlMeanAmount: stakeVaultMeanBalanceResponse.value,
            tvl: 0,
            apy: 0
        }
    }

    public getMintAddresses(): EnvMintAddresses {
        return this.cluster === 'mainnet-beta' ? mainnetMintAddresses : testMintAddresses;
    }

    private async getSMeanPrice(): Promise<sMeanPrice> {
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
        const meanIn = new BN(meanUiAmount * E6);
        const sMeanPrice = await this.getSMeanPrice();
        const sMeanOut = meanIn
            .mul(new BN(E9))
            .div(sMeanPrice.sMeanToMeanRateE9);

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
        const sMeanIn = new BN(sMeanUiAmount * E6);
        const sMeanPrice = await this.getSMeanPrice();
        const meanOut = sMeanIn
            .mul(sMeanPrice.sMeanToMeanRateE9)
            .div(new BN(10 ** 9));

        return {
            sMeanIn: sMeanIn,
            sMeanInUiAmount: sMeanUiAmount,
            meanOut: meanOut,
            meanOutUiAmount: meanOut.toNumber() / E6,
            sMeanToMeanRateE9: sMeanPrice.sMeanToMeanRateE9,
            sMeanToMeanRateUiAmount: sMeanPrice.sMeanToMeanRateE9.toNumber() / E9
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

export type EnvMintAddresses = {
    mean: PublicKey,
    sMean: PublicKey,
}

export type StakePoolInfo = {
    sMeanToUsdcRate: number, // sMEAN price
    meanToSMeanRate: number, // amount of sMEAN per 1 MEAN
    sMeanToMeanRate: number, // amount of MEAN per 1 sMEAN
    tvlMeanAmount: anchor.web3.TokenAmount,
    tvl: number,
    apy: number,
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
