import { Program, Provider, BN, Wallet } from '@project-serum/anchor';
import { Market, OpenOrders } from '@project-serum/serum';
import { TokenListProvider } from '@solana/spl-token-registry';
import { Account, Cluster, Commitment, Connection, PublicKey, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction } from '@solana/web3.js';
import { SwapParams } from "@project-serum/swap";
import SwapMarkets from '@project-serum/swap/lib/swap-markets';
import { getVaultOwnerAndNonce } from '@project-serum/swap/lib/utils';
import { IDL } from '@project-serum/swap/lib/idl';
import * as Utils from './utils';
import { Constants, PublicKeys } from './types';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

type ExchangeRate = {
    rate: BN;
    fromDecimals: number;
    quoteDecimals: number;
    strict: boolean;
};

type SideEnum = any;

const Side = {
    Bid: { bid: {} },
    Ask: { ask: {} },
};

export class TokenSwap {

    private serumDex: PublicKey = Constants.SERUM_SWAP_KEY;
    private markets!: SwapMarkets;
    private program!: Program;
    private connection!: Connection;
    private cluster!: Cluster | string;

    constructor(
        connection: Connection,
        wallet: Wallet,
        cluster: Cluster | string,
        commitment: Commitment | string
    ) {

        const self = this;

        new TokenListProvider().resolve().then((container) => {
            let preflightCommitment = typeof commitment === 'string' ? commitment : 'finalized';
            let provider = new Provider(
                connection,
                wallet,
                {
                    commitment: preflightCommitment as Commitment,
                    preflightCommitment: preflightCommitment as Commitment
                }
            );

            self.program = new Program(IDL, self.serumDex, provider);
            self.markets = new SwapMarkets(provider, container);
            self.connection = connection;
            self.cluster = cluster;
        });
    }

    public async swapTransaction(params: SwapParams): Promise<Transaction> {
        const [ixs] = await this.swapInstructions(params);
        return new Transaction().add(...ixs);
    }

    public async estimate(params: SwapParams): Promise<BN> {
        const [ixs, signers] = await this.swapInstructions(params);
        console.log('[ixs, signers]: ', [ixs, signers]);
        const tx = new Transaction().add(...ixs);
        console.log('tx: ', tx);
        // Simulate it.
        const resp = await this.program.provider.simulate(tx, signers, params.options);
        console.log('resp: ', resp);

        if (resp === undefined || resp.value.err || !resp.value.logs) {
            throw new Error('Unable to simulate swap');
        }

        // Decode the return value.
        let didSwapEvent = resp.value.logs
            .filter((log) => log.startsWith('Program log: 4ZfIrPLY4R'))
            .map((log) => {
                const logStr = log.slice('Program log: '.length);
                const logBuffer = Utils.decode(logStr);
                return this.program.coder.events.decode(logBuffer.toString())
            })[0];

        console.log(didSwapEvent);
        let amount = new BN(didSwapEvent?.data as number);

        return amount;
    }

    private async swapInstructions(
        params: SwapParams

    ): Promise<[TransactionInstruction[], Account[]]> {

        const usdcPublicKey = PublicKeys.USDC_TOKEN_MINT_KEY[this.cluster];
        const usdtPublicKey = PublicKeys.USDT_TOKEN_MINT_KEY[this.cluster];

        let {
            fromMint,
            toMint,
            fromWallet,
            toWallet,
            quoteWallet,
            amount,
            minExchangeRate,
            referral

        } = params;

        if (!fromWallet) {
            fromWallet = await Utils.findATokenAddress(
                this.program.provider.wallet.publicKey,
                fromMint
            );
        }

        if (!toWallet) {
            toWallet = await Utils.findATokenAddress(
                this.program.provider.wallet.publicKey,
                toMint
            );
        }

        if (fromMint.equals(usdcPublicKey) || fromMint.equals(usdtPublicKey)) {

            return await this.swapDirectInstructions({
                coinWallet: toWallet,
                pcWallet: fromWallet,
                baseMint: toMint,
                quoteMint: fromMint,
                side: Side.Bid,
                amount,
                minExchangeRate,
            });

        } else if (toMint.equals(usdcPublicKey) || toMint.equals(usdtPublicKey)) {

            return await this.swapDirectInstructions({
                coinWallet: fromWallet,
                pcWallet: toWallet,
                baseMint: fromMint,
                quoteMint: toMint,
                side: Side.Ask,
                amount,
                minExchangeRate,
            });
        }

        if (!quoteWallet) {
            if (this.markets.usdcPathExists(fromMint, toMint)) {
                quoteWallet = await Utils.findATokenAddress(
                    this.program.provider.wallet.publicKey,
                    PublicKeys.USDC_TOKEN_MINT_KEY[this.cluster]
                );

            } else {
                quoteWallet = await Utils.findATokenAddress(
                    this.program.provider.wallet.publicKey,
                    PublicKeys.USDT_TOKEN_MINT_KEY[this.cluster]
                );
            }
        }

        return await this.swapTransitiveInstructions({
            fromMint,
            toMint,
            fromWallet,
            toWallet,
            pcWallet: quoteWallet,
            amount,
            minExchangeRate,
            referral,
        });
    }

    private async swapDirectInstructions({
        coinWallet,
        pcWallet,
        baseMint,
        quoteMint,
        side,
        amount,
        minExchangeRate

    }: {
        coinWallet: PublicKey;
        pcWallet: PublicKey;
        baseMint: PublicKey;
        quoteMint: PublicKey;
        side: SideEnum;
        amount: BN;
        minExchangeRate: ExchangeRate;

    }): Promise<[TransactionInstruction[], Account[]]> {

        console.log('marketAddress: ', this.markets.getMarketAddress(quoteMint, baseMint) as PublicKey);

        const marketClient = await Market.load(
            this.program.provider.connection,
            this.markets.getMarketAddress(quoteMint, baseMint) as PublicKey,
            this.program.provider.opts,
            this.serumDex
        );

        console.log('marketClient: ', marketClient);

        const [vaultSigner] = await getVaultOwnerAndNonce(marketClient.address);

        console.log('vaultSigner: ', vaultSigner);

        let openOrders = await (async () => {
            let openOrders = await OpenOrders.findForMarketAndOwner(
                this.program.provider.connection,
                marketClient.address,
                this.program.provider.wallet.publicKey,
                this.serumDex,
            );

            return openOrders[0] ? openOrders[0].address : undefined;

        })();

        console.log('openOrders: ', openOrders);

        const needsOpenOrders = openOrders === undefined;
        const ixs: TransactionInstruction[] = [];
        const signers: Account[] = [];

        if (needsOpenOrders) {
            const oo = new Account();
            signers.push(oo);
            openOrders = oo.publicKey;

            ixs.push(
                await OpenOrders.makeCreateAccountTransaction(
                    this.program.provider.connection,
                    marketClient.address,
                    this.program.provider.wallet.publicKey,
                    oo.publicKey,
                    Constants.SERUM_DEX_KEY
                )
            );
        }

        ixs.push(
            this.program.instruction.swap(side, amount, minExchangeRate, {
                accounts: {
                    market: {
                        market: marketClient.address,
                        // @ts-ignore
                        requestQueue: marketClient._decoded.requestQueue,
                        // @ts-ignore
                        eventQueue: marketClient._decoded.eventQueue,
                        bids: marketClient.bidsAddress,
                        asks: marketClient.asksAddress,
                        // @ts-ignore
                        coinVault: marketClient._decoded.baseVault,
                        // @ts-ignore
                        pcVault: marketClient._decoded.quoteVault,
                        vaultSigner,
                        openOrders,
                        orderPayerTokenAccount: side.bid ? pcWallet : coinWallet,
                        coinWallet: coinWallet,
                    },
                    pcWallet,
                    authority: this.program.provider.wallet.publicKey,
                    dexProgram: Constants.SERUM_DEX_KEY,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    rent: SYSVAR_RENT_PUBKEY,
                }
            }),
        );

        const _enabled = false;

        if (_enabled && needsOpenOrders) {
            ixs.push(
                this.program.instruction.closeAccount({
                    accounts: {
                        openOrders,
                        authority: this.program.provider.wallet.publicKey,
                        destination: this.program.provider.wallet.publicKey,
                        market: marketClient.address,
                        dexProgram: Constants.SERUM_DEX_KEY
                    }
                })
            );
        }

        return [ixs, signers];
    }

    private async swapTransitiveInstructions({
        fromMint,
        toMint,
        fromWallet,
        toWallet,
        pcWallet,
        amount,
        minExchangeRate,
        referral,
    }: {
        fromMint: PublicKey;
        toMint: PublicKey;
        fromWallet: PublicKey;
        toWallet: PublicKey;
        pcWallet: PublicKey;
        amount: BN;
        minExchangeRate: ExchangeRate;
        referral?: PublicKey;

    }): Promise<[TransactionInstruction[], Account[]]> {

        const usdcPublicKey = PublicKeys.USDC_TOKEN_MINT_KEY[this.cluster];
        const usdtPublicKey = PublicKeys.USDT_TOKEN_MINT_KEY[this.cluster];

        let fromMarket: PublicKey | null,
            toMarket: PublicKey | null;

        try {

            fromMarket = this.markets.getMarketAddress(usdcPublicKey, fromMint);
            toMarket = this.markets.getMarketAddress(usdtPublicKey, toMint);

        } catch (err) {

            fromMarket = this.markets.getMarketAddress(usdcPublicKey, fromMint);
            toMarket = this.markets.getMarketAddress(usdtPublicKey, toMint);

        }

        const [fromMarketClient, toMarketClient] = await Promise.all([
            Market.load(
                this.program.provider.connection,
                fromMarket as PublicKey,
                this.program.provider.opts,
                Constants.SERUM_DEX_KEY,
            ),

            Market.load(
                this.program.provider.connection,
                toMarket as PublicKey,
                this.program.provider.opts,
                Constants.SERUM_DEX_KEY,
            )
        ]);

        const [fromVaultSigner] = await getVaultOwnerAndNonce(fromMarketClient.address);
        const [toVaultSigner] = await getVaultOwnerAndNonce(toMarketClient.address);
        const [fromOpenOrders, toOpenOrders] = await (async () => {

            let [fromOpenOrders, toOpenOrders] = await Promise.all([
                OpenOrders.findForMarketAndOwner(
                    this.program.provider.connection,
                    fromMarketClient.address,
                    this.program.provider.wallet.publicKey,
                    Constants.SERUM_DEX_KEY,
                ),
                OpenOrders.findForMarketAndOwner(
                    this.program.provider.connection,
                    toMarketClient.address,
                    this.program.provider.wallet.publicKey,
                    Constants.SERUM_DEX_KEY,
                ),
            ]);

            return [
                fromOpenOrders[0] ? fromOpenOrders[0].address : undefined,
                toOpenOrders[0] ? toOpenOrders[0].address : undefined,
            ];

        })();

        const fromNeedsOpenOrders = fromOpenOrders === undefined;
        const toNeedsOpenOrders = toOpenOrders === undefined;
        const ixs: TransactionInstruction[] = [];
        const signers: Account[] = [];
        let accounts: Account[] = [];

        if (fromNeedsOpenOrders || true) {
            const openOrder = new Account();
            signers.push(openOrder);
            accounts.push(openOrder);
        }

        if (toNeedsOpenOrders || true) {
            const openOrder = new Account();
            signers.push(openOrder);
            accounts.push(openOrder);
        }

        if (fromNeedsOpenOrders || toNeedsOpenOrders || true) {
            let remainingAccounts = accounts.map((a) => {
                return {
                    pubkey: a.publicKey,
                    isSigner: true,
                    isWritable: true,
                };
            });

            const openOrdersSize = 200;
            const lamports = new BN(
                await this.program.provider.connection.getMinimumBalanceForRentExemption(
                    openOrdersSize,
                ),
            );

            // ixs.push(
            //     this.program.instruction.createAccounts({
            //         accounts: {
            //             funding: this.program.provider.wallet.publicKey,
            //             owner: Constants.SERUM_DEX_KEY.toPublicKey(),
            //             systemProgram: SystemProgram.programId,
            //         },
            //         remainingAccounts,
            //     })
            // );
        }

        ixs.push(
            this.program.instruction.swapTransitive(amount, minExchangeRate, {
                accounts: {
                    from: {
                        market: fromMarketClient.address,
                        // @ts-ignore
                        requestQueue: fromMarketClient._decoded.requestQueue,
                        // @ts-ignore
                        eventQueue: fromMarketClient._decoded.eventQueue,
                        bids: fromMarketClient.bidsAddress,
                        asks: fromMarketClient.asksAddress,
                        // @ts-ignore
                        coinVault: fromMarketClient._decoded.baseVault,
                        // @ts-ignore
                        pcVault: fromMarketClient._decoded.quoteVault,
                        vaultSigner: fromVaultSigner,
                        openOrders: fromOpenOrders,
                        orderPayerTokenAccount: fromWallet,
                        coinWallet: fromWallet,
                    },
                    to: {
                        market: toMarketClient.address,
                        // @ts-ignore
                        requestQueue: toMarketClient._decoded.requestQueue,
                        // @ts-ignore
                        eventQueue: toMarketClient._decoded.eventQueue,
                        bids: toMarketClient.bidsAddress,
                        asks: toMarketClient.asksAddress,
                        // @ts-ignore
                        coinVault: toMarketClient._decoded.baseVault,
                        // @ts-ignore
                        pcVault: toMarketClient._decoded.quoteVault,
                        vaultSigner: toVaultSigner,
                        openOrders: toOpenOrders,
                        orderPayerTokenAccount: pcWallet,
                        coinWallet: toWallet,
                    },
                    pcWallet,
                    authority: this.program.provider.wallet.publicKey,
                    dexProgram: Constants.SERUM_DEX_KEY,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    rent: SYSVAR_RENT_PUBKEY,
                },
                remainingAccounts: referral && [referral],
            }),
        );

        return [ixs, signers];
    }
}