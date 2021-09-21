import { TokenInfo } from '@solana/spl-token-registry';

export const getTokenDecimals = (address: string): number => {
    const tokenFromTokenList = MEAN_TOKEN_LIST.find(t => t.address === address);
    if (tokenFromTokenList) {
        return tokenFromTokenList.decimals;
    }
    return 0;
}

export const MEAN_TOKEN_LIST: Array<TokenInfo> = [
    {
        chainId: 101,
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        logoURI: 'https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
        tags: [
            'stablecoin',
        ],
        extensions: {
            website: 'https://www.centre.io/',
            coingeckoId: 'usd-coin',
        },
    },
    {
        chainId: 102,
        address: 'CpMah17kQEL2wqyMKt3mZBdTnZbkbfx4nqmQMFDP5vwp',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        logoURI: 'https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
        tags: [
            'stablecoin',
        ],
        extensions: {
            website: 'https://www.centre.io/',
            coingeckoId: 'usd-coin',
        },
    },
    {
        chainId: 103,
        address: 'AbQBt9V212HpPVk64YWAApFJrRzdAdu66fwF9neYucpU',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        logoURI: 'https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
        tags: [
            'stablecoin',
        ],
        extensions: {
            website: 'https://www.centre.io/',
            coingeckoId: 'usd-coin',
        },
    },
    {
        chainId: 101,
        address: '2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk',
        symbol: 'ETH',
        name: 'Wrapped Ethereum',
        decimals: 6,
        logoURI: 'https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
        tags: [
            'wrapped-sollet',
            'ethereum',
        ],
        extensions: {
            bridgeContract: 'https://etherscan.io/address/0xeae57ce9cc1984f202e15e038b964bb8bdf7229a',
            serumV3Usdc: '4tSvZvnbyzHXLMTiFonMyxZoHmFqau1XArcRCVHLZ5gX',
            serumV3Usdt: '7dLVkUfBVfCGkFhSXDCq1ukM9usathSgS716t643iFGF',
            coingeckoId: 'ethereum',
        },
    },
    {
        chainId: 101,
        address: '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
        symbol: 'BTC',
        name: 'Wrapped Bitcoin',
        decimals: 6,
        logoURI: 'https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/bitcoin/info/logo.png',
        tags: [
            'wrapped-sollet',
            'ethereum',
        ],
        extensions: {
            bridgeContract: 'https://etherscan.io/address/0xeae57ce9cc1984f202e15e038b964bb8bdf7229a',
            serumV3Usdc: 'A8YFbxQYFVqKZaoYJLLUVcQiWP7G2MeEgW5wsAQgMvFw',
            serumV3Usdt: 'C1EuT9VokAKLiW7i2ASnZUvxDoKuKkCpDDeNxAptuNe4',
            coingeckoId: 'bitcoin',
        },
    },
    {
        chainId: 101,
        address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        symbol: 'USDT',
        name: 'USDT',
        decimals: 6,
        logoURI: 'https://cdn.jsdelivr.net/gh/solana-labs/explorer/public/tokens/usdt.svg',
        tags: [
            'stablecoin',
        ],
        extensions: {
            website: 'https://tether.to/',
            coingeckoId: 'tether',
        },
    },
    {
        chainId: 103,
        address: '42f2yFqXh8EDCRCiEBQSweWqpTzKGa9DC8e7UjUfFNrP',
        symbol: 'USDT',
        name: 'USDT',
        decimals: 6,
        logoURI: 'https://cdn.jsdelivr.net/gh/solana-labs/explorer/public/tokens/usdt.svg',
        tags: [
            'stablecoin',
        ],
        extensions: {
            website: 'https://tether.to/',
            coingeckoId: 'tether',
        },
    },
    {
        chainId: 101,
        address: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        name: 'Wrapped SOL',
        decimals: 9,
        logoURI: 'https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/solana/info/logo.png',
        tags: [],
        extensions: {
            website: 'https://solana.com/',
            serumV3Usdc: '9wFFyRfZBsuAha4YcuxcXLKwMxJR43S7fPfQLusDBzvT',
            serumV3Usdt: 'HWHvQhFmJB3NUcu1aihKmrKegfVxBEHzwVX6yZCKEsi1',
            coingeckoId: 'solana',
        },
    },
    {
        chainId: 102,
        address: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        name: 'Wrapped SOL',
        decimals: 9,
        logoURI: 'https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/solana/info/logo.png',
        tags: [],
        extensions: {
            website: 'https://www.solana.com/',
            coingeckoId: 'solana',
        },
    },
    {
        chainId: 103,
        address: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        name: 'Wrapped SOL',
        decimals: 9,
        logoURI: 'https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/solana/info/logo.png',
        tags: [],
        extensions: {
            coingeckoId: 'solana',
        },
    }
];
