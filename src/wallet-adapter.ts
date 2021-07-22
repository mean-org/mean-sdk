import { Wallet as IWallet } from '@project-serum/anchor/dist/provider';
import { PublicKey, Transaction } from '@solana/web3.js';
import EventEmitter from 'eventemitter3';

export interface WalletAdapter extends EventEmitter, IWallet {
    publicKey: PublicKey;
    connect: () => any;
    disconnect: () => any;
    signTransaction: (tx: Transaction) => Promise<Transaction>;
    signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>;
}