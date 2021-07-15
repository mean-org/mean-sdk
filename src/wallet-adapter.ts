import EventEmitter from 'eventemitter3';
import { Wallet } from '@project-serum/anchor/dist/provider';
import { PublicKey, Transaction } from '@solana/web3.js';
import { TransactionMessage } from './money-streaming';

export interface WalletAdapter extends EventEmitter, Wallet {
    publicKey: PublicKey;
    signMessage: (message: TransactionMessage) => Promise<Transaction>;
    signTransaction: (transaction: Transaction) => Promise<Transaction>;
    signAllTransactions(txs: Transaction[]): Promise<Transaction[]>;
    connect: () => any;
    disconnect: () => any;
}
