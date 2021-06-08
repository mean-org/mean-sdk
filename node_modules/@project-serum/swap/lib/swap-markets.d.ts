import { Provider } from '@project-serum/anchor';
import { TokenListContainer } from '@solana/spl-token-registry';
import { PublicKey } from '@solana/web3.js';
export default class SwapMarkets {
    private provider;
    private tokenList;
    constructor(provider: Provider, tokenList: TokenListContainer);
    tokens(): PublicKey[];
    pairs(mint: PublicKey): PublicKey[];
    getMarketAddressIfNeeded(usdxMint: PublicKey, baseMint: PublicKey): Promise<PublicKey>;
    getMarketAddress(usdxMint: PublicKey, baseMint: PublicKey): PublicKey | null;
    usdcPathExists(fromMint: PublicKey, toMint: PublicKey): boolean;
    route(fromMint: PublicKey, toMint: PublicKey): PublicKey[] | null;
}
//# sourceMappingURL=swap-markets.d.ts.map