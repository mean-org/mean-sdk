import { Wallet as IWallet } from '@project-serum/anchor/dist/provider';
import Wallet from '@project-serum/sol-wallet-adapter';
import { PublicKey } from '@solana/web3.js';

export interface IWalletAdapter extends IWallet {

    signMessage: (msg: string) => Promise<{
        signature: Buffer;
        publicKey: PublicKey | null;
    }>;

    publicKey: PublicKey;
}

export class WalletAdapter extends Wallet implements IWalletAdapter {

    provider: any;

    constructor(provider: any, network: string) {
        super(provider, network);
        this.provider = provider;
    }

    get publicKey(): PublicKey {
        return super.publicKey || PublicKey.default;
    }

    public async signMessage(msg: string): Promise<{
        signature: Buffer;
        publicKey: PublicKey | null;

    }> {

        let self = this;
        let enc = new TextEncoder(),
            buffer = enc.encode(msg),
            data = {
                signature: Buffer.alloc(0),
                publicKey: PublicKey.default
            };

        if (!self.provider) {
            throw Error('Invalid provider');
        }

        if ('sign' in self.provider && typeof self.provider.sign === 'function') {
            data = await super.sign(buffer, 'hex');
        } else if ('signMessage' in self.provider && typeof self.provider.signMessage === 'function') {
            data = self.provider.signMessage(buffer, 'utf-8');
        } else {
            throw Error('Invalid provider');
        }

        return data;
    }
}

