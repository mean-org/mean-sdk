import { Wallet as IWallet } from '@project-serum/anchor/dist/provider';
import Wallet from '@project-serum/sol-wallet-adapter';
import { PublicKey, Transaction } from '@solana/web3.js';

export interface IWalletAdapter extends IWallet {
    publicKey: PublicKey;
    connect: () => any;
    disconnect: () => any;
    signTransaction: (tx: Transaction) => Promise<Transaction>;
    signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>;
    signMessage: (msg: string) => Promise<{
        signature: Buffer;
        publicKey: PublicKey;
    }>;
}

// const wallet = useMemo(
//     function () {
//         let adapter: any;
//
//         if (provider && provider.adapter) {
//             adapter = new (provider.adapter) (providerUrl, endpoint);
//         } else {
//            adapter = new WalletAdapter(
//                providerUrl,
//                network
//            );
//         }

//         return adapter;
//     },
//     [provider, providerUrl, endpoint]
// );

export class WalletAdapter extends Wallet implements IWalletAdapter {

    constructor(provider: unknown, network: string) {
        super(provider, network);
    }

    get publicKey(): PublicKey {
        return super.publicKey || PublicKey.default;
    }

    public async signMessage(msg: string): Promise<{
        signature: Buffer;
        publicKey: PublicKey;
    }> {

        const msgBuffer = new TextEncoder().encode(msg);
        const result = super.sign(msgBuffer, 'utf-8');

        return result;
    }

}