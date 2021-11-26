import { } from "@solana/web3.js";
import { NATIVE_SOL_MINT, WRAPPED_SOL_MINT } from "../types";
import { Tokens, TokenInfo } from "./types";

export const NATIVE_SOL: TokenInfo = {
    symbol: 'SOL',
    name: 'Native SOL',
    address: NATIVE_SOL_MINT.toString(),
    decimals: 9,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    tags: ['raydium'],
}
  
export const TOKENS: Tokens = {
  WSOL: {
    symbol: 'wSOL',
    name: 'Wrapped SOL',
    address: WRAPPED_SOL_MINT.toBase58(),
    decimals: 9,
    referrer: 'HTcarLHe7WRxBQCWvhVB8AP56pnEtJUV2jDGvcpY3xo5',
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    tags: ['raydium']
  },
  BTC: {
    symbol: 'BTC',
    name: 'Wrapped Bitcoin',
    address: '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
    decimals: 6,
    referrer: 'GZpS8cY8Nt8HuqxzJh6PXTdSxc38vFUjBmi7eEUkkQtG',
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E/logo.png",
    tags: ['raydium']
  },
  ETH: {
    symbol: 'ETH',
    name: 'Wrapped Ethereum',
    address: '2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk',
    decimals: 6,
    referrer: 'CXPTcSxxh4AT38gtv3SPbLS7oZVgXzLbMb83o4ziXjjN',
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk/logo.png",
    tags: ['raydium']
  },
  USDT: {
    symbol: 'USDT',
    name: 'USDT',
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
    referrer: '8DwwDNagph8SdwMUdcXS5L9YAyutTyDJmK6cTKrmNFk3',
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg",
    tags: ['raydium']
  },
  USDC: {
    symbol: 'USDC',
    name: 'USDC',
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    referrer: '92vdtNjEg6Zth3UU1MgPgTVFjSEzTHx66aCdqWdcRkrg',
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
    tags: ['raydium']
  },
  RAY: {
    symbol: 'RAY',
    name: 'Raydium',
    address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    decimals: 6,
    referrer: '33XpMmMQRf6tSPpmYyzpwU4uXpZHkFwCZsusD9dMYkjy',
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png",
    tags: ['raydium']
  },
  SRM: {
    symbol: 'SRM',
    name: 'Serum',
    address: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
    decimals: 6,
    referrer: 'HYxa4Ea1dz7ya17Cx18rEGUA1WbCvKjXjFKrnu8CwugH',
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt/logo.png",
    tags: ['raydium']
  },
  SLRS: {
    symbol: 'SLRS',
    name: 'SLRS',
    address: 'SLRSSpSLUTP7okbCUBYStWCo1vUgyt775faPqz8HUMr',
    decimals: 6,
    referrer: 'AmqeHgTdm6kBzy5ewZFKuMAfbynZmhve1GQxbJzQFLbP',
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/SLRSSpSLUTP7okbCUBYStWCo1vUgyt775faPqz8HUMr/logo.png",
    tags: ['raydium']
  },
  GRAPE: {
    symbol: 'GRAPE',
    name: 'GRAPE',
    address: '8upjSpvjcdpuzhfR1zriwg5NXkwDruejqNE9WNbPRtyA',
    decimals: 6,
    referrer: 'M4nDMB9krXbaNFPVu1DjrBTfqPUHbKEQLZSSDNH2JrL',
    logoURI: "https://lh3.googleusercontent.com/y7Wsemw9UVBc9dtjtRfVilnS1cgpDt356PPAjne5NvMXIwWz9_x7WKMPH99teyv8vXDmpZinsJdgiFQ16_OAda1dNcsUxlpw9DyMkUk=s0",
    tags: ['raydium']
  },
  SNY: {
    symbol: 'SNY',
    name: 'SNY',
    address: '4dmKkXNHdgYsXqBHCuMikNQWwVomZURhYvkkX5c4pQ7y',
    decimals: 6,
    referrer: 'G7gyaTNn2hgjF67SWs4Ee9PEaFU2xadhtXL8HmkJ2cNL',
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4dmKkXNHdgYsXqBHCuMikNQWwVomZURhYvkkX5c4pQ7y/logo.png",
    tags: ['raydium']
  },
  PORT: {
    symbol: "PORT",
    name: "Port Finance Token",
    address: "PoRTjZMPXb9T7dyU7tpLEZRQj7e6ssfAE62j2oQuc6y",  
    decimals: 6,
    referrer: '5Ve8q9fb7R2DhdqGV4o1RVy7xxo4D6ifQfbxGiASdxEH',
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/PoRTjZMPXb9T7dyU7tpLEZRQj7e6ssfAE62j2oQuc6y/PORT.png",
    tags: ['raydium']
  },
  SLIM: {
    symbol: 'SLIM',
    name: 'SLIM',
    address: 'xxxxa1sKNGwFtw2kFn8XauW9xq8hBZ5kVtcSesTT9fW',
    decimals: 6,
    referrer: '',
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/xxxxa1sKNGwFtw2kFn8XauW9xq8hBZ5kVtcSesTT9fW/logo.png",
    tags: ['raydium']
  }
}

export const LP_TOKENS: Tokens = {
  'SOL-USDC-V4': {
    symbol: 'SOL-USDC',
    name: 'SOL-USDC LP',
    coin: { ...NATIVE_SOL },
    pc: { ...TOKENS.USDC },

    address: '8HoQnePLqPj4M7PUDzfw8e3Ymdwgc7NLGnaTUapubyvu',
    decimals: NATIVE_SOL.decimals
  },
  'BTC-USDC-V4': {
    symbol: 'BTC-USDC',
    name: 'BTC-USDC LP',
    coin: { ...TOKENS.BTC },
    pc: { ...TOKENS.USDC },

    address: '2hMdRdVWZqetQsaHG8kQjdZinEMBz75vsoWTCob1ijXu',
    decimals: TOKENS.BTC.decimals
  },
  'ETH-USDC-V4': {
    symbol: 'ETH-USDC',
    name: 'ETH-USDC LP',
    coin: { ...TOKENS.ETH },
    pc: { ...TOKENS.USDC },

    address: '13PoKid6cZop4sj2GfoBeujnGfthUbTERdE5tpLCDLEY',
    decimals: TOKENS.ETH.decimals
  },
  'SOL-USDT-V4': {
    symbol: 'SOL-USDT',
    name: 'SOL-USDT LP',
    coin: { ...NATIVE_SOL },
    pc: { ...TOKENS.USDT },

    address: 'Epm4KfTj4DMrvqn6Bwg2Tr2N8vhQuNbuK8bESFp4k33K',
    decimals: NATIVE_SOL.decimals
  },
  'BTC-USDT-V4': {
    symbol: 'BTC-USDT',
    name: 'BTC-USDT LP',
    coin: { ...TOKENS.BTC },
    pc: { ...TOKENS.USDT },

    address: 'DgGuvR9GSHimopo3Gc7gfkbKamLKrdyzWkq5yqA6LqYS',
    decimals: TOKENS.BTC.decimals
  },
  'ETH-USDT-V4': {
    symbol: 'ETH-USDT',
    name: 'ETH-USDT LP',
    coin: { ...TOKENS.ETH },
    pc: { ...TOKENS.USDT },

    address: 'nPrB78ETY8661fUgohpuVusNCZnedYCgghzRJzxWnVb',
    decimals: TOKENS.ETH.decimals
  },
  'RAY-USDT-V4': {
    symbol: 'RAY-USDT',
    name: 'RAY-USDT LP',
    coin: { ...TOKENS.RAY },
    pc: { ...TOKENS.USDT },

    address: 'C3sT1R3nsw4AVdepvLTLKr5Gvszr7jufyBWUCvy4TUvT',
    decimals: TOKENS.RAY.decimals
  },
  'RAY-USDC-V4': {
    symbol: 'RAY-USDC',
    name: 'RAY-USDC LP',
    coin: { ...TOKENS.RAY },
    pc: { ...TOKENS.USDC },

    address: 'FbC6K13MzHvN42bXrtGaWsvZY9fxrackRSZcBGfjPc7m',
    decimals: TOKENS.RAY.decimals
  },
  'RAY-SRM-V4': {
    symbol: 'RAY-SRM',
    name: 'RAY-SRM LP',
    coin: { ...TOKENS.RAY },
    pc: { ...TOKENS.SRM },

    address: '7P5Thr9Egi2rvMmEuQkLn8x8e8Qro7u2U7yLD2tU2Hbe',
    decimals: TOKENS.RAY.decimals
  },
  'RAY-ETH-V4': {
    symbol: 'RAY-ETH',
    name: 'RAY-ETH LP',
    coin: { ...TOKENS.RAY },
    pc: { ...TOKENS.ETH },

    address: 'mjQH33MqZv5aKAbKHi8dG3g3qXeRQqq1GFcXceZkNSr',
    decimals: TOKENS.RAY.decimals
  },
  'RAY-SOL-V4': {
    symbol: 'RAY-SOL',
    name: 'RAY-SOL LP',
    coin: { ...TOKENS.RAY },
    pc: { ...NATIVE_SOL },

    address: '89ZKE4aoyfLBe2RuV6jM3JGNhaV18Nxh8eNtjRcndBip',
    decimals: TOKENS.RAY.decimals
  },
  'BTC-SRM-V4': {
    symbol: 'BTC-SRM',
    name: 'BTC-SRM LP',
    coin: { ...TOKENS.BTC },
    pc: { ...TOKENS.SRM },

    address: 'AGHQxXb3GSzeiLTcLtXMS2D5GGDZxsB2fZYZxSB5weqB',
    decimals: TOKENS.BTC.decimals
  },
  'SRM-USDC-V4': {
    symbol: 'SRM-USDC',
    name: 'SRM-USDC LP',
    coin: { ...TOKENS.SRM },
    pc: { ...TOKENS.USDC },

    address: '9XnZd82j34KxNLgQfz29jGbYdxsYznTWRpvZE3SRE7JG',
    decimals: TOKENS.SRM.decimals
  },
  'SRM-USDT-V4': {
    symbol: 'SRM-USDT',
    name: 'SRM-USDT LP',
    coin: { ...TOKENS.SRM },
    pc: { ...TOKENS.USDT },

    address: 'HYSAu42BFejBS77jZAZdNAWa3iVcbSRJSzp3wtqCbWwv',
    decimals: TOKENS.SRM.decimals
  },
  'ETH-SRM-V4': {
    symbol: 'ETH-SRM',
    name: 'ETH-SRM LP',
    coin: { ...TOKENS.ETH },
    pc: { ...TOKENS.SRM },

    address: '9VoY3VERETuc2FoadMSYYizF26mJinY514ZpEzkHMtwG',
    decimals: TOKENS.ETH.decimals
  },
  'SRM-SOL-V4': {
    symbol: 'SRM-SOL',
    name: 'SRM-SOL LP',
    coin: { ...TOKENS.SRM },
    pc: { ...NATIVE_SOL },

    address: 'AKJHspCwDhABucCxNLXUSfEzb7Ny62RqFtC9uNjJi4fq',
    decimals: TOKENS.SRM.decimals
  },
  'SLRS-USDC-V4': {
    symbol: 'SLRS-USDC',
    name: 'SLRS-USDC LP',
    coin: { ...TOKENS.SLRS },
    pc: { ...TOKENS.USDC },

    address: '2Xxbm1hdv5wPeen5ponDSMT3VqhGMTQ7mH9stNXm9shU',
    decimals: TOKENS.SLRS.decimals
  },
  'SLRS-RAY-V4': {
    symbol: 'SLRS-RAY',
    name: 'SLRS-RAY LP',
    coin: { ...TOKENS.SLRS },
    pc: { ...TOKENS.RAY },

    address: '2pk78vsKT3jfJAcN2zbpMUnrR57SZrxHqaZYyFgp92mM',
    decimals: TOKENS.SLRS.decimals
  },
  'GRAPE-USDC-V4': {
    symbol: 'GRAPE-USDC',
    name: 'GRAPE-USDC LP',
    coin: { ...TOKENS.GRAPE },
    pc: { ...TOKENS.USDC },

    address: 'A8ZYmnZ1vwxUa4wpJVUaJgegsuTEz5TKy5CiJXffvmpt',
    decimals: TOKENS.GRAPE.decimals
  },
  'SNY-USDC-V4': {
    symbol: 'SNY-USDC',
    name: 'SNY-USDC LP',
    coin: { ...TOKENS.SNY },
    pc: { ...TOKENS.USDC },

    address: 'G8qcfeFqxwbCqpxv5LpLWxUCd1PyMB5nWb5e5YyxLMKg',
    decimals: TOKENS.SNY.decimals
  },
  'SNY-RAY-V4': {
    symbol: 'SNY-RAY',
    name: 'SNY-RAY LP',
    coin: { ...TOKENS.SNY },
    pc: { ...TOKENS.RAY },

    address: '2k4quTuuLUxrSEhFH99qcoZzvgvVEc3b5sz3xz3qstfS',
    decimals: TOKENS.SNY.decimals
  },
  'PORT-USDC-V4': {
    symbol: 'PORT-USDC',
    name: 'PORT-USDC LP',
    coin: { ...TOKENS.PORT },
    pc: { ...TOKENS.USDC },

    address: '9tmNtbUCrLS15qC4tEfr5NNeqcqpZ4uiGgi2vS5CLQBS',
    decimals: TOKENS.PORT.decimals
  },
  'SLIM-SOL-V4': {
    symbol: 'SLIM-SOL',
    name: 'SLIM-SOL LP',
    coin: { ...TOKENS.SLIM },
    pc: { ...NATIVE_SOL },

    address: '9X4EK8E59VAVi6ChnNvvd39m6Yg9RtkBbAPq1mDVJT57',
    decimals: TOKENS.SLIM.decimals
  }
}