import { Wallet as IWallet } from '@project-serum/anchor/dist/provider';
import Wallet from '@project-serum/sol-wallet-adapter';
import { PublicKey, Transaction } from '@solana/web3.js';

export interface IWalletAdapter extends IWallet {
    publicKey: PublicKey;
    connect: () => any;
    disconnect: () => any;
    signTransaction: (tx: Transaction) => Promise<Transaction>;
    signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>;
}

export class WalletAdapter extends Wallet implements IWalletAdapter {

    constructor(provider: unknown, network: string) {
        super(provider, network);
    }

    get publicKey(): PublicKey {
        return super.publicKey || PublicKey.default;
    }

    public async signMessage(
        data: Uint8Array,
        display: unknown
    ): Promise<{
        signature: Buffer;
        publicKey: PublicKey;
    }> {

        let self = this;

        if ('signMessage' in self && typeof self.signMessage === 'function') {
            return self.signMessage(data, display);
        }

        return self.sign(data, display);
    };

}