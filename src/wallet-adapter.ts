import { Wallet } from '@project-serum/anchor';
import { PublicKey, Transaction } from '@solana/web3.js';

import EventEmitter from 'eventemitter3';

export interface WalletAdapter extends EventEmitter, Wallet {
    publicKey: PublicKey;
    signTransaction: (transaction: Transaction) => Promise<Transaction>;
    signAllTransactions(txs: Transaction[]): Promise<Transaction[]>;
    connect: () => any;
    disconnect: () => any;
}