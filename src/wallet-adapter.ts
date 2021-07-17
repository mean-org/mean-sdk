import { PublicKey, Transaction } from '@solana/web3.js';

export interface WalletAdapter {
    publicKey: PublicKey;
    connect: () => any;
    disconnect: () => any;
    signTransaction: (tx: Transaction) => Promise<Transaction>;
    signAllTransaction: (txs: Transaction[]) => Promise<Transaction>;
}

