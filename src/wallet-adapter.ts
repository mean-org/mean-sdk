import { Wallet as IWallet } from '@project-serum/anchor/dist/provider';
import Wallet from '@project-serum/sol-wallet-adapter';
import { PublicKey, Transaction } from '@solana/web3.js';

export interface IWalletAdapter extends IWallet {
    publicKey: PublicKey;
    signTransaction: (transaction: Transaction) => Promise<Transaction>;
    signAllTransactions(txs: Transaction[]): Promise<Transaction[]>;
    connect: () => any;
    disconnect: () => any;
    sign: (data: Uint8Array, display: unknown) => Promise<{
        signature: Buffer;
        publicKey: PublicKey;
    }>;
}

export class WalletAdapter extends Wallet { }

