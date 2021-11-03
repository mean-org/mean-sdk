import { } from "@solana/web3.js";
import { LIQUIDITY_POOL_PROGRAM_ID_V4, SERUM_PROGRAM_ID_V3 } from "../types";
import { LP_TOKENS, NATIVE_SOL, TOKENS } from "./tokens";
import { LiquidityPoolInfo } from "./types";

export const LIQUIDITY_POOLS: LiquidityPoolInfo[] = 
[
  {
    name: 'SOL-USDC',
    coin: { ...NATIVE_SOL },
    pc: { ...TOKENS.USDC },
    lp: { ...LP_TOKENS['SOL-USDC-V4'] },

    version: 4,
    programId: LIQUIDITY_POOL_PROGRAM_ID_V4.toBase58(),

    ammId: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
    ammAuthority: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    ammOpenOrders: 'HRk9CMrpq7Jn9sh7mzxE8CChHG8dneX9p475QKz4Fsfc',
    ammTargetOrders: 'CZza3Ej4Mc58MnxWA385itCC9jCo3L1D7zc3LKy1bZMR',
    // no need
    ammQuantities: NATIVE_SOL.address,
    poolCoinTokenAccount: 'DQyrAcCrDXQ7NeoqGgDCZwBvWDcYmFCjSb9JtteuvPpz',
    poolPcTokenAccount: 'HLmqeL62xR1QoZ1HKKbXRrdN1p3phKpxRMb2VVopvBBz',
    poolWithdrawQueue: 'G7xeGGLevkRwB5f44QNgQtrPKBdMfkT6ZZwpS9xcC97n',
    poolTempLpTokenAccount: 'Awpt6N7ZYPBa4vG4BQNFhFxDj4sxExAA9rpBAoBw2uok',
    serumProgramId: SERUM_PROGRAM_ID_V3.toBase58(),
    serumMarket: '9wFFyRfZBsuAha4YcuxcXLKwMxJR43S7fPfQLusDBzvT',
    serumBids: '14ivtgssEBoBjuZJtSAPKYgpUK7DmnSwuPMqJoVTSgKJ',
    serumAsks: 'CEQdAFKdycHugujQg9k2wbmxjcpdYZyVLfV9WerTnafJ',
    serumEventQueue: '5KKsLVU6TcbVDK4BS6K1DGDxnh4Q9xjYJ8XaDCG5t8ht',
    serumCoinVaultAccount: '36c6YqAwyGKQG66XEp2dJc5JqjaBNv7sVghEtJv4c7u6',
    serumPcVaultAccount: '8CFo8bL8mZQK8abbFyypFMwEDd8tVJjHTTojMLgQTUSZ',
    serumVaultSigner: 'F8Vyqk3unwxkXukZFQeYyGmFfTG3CAX4v24iyrjEYBJV',
    official: true
  },
  {
    name: 'BTC-USDC',
    coin: { ...TOKENS.BTC },
    pc: { ...TOKENS.USDC },
    lp: { ...LP_TOKENS['BTC-USDC-V4'] },

    version: 4,
    programId: LIQUIDITY_POOL_PROGRAM_ID_V4.toBase58(),

    ammId: '6kbC5epG18DF2DwPEW34tBy5pGFS7pEGALR3v5MGxgc5',
    ammAuthority: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    ammOpenOrders: 'L6A7qW935i2HgaiaRx6xNGCGQfFr4myFU51dUSnCshd',
    ammTargetOrders: '6DGjaczWfFthTYW7oBk3MXP2mMwrYq86PA3ki5YF6hLg',
    // no need
    ammQuantities: NATIVE_SOL.address,
    poolCoinTokenAccount: 'HWTaEDR6BpWjmyeUyfGZjeppLnH7s8o225Saar7FYDt5',
    poolPcTokenAccount: '7iGcnvoLAxthsXY3AFSgkTDoqnLiuti5fyPNm2VwZ3Wz',
    poolWithdrawQueue: '8g6jrVU7E7eghT3FQa7uPbwHUHwHHLVCEjBh94pA1NVk',
    poolTempLpTokenAccount: '2Nhg2RBqHBx7R74VSEAbfSF8Kmi1x3HxyzCu3oFgpRJJ',
    serumProgramId: SERUM_PROGRAM_ID_V3.toBase58(),
    serumMarket: 'A8YFbxQYFVqKZaoYJLLUVcQiWP7G2MeEgW5wsAQgMvFw',
    serumBids: '6wLt7CX1zZdFpa6uGJJpZfzWvG6W9rxXjquJDYiFwf9K',
    serumAsks: '6EyVXMMA58Nf6MScqeLpw1jS12RCpry23u9VMfy8b65Y',
    serumEventQueue: '6NQqaa48SnBBJZt9HyVPngcZFW81JfDv9EjRX2M4WkbP',
    serumCoinVaultAccount: 'GZ1YSupuUq9kB28kX9t1j9qCpN67AMMwn4Q72BzeSpfR',
    serumPcVaultAccount: '7sP9fug8rqZFLbXoEj8DETF81KasaRA1fr6jQb6ScKc5',
    serumVaultSigner: 'GBWgHXLf1fX4J1p5fAkQoEbnjpgjxUtr4mrVgtj9wW8a',
    official: true
  },
  {
    name: 'ETH-USDC',
    coin: { ...TOKENS.ETH },
    pc: { ...TOKENS.USDC },
    lp: { ...LP_TOKENS['ETH-USDC-V4'] },

    version: 4,
    programId: LIQUIDITY_POOL_PROGRAM_ID_V4.toBase58(),

    ammId: 'AoPebtuJC4f2RweZSxcVCcdeTgaEXY64Uho8b5HdPxAR',
    ammAuthority: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    ammOpenOrders: '7PwhFjfFaYp7w9N8k2do5Yz7c1G5ebp3YyJRhV4pkUJW',
    ammTargetOrders: 'BV2ucC7miDqsmABSkXGzsibCVWBp7gGPcvkhevDSTyZ1',
    // no need
    ammQuantities: NATIVE_SOL.address,
    poolCoinTokenAccount: 'EHT99uYfAnVxWHPLUMJRTyhD4AyQZDDknKMEssHDtor5',
    poolPcTokenAccount: '58tgdkogRoMsrXZJubnFPsFmNp5mpByEmE1fF6FTNvDL',
    poolWithdrawQueue: '9qPsKm82ZFacGn4ipV1DH85k7efP21Zbxrxbxm5v3GPb',
    poolTempLpTokenAccount: '2WtX2ow4h5FK1vb8VjwpJ3hmwmYKfJfa1hy1rcDBohBT',
    serumProgramId: SERUM_PROGRAM_ID_V3.toBase58(),
    serumMarket: '4tSvZvnbyzHXLMTiFonMyxZoHmFqau1XArcRCVHLZ5gX',
    serumBids: '8tFaNpFPWJ8i7inhKSfAcSestudiFqJ2wHyvtTfsBZZU',
    serumAsks: '2po4TC8qiTgPsqcnbf6uMZRMVnPBzVwqqYfHP15QqREU',
    serumEventQueue: 'Eac7hqpaZxiBtG4MdyKpsgzcoVN6eMe9tAbsdZRYH4us',
    serumCoinVaultAccount: '7Nw66LmJB6YzHsgEGQ8oDSSsJ4YzUkEVAvysQuQw7tC4',
    serumPcVaultAccount: 'EsDTx47jjFACkBhy48Go2W7AQPk4UxtT4765f3tpK21a',
    serumVaultSigner: 'C5v68qSzDdGeRcs556YoEMJNsp8JiYEiEhw2hVUR8Z8y',
    official: true
  },
  {
    name: 'SOL-USDT',
    coin: { ...NATIVE_SOL },
    pc: { ...TOKENS.USDT },
    lp: { ...LP_TOKENS['SOL-USDT-V4'] },

    version: 4,
    programId: LIQUIDITY_POOL_PROGRAM_ID_V4.toBase58(),

    ammId: '7XawhbbxtsRcQA8KTkHT9f9nc6d69UwqCDh6U5EEbEmX',
    ammAuthority: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    ammOpenOrders: '4NJVwEAoudfSvU5kdxKm5DsQe4AAqG6XxpZcNdQVinS4',
    ammTargetOrders: '9x4knb3nuNAzxsV7YFuGLgnYqKArGemY54r2vFExM1dp',
    // no need
    ammQuantities: NATIVE_SOL.address,
    poolCoinTokenAccount: '876Z9waBygfzUrwwKFfnRcc7cfY4EQf6Kz1w7GRgbVYW',
    poolPcTokenAccount: 'CB86HtaqpXbNWbq67L18y5x2RhqoJ6smb7xHUcyWdQAQ',
    poolWithdrawQueue: '52AfgxYPTGruUA9XyE8eF46hdR6gMQiA6ShVoMMsC6jQ',
    poolTempLpTokenAccount: '2JKZRQc92TaH3fgTcUZyxfD7k7V7BMqhF24eussPtkwh',
    serumProgramId: SERUM_PROGRAM_ID_V3.toBase58(),
    serumMarket: 'HWHvQhFmJB3NUcu1aihKmrKegfVxBEHzwVX6yZCKEsi1',
    serumBids: '2juozaawVqhQHfYZ9HNcs66sPatFHSHeKG5LsTbrS2Dn',
    serumAsks: 'ANXcuziKhxusxtthGxPxywY7FLRtmmCwFWDmU5eBDLdH',
    serumEventQueue: 'GR363LDmwe25NZQMGtD2uvsiX66FzYByeQLcNFr596FK',
    serumCoinVaultAccount: '29cTsXahEoEBwbHwVc59jToybFpagbBMV6Lh45pWEmiK',
    serumPcVaultAccount: 'EJwyNJJPbHH4pboWQf1NxegoypuY48umbfkhyfPew4E',
    serumVaultSigner: 'CzZAjoEqA6sjqtaiZiPqDkmxG6UuZWxwRWCenbBMc8Xz',
    official: true
  },
  {
    name: 'BTC-USDT',
    coin: { ...TOKENS.BTC },
    pc: { ...TOKENS.USDT },
    lp: { ...LP_TOKENS['BTC-USDT-V4'] },

    version: 4,
    programId: LIQUIDITY_POOL_PROGRAM_ID_V4.toBase58(),

    ammId: 'AMMwkf57c7ZsbbDCXvBit9zFehMr1xRn8ZzaT1iDF18o',
    ammAuthority: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    ammOpenOrders: 'G5rZ4Qfv5SxpJegVng5FuZftDrJkzLkxQUNjEXuoczX5',
    ammTargetOrders: 'DMEasFJLDw27MLkTBFqSX2duvV5GV6LzwtoVqVfBqeGR',
    // no need
    ammQuantities: NATIVE_SOL.address,
    poolCoinTokenAccount: '7KwCHoQ9nqTnGea4XrcfLUr1pwEWp2maGBHWFqBTeoKW',
    poolPcTokenAccount: 'HwbXe9YJVez3BKK22jBH1i64YeX2fSKaYny5jrcPDxAk',
    poolWithdrawQueue: '3XUXNx72jcaXB3N56UjrtWwxv99ivqUwLAdkagvop4HF',
    poolTempLpTokenAccount: '8rZSQ23HWfZ1P6qd9ZL4ywTgRYtRZDd3xW3aK1hY7pkR',
    serumProgramId: SERUM_PROGRAM_ID_V3.toBase58(),
    serumMarket: 'C1EuT9VokAKLiW7i2ASnZUvxDoKuKkCpDDeNxAptuNe4',
    serumBids: '2e2bd5NtEGs6pb758QHUArNxt6X9TTC5abuE1Tao6fhS',
    serumAsks: 'F1tDtTDNzusig3kJwhKwGWspSu8z2nRwNXFWc6wJowjM',
    serumEventQueue: 'FERWWtsZoSLcHVpfDnEBnUqHv4757kTUUZhLKBCbNfpS',
    serumCoinVaultAccount: 'DSf7hGudcxhhegMpZA1UtSiW4RqKgyEex9mqQECWwRgZ',
    serumPcVaultAccount: 'BD8QnhY2T96h6KwyJoCT9abMcPBkiaFuBNK9h6FUNX2M',
    serumVaultSigner: 'EPzuCsSzHwhYWn2j69HQPKWuWz6wuv4ANZiVigLGMBoD',
    official: true
  },
  {
    name: 'ETH-USDT',
    coin: { ...TOKENS.ETH },
    pc: { ...TOKENS.USDT },
    lp: { ...LP_TOKENS['ETH-USDT-V4'] },

    version: 4,
    programId: LIQUIDITY_POOL_PROGRAM_ID_V4.toBase58(),

    ammId: 'He3iAEV5rYjv6Xf7PxKro19eVrC3QAcdic5CF2D2obPt',
    ammAuthority: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    ammOpenOrders: '8x4uasC632WSrk3wgwoCWHy7MK7Xo2WKAe9vV93tj5se',
    ammTargetOrders: 'G1eji3rrfRFfvHUbPEEbvnjmJ4eEyXeiJBVbMTUPfKL1',
    // no need
    ammQuantities: NATIVE_SOL.address,
    poolCoinTokenAccount: 'DZZwxvJakqbraXTbjRW3QoGbW5GK4R5nmyrrGrFMKWgh',
    poolPcTokenAccount: 'HoGPb5Rp44TyR1EpM5pjQQyFUdgteeuzuMHtimGkAVHo',
    poolWithdrawQueue: 'EispXkJcfh2PZA2fSXWsAanEGq1GHXzRRtu1DuqADQsL',
    poolTempLpTokenAccount: '9SrcJk8TB4JvutZcA4tMvvkdnxCXda8Gtepre7jcCaQr',
    serumProgramId: SERUM_PROGRAM_ID_V3.toBase58(),
    serumMarket: '7dLVkUfBVfCGkFhSXDCq1ukM9usathSgS716t643iFGF',
    serumBids: 'J8a3dcUkMwrE5kxN86gsL1Mwrg63RnGdvWsPbgdFqC6X',
    serumAsks: 'F6oqP13HNZho3bhwuxTmic4w5iNgTdn89HdihMUNR24i',
    serumEventQueue: 'CRjXyfAxboMfCAmsvBw7pdvkfBY7XyGxB7CBTuDkm67v',
    serumCoinVaultAccount: '2CZ9JbDYPux5obFXb9sefwKyG6cyteNBSzbstYQ3iZxE',
    serumPcVaultAccount: 'D2f4NG1NC1yeBM2SgRe5YUF91w3M4naumGQMWjGtxiiE',
    serumVaultSigner: 'CVVGPFejAj3A75qPy2116iJFma7zGEuL8DgnxhwUaFBF',
    official: true
  }
]