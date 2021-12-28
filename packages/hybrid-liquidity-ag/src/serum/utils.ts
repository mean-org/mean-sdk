import { Connection, PublicKey } from "@solana/web3.js";
import { MARKETS as SERUM_MARKETS } from "@project-serum/serum/lib/tokens_and_markets";
import { getMultipleAccounts } from "../utils";
import { MARKET_STATE_LAYOUT_V3 } from "@project-serum/serum";
import { NATIVE_SOL_MINT, WRAPPED_SOL_MINT } from "../types";

const _MARKETS = [
  {
    name: 'RAY/WUSDT',
    deprecated: true,
    address: new PublicKey('C4z32zw9WKaGPhNuU54ohzrV4CE1Uau3cFx6T8RLjxYC'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'RAY/USDC',
    deprecated: false,
    address: new PublicKey('2xiv8A5xrJ7RnGdxXB42uFEkYHJjszEhaJyKKt4WaLep'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'RAY/USDT',
    deprecated: false,
    address: new PublicKey('teE55QrL4a4QSfydR9dnHF97jgCfptpuigbb53Lo95g'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'RAY/SRM',
    deprecated: false,
    address: new PublicKey('Cm4MmknScg7qbKqytb1mM92xgDxv3TNXos4tKbBqTDy7'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'RAY/SOL',
    deprecated: false,
    address: new PublicKey('C6tp2RVZnxBPFbnAsfTjis8BN9tycESAT4SgDQgbbrsA'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'RAY/ETH',
    deprecated: false,
    address: new PublicKey('6jx6aoNFbmorwyncVP5V5ESKfuFc9oUYebob1iF6tgN4'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'RAY/USDT-V2',
    deprecated: true,
    address: new PublicKey('HZyhLoyAnfQ72irTdqPdWo2oFL9zzXaBmAqN72iF3sdX'),
    programId: new PublicKey('EUqojwWA2rd19FZrzeBncJsm38Jm1hEhE3zsmX3bRc2o'),
  },
  {
    name: 'RAY/USDC-V2',
    deprecated: true,
    address: new PublicKey('Bgz8EEMBjejAGSn6FdtKJkSGtvg4cuJUuRwaCBp28S3U'),
    programId: new PublicKey('EUqojwWA2rd19FZrzeBncJsm38Jm1hEhE3zsmX3bRc2o'),
  },
  {
    name: 'RAY/SRM-V2',
    deprecated: true,
    address: new PublicKey('HSGuveQDXtvYR432xjpKPgHfzWQxnb3T8FNuAAvaBbsU'),
    programId: new PublicKey('EUqojwWA2rd19FZrzeBncJsm38Jm1hEhE3zsmX3bRc2o'),
  },
  {
    name: 'OXY/WUSDT',
    deprecated: true,
    address: new PublicKey('HdBhZrnrxpje39ggXnTb6WuTWVvj5YKcSHwYGQCRsVj'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'OXY/USDC',
    deprecated: true,
    address: new PublicKey('GZ3WBFsqntmERPwumFEYgrX2B7J7G11MzNZAy7Hje27X'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'FIDA/RAY',
    deprecated: false,
    address: new PublicKey('9wH4Krv8Vim3op3JAu5NGZQdGxU8HLGAHZh3K77CemxC'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'OXY/RAY',
    deprecated: false,
    address: new PublicKey('HcVjkXmvA1815Es3pSiibsRaFw8r9Gy7BhyzZX83Zhjx'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MAPS/RAY',
    deprecated: false,
    address: new PublicKey('7Q4hee42y8ZGguqKmwLhpFNqVTjeVNNBqhx8nt32VF85'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'KIN/RAY',
    deprecated: false,
    address: new PublicKey('Fcxy8qYgs8MZqiLx2pijjay6LHsSUqXW47pwMGysa3i9'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'YFI/SRM',
    deprecated: false,
    address: new PublicKey('6xC1ia74NbGZdBkySTw93wdxN4Sh2VfULtXh1utPaJDJ'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'FTT/SRM',
    deprecated: false,
    address: new PublicKey('CDvQqnMrt9rmjAxGGE6GTPUdzLpEhgNuNZ1tWAvPsF3W'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'BTC/SRM',
    deprecated: false,
    address: new PublicKey('HfsedaWauvDaLPm6rwgMc6D5QRmhr8siqGtS6tf2wthU'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SUSHI/SRM',
    deprecated: false,
    address: new PublicKey('FGYAizUhNEC9GBmj3UyxdiRWmGjR3TfzMq2dznwYnjtH'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'TOMO/SRM',
    deprecated: false,
    address: new PublicKey('7jBrpiq3w2ywzzb54K9SoosZKy7nhuSQK9XrsgSMogFH'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'LINK/SRM',
    deprecated: false,
    address: new PublicKey('FafaYTnhDbLAFsr5qkD2ZwapRxaPrEn99z59UG4zqRmZ'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'ETH/SRM',
    deprecated: false,
    address: new PublicKey('3Dpu2kXk87mF9Ls9caWCHqyBiv9gK3PwQkSvnrHZDrmi'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'STEP/USDC',
    deprecated: false,
    address: new PublicKey('97qCB4cAVSTthvJu3eNoEx6AY6DLuRDtCoPm5Tdyg77S'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MEDIA/USDC',
    deprecated: false,
    address: new PublicKey('FfiqqvJcVL7oCCu8WQUMHLUC2dnHQPAPjTdSzsERFWjb'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'ROPE/USDC',
    deprecated: false,
    address: new PublicKey('4Sg1g8U2ZuGnGYxAhc6MmX9MX7yZbrrraPkCQ9MdCPtF'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'COPE/USDC',
    deprecated: false,
    address: new PublicKey('6fc7v3PmjZG9Lk2XTot6BywGyYLkBQuzuFKd4FpCsPxk'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MER/USDC',
    deprecated: false,
    address: new PublicKey('G4LcexdCzzJUKZfqyVDQFzpkjhB1JoCNL8Kooxi9nJz5'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'TULIP/USDC',
    deprecated: false,
    address: new PublicKey('8GufnKq7YnXKhnB3WNhgy5PzU9uvHbaaRrZWQK6ixPxW'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'WOO/USDC',
    deprecated: false,
    address: new PublicKey('2Ux1EYeWsxywPKouRCNiALCZ1y3m563Tc4hq1kQganiq'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SNY/USDC',
    deprecated: false,
    address: new PublicKey('DPfj2jYwPaezkCmUNm5SSYfkrkz8WFqwGLcxDDUsN3gA'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'BOP/RAY',
    deprecated: false,
    address: new PublicKey('6Fcw8aEs7oP7YeuMrM2JgAQUotYxa4WHKHWdLLXssA3R'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SLRS/USDC',
    deprecated: false,
    address: new PublicKey('2Gx3UfV831BAh8uQv1FKSPKS9yajfeeD8GJ4ZNb2o2YP'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SAMO/RAY',
    deprecated: false,
    address: new PublicKey('AAfgwhNU5LMjHojes1SFmENNjihQBDKdDDT1jog4NV8w'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'renBTC/USDC',
    deprecated: false,
    address: new PublicKey('74Ciu5yRzhe8TFTHvQuEVbFZJrbnCMRoohBK33NNiPtv'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'renDOGE/USDC',
    deprecated: false,
    address: new PublicKey('5FpKCWYXgHWZ9CdDMHjwxAfqxJLdw2PRXuAmtECkzADk'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'LIKE/USDC',
    deprecated: false,
    address: new PublicKey('3WptgZZu34aiDrLMUiPntTYZGNZ72yT1yxHYxSdbTArX'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'DXL/USDC',
    deprecated: false,
    address: new PublicKey('DYfigimKWc5VhavR4moPBibx9sMcWYVSjVdWvPztBPTa'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'mSOL/USDC',
    deprecated: false,
    address: new PublicKey('6oGsL2puUgySccKzn9XA9afqF217LfxP5ocq4B3LWsjy'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'mSOL/SOL',
    deprecated: false,
    address: new PublicKey('5cLrMai1DsLRYc1Nio9qMTicsWtvzjzZfJPXyAoF4t1Z'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MER/PAI',
    deprecated: false,
    address: new PublicKey('FtxAV7xEo6DLtTszffjZrqXknAE4wpTSfN6fBHW4iZpE'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'PORT/USDC',
    deprecated: false,
    address: new PublicKey('8x8jf7ikJwgP9UthadtiGFgfFuyyyYPHL3obJAuxFWko'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MNGO/USDC',
    deprecated: false,
    address: new PublicKey('3d4rzwpy9iGdCZvgxcu7B1YocYffVLsQXPXkBZKt2zLc'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'ALEPH/RAY',
    deprecated: false,
    address: new PublicKey('4qATPNrEGqE4yFJhXXWtppzJj5evmUaZ5LJspjL6TRoU'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'TULIP/RAY',
    deprecated: false,
    address: new PublicKey('GXde1EjpxVV5fzhHJcZqdLmsA3zmaChGFstZMjWsgKW7'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SLRS/RAY',
    deprecated: false,
    address: new PublicKey('BkJVRQZ7PjfwevMKsyjjpGZ4j6sBu9j5QTUmKuTLZNrq'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MER/RAY',
    deprecated: false,
    address: new PublicKey('75yk6hSTuX6n6PoPRxEbXapJbbXj4ynw3gKgub7vRdUf'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MEDIA/RAY',
    deprecated: false,
    address: new PublicKey('2STXADodK1iZhGh54g3QNrq2Ap4TMwrAzV3Ja14UXut9'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SNY/RAY',
    deprecated: false,
    address: new PublicKey('HFAsygpAgFq3f9YQ932ptoEsEdBP2ELJSAK5eYAJrg4K'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'LIKE/RAY',
    deprecated: false,
    address: new PublicKey('E4ohEJNB86RkKoveYtQZuDX1GzbxE2xrbdjJ7EddCc5T'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'COPE/RAY',
    deprecated: false,
    address: new PublicKey('6y9WTFJRYoqKXQQZftFxzLdnBYStvqrDmLwTFAUarudt'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'ATLAS/RAY',
    deprecated: false,
    address: new PublicKey('Bn7n597jMxU4KjBPUo3QwJhbqr5145cHy31p6EPwPHwL'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'ATLAS/USDC',
    deprecated: false,
    address: new PublicKey('Di66GTLsV64JgCCYGVcY21RZ173BHkjJVgPyezNN7P1K'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'POLIS/RAY',
    deprecated: false,
    address: new PublicKey('3UP5PuGN6db7NhWf4Q76FLnR4AguVFN14GvgDbDj1u7h'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'POLIS/USDC',
    deprecated: false,
    address: new PublicKey('HxFLKUAmAMLz1jtT3hbvCMELwH5H9tpM2QugP8sKyfhW'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'GRAPE/USDC',
    deprecated: false,
    address: new PublicKey('72aW3Sgp1hMTXUiCq8aJ39DX2Jr7sZgumAvdLrLuCMLe'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'LARIX/USDC',
    deprecated: false,
    address: new PublicKey('DE6EjZoMrC5a3Pbdk8eCMGEY9deeeHECuGFmEuUpXWZm'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'RIN/USDC',
    deprecated: false,
    address: new PublicKey('7gZNLDbWE73ueAoHuAeFoSu7JqmorwCLpNTBXHtYSFTa'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'APEX/USDC',
    deprecated: false,
    address: new PublicKey('GX26tyJyDxiFj5oaKvNB9npAHNgdoV9ZYHs5ijs5yG2U'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'mSOL/RAY',
    deprecated: false,
    address: new PublicKey('HVFpsSP4QsC8gFfsFWwYcdmvt3FepDRB6xdFK2pSQtMr'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MNDE/mSOL',
    deprecated: false,
    address: new PublicKey('AVxdeGgihchiKrhWne5xyUJj7bV2ohACkQFXMAtpMetx'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'LARIX/RAY',
    deprecated: false,
    address: new PublicKey('5GH4F2Z9adqkEP8FtR4sJqvrVgBuUSrWoQAa7bVCdB44'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'LIQ/USDC',
    deprecated: false,
    address: new PublicKey('D7p7PebNjpkH6VNHJhmiDFNmpz9XE7UaTv9RouxJMrwb'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'LIQ/RAY',
    deprecated: false,
    address: new PublicKey('FL8yPAyVTepV5YfzDfJvNu6fGL7Rcv5v653LdZ6h4Bsu'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'WAG/USDC',
    deprecated: false,
    address: new PublicKey('BHqcTEDhCoZgvXcsSbwnTuzPdxv1HPs6Kz4AnPpNrGuq'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'JungleCats/SOL',
    deprecated: false,
    address: new PublicKey('3KazPGTkRSn7znj5WSDUVYt73n6H87CLGw8HB5b9oeKF'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SYP/SOL',
    deprecated: false,
    address: new PublicKey('4ksjTQDc2rV3d1ZHdPxmi5s6TRc3j4aa7rAUKiY7nneh'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SYP/RAY',
    deprecated: false,
    address: new PublicKey('5s966j9dDcs6c25MZjUZJUCvpABpC4gXqf9pktwfzhw1'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SYP/USDC',
    deprecated: false,
    address: new PublicKey('9cuBrXXSH9Uw51JB9odLqEyeF5RQSeRpcfXbEW2L8X6X'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MUNK/SOL',
    deprecated: false,
    address: new PublicKey('DgaNcvuYRA6rvUxptJRKh7T6qYT6TUxE4hNVZnE5Pmyj'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'Legends/SOL',
    deprecated: false,
    address: new PublicKey('7gqTp42iihaM4L997sAahnXdBNwzi1dNVuyR1nAtrYPJ'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'WOOF/RAY',
    deprecated: false,
    address: new PublicKey('EfckmBgVkKxBAqPgzLNni6mW1gbHaRKiJSJ3KgWihZ7V'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'WOOF/USDC',
    deprecated: false,
    address: new PublicKey('CwK9brJ43MR4BJz2dwnDM7EXCNyHhGqCJDrAdsEts8n5'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'whETH/SOL',
    deprecated: false,
    address: new PublicKey('7gtMZphDnZre32WfedWnDLhYYWJ2av1CCn1RES5g8QUf'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'whETH/USDC',
    deprecated: false,
    address: new PublicKey('8Gmi2HhZmwQPVdCwzS7CM66MGstMXPcTVHA7jF19cLZz'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'weUNI/USDC',
    deprecated: false,
    address: new PublicKey('B7b5rjQuqQCuGqmUBWmcCTqaL3Z1462mo4NArqty6QFR'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'weSUSHI/USDC',
    deprecated: false,
    address: new PublicKey('3uWVMWu7cwMnYMAAdtsZNwaaqeeeZHARGZwcExnQiFay'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'RAY/SOL',
    deprecated: false,
    address: new PublicKey('HTSoy7NCK98pYAkVV6M6n9CTziqVL6z7caS3iWFjfM4G'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'ETH/SOL',
    deprecated: false,
    address: new PublicKey('HkLEttvwk2b4QDAHzNcVtxsvBG35L1gmYY4pecF9LrFe'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'stSOL/USDC',
    deprecated: false,
    address: new PublicKey('5F7LGsP1LPtaRV7vVKgxwNYX4Vf22xvuzyXjyar7jJqp'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'ETH/mSOL',
    deprecated: false,
    address: new PublicKey('3KLNtqA8H4Em36tifoTHNqTZM6wiwbprYkTDyVJbrBuu'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'mSOL/USDT',
    deprecated: false,
    address: new PublicKey('HxkQdUnrPdHwXP5T9kewEXs3ApgvbufuTfdw9v1nApFd'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'BTC/mSOL',
    deprecated: false,
    address: new PublicKey('HvanEnuruBXBPJymSLr9EmsFUnZcbY97B7RBwZAmfcax'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SLIM/SOL',
    deprecated: false,
    address: new PublicKey('GekRdc4eD9qnfPTjUMK5NdQDho8D9ByGrtnqhMNCTm36'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'AURY/USDC',
    deprecated: false,
    address: new PublicKey('461R7gK9GK1kLUXQbHgaW9L6PESQFSLGxKXahvcHEJwD'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'PRT/SOL',
    deprecated: false,
    address: new PublicKey('H7ZmXKqEx1T8CTM4EMyqR5zyz4e4vUpWTTbCmYmzxmeW'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'FAB/USDC',
    deprecated: false,
    address: new PublicKey('Cud48DK2qoxsWNzQeTL5D8sAiHsGwG8Ev1VMNcYLayxt'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SLND/USDC',
    deprecated: false,
    address: new PublicKey('F9y9NM83kBMzBmMvNT18mkcFuNAPhNRhx7pnz9EDWwfv'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'FRKT/SOL',
    deprecated: false,
    address: new PublicKey('FE5nRChviHFXnUDPRpPwHcPoQSxXwjAB5gdPFJLweEYK'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'CYS/USDC',
    deprecated: false,
    address: new PublicKey('6V6y6QFi17QZC9qNRpVp7SaPiHpCTp2skbRQkUyZZXPW'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SAMO/USDC',
    deprecated: false,
    address: new PublicKey('FR3SPJmgfRSKKQ2ysUZBu7vJLpzTixXnjzb84bY3Diif'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'ABR/USDC',
    deprecated: false,
    address: new PublicKey('FrR9FBmiBjm2GjLZbfnCcgkbueUJ78NbBx1qcQKPUQe8'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'IN/USDC',
    deprecated: false,
    address: new PublicKey('49vwM54DX3JPXpey2daePZPmimxA4CrkXLZ6E1fGxx2Z'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'weDYDX/USDC',
    deprecated: false,
    address: new PublicKey('GNmTGd6iQvQApXgsyvHepDpCnvdRPiWzRr8kzFEMMNKN'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'STARS/USDC',
    deprecated: false,
    address: new PublicKey('DvLrUbE8THQytBCe3xrpbYadNRUfUT7SVCm677Nhrmby'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'weAXS/USDC',
    deprecated: false,
    address: new PublicKey('HZCheduA4nsSuQpVww1TiyKZpXSAitqaXxjBD2ymg22X'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'weSHIB/USDC',
    deprecated: false,
    address: new PublicKey('Er7Jp4PADPVHifykFwbVoHdkL1RtZSsx9zGJrPJTrCgW'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SBR/USDC',
    deprecated: false,
    address: new PublicKey('HXBi8YBwbh4TXF6PjVw81m8Z3Cc4WBofvauj5SBFdgUs'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'OXS/USDC',
    deprecated: false,
    address: new PublicKey('gtQT1ipaCBC5wmTm99F9irBDhiLJCo1pbxrcFUMn6mp'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'CWAR/USDC',
    deprecated: false,
    address: new PublicKey('CDYafmdHXtfZadhuXYiR7QaqmK9Ffgk2TA8otUWj9SWz'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'UPS/USDC',
    deprecated: false,
    address: new PublicKey('DByPstQRx18RU2A8DH6S9mT7bpT6xuLgD2TTFiZJTKZP'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'weSAND/USDC',
    deprecated: false,
    address: new PublicKey('3FE2g3cadTJjN3C7gNRavwnv7Yh9Midq7h9KgTVUE7tR'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'weMANA/USDC',
    deprecated: false,
    address: new PublicKey('7GSn6KQRasgPQCHwCbuDjDCsyZ3cxVHKWFmBXzJUUW8P'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'CAVE/USDC',
    deprecated: false,
    address: new PublicKey('KrGK6ZHyE7Nt35D7GqAKJYAYUPUysGtVBgTXsJuAxMT'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'GENE/USDC',
    deprecated: false,
    address: new PublicKey('FwZ2GLyNNrFqXrmR8Sdkm9DQ61YnQmxS6oobeH3rrLUM'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'GENE/RAY',
    deprecated: false,
    address: new PublicKey('DpFKTy69uZv2G6KW7b117axwQRSztH5g4gUtBPZ9fCS7'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'APT/USDC',
    deprecated: false,
    address: new PublicKey('ATjWoJDChATL7E5WVeSk9EsoJAhZrHjzCZABNx3Miu8B'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'GOFX/USDC',
    deprecated: false,
    address: new PublicKey('2wgi2FabNsSDdb8dke9mHFB67QtMYjYa318HpSqyJLDD'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SONAR/USDC',
    deprecated: false,
    address: new PublicKey('9YdVSNrDsKDaGyhKL2nqEFKvxe3MSqMjmAvcjndVg1kj'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'JSOL/SOL',
    deprecated: false,
    address: new PublicKey('GTfi2wtcZmFVjF5rr4bexs6M6xrszb6iT5bqn694Fk6S'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'JSOL/USDC',
    deprecated: false,
    address: new PublicKey('8mQ3nNCdcwSHkYwsRygTbBFLeGPsJ4zB2zpEwXmwegBh'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SHILL/USDC',
    deprecated: false,
    address: new PublicKey('3KNXNjf1Vp3V5gYPjwnpALYCPhWpRXsPPC8CWBXqmnnN'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'DFL/USDC',
    deprecated: false,
    address: new PublicKey('9UBuWgKN8ZYXcZWN67Spfp3Yp67DKBq1t31WLrVrPjTR'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'BOKU/USDC',
    deprecated: false,
    address: new PublicKey('Dvm8jjdAy8uyXn9WXjS2p1mcPeFTuYS6yW2eUL9SJE8p'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MIMO/SOL',
    deprecated: false,
    address: new PublicKey('BBD3mBvHnx4PWiGeJCvwG8zosHwmAuwkx7JLjfTCRMw'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'wbWBNB/USDC',
    deprecated: false,
    address: new PublicKey('3zzTxtDCt9PimwzGrgWJEbxZfSLetDMkdYegPanGNpMf'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'wePEOPLE/USDC',
    deprecated: false,
    address: new PublicKey('GsWEL352sYgQC3uAVKgEQz2TtA1RA5cgNwUQahyzwJyz'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'XTAG/USDC',
    deprecated: false,
    address: new PublicKey('6QM3iZfkVc5Yyb5z8Uya1mvqU1JBN9ez81u9463px45A'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'KKO/USDC',
    deprecated: false,
    address: new PublicKey('9zR51YmUq2Tzccaq4iXXWDKbNy2TkEyPmoqCsfpjw2bc'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'VI/USDC',
    deprecated: false,
    address: new PublicKey('5fbYoaSBvAD8rW6zXo6oWqcCsgbYZCecbxAouk97p8SM'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SOLC/USDT',
    deprecated: false,
    address: new PublicKey('HYM1HS6MM4E1NxgHPH4Wnth7ztXsYTpbB2Rh9raje8Xq'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'STR/USDC',
    deprecated: false,
    address: new PublicKey('6vXecj4ipEXChK9uPAd5giWn6aB3fn5Lbu4eVMLX7rRU'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SPWN/USDC',
    deprecated: false,
    address: new PublicKey('CMxieHNoWYgF5c6wS1yz1QYhxpxZV7MbDMp8c7EpiRGj'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'ISOLA/USDT',
    deprecated: false,
    address: new PublicKey('42QVcMqoXmHT94zaBXm9KeU7pqDfBuAPHYN9ADW8weCF'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'TTT/USDC',
    deprecated: false,
    address: new PublicKey('2sdQQDyBsHwQBRJFsYAGpLZcxzGscMUd5uxr8jowyYHs'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'RUN/USDC',
    deprecated: false,
    address: new PublicKey('HCvX4un57v1SdYQ2LFywaDYyZySqLHMQ5cojq5kQJM3y'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'CRWNY/USDC',
    deprecated: false,
    address: new PublicKey('H8GSFzSZmPNs4ANW9dPd5XTgrzWkta3CaT57TgWYs7SV'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'CRWNY/RAY',
    deprecated: false,
    address: new PublicKey('6NRE3U7BRWftimyzmKoNSseWDMMxzuoTefxCRBciwD3'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'BLOCK/USDC',
    deprecated: false,
    address: new PublicKey('2b6GbUbY979QhRoWb2b9F3vNi7pcCGPDivuiKPHC56zY'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'REAL/USDC',
    deprecated: false,
    address: new PublicKey('AU8VGwd4NGRbcMz9LT6Fu2LP69LPAbWUJ6gEfEgeYM33'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },




  {
    name: 'USDT/USDC',
    deprecated: false,
    address: new PublicKey('77quYg4MGneUdjgXCunt9GgM1usmrxKY31twEy3WHwcS'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'APYS/USDC',
    deprecated: false,
    address: new PublicKey('4wCTEd1o46VjBmRoRks5CmZywaeM8gnEr93E8nFPGBqa'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'OOGI/USDC',
    deprecated: false,
    address: new PublicKey('ANUCohkG9gamUn6ofZEbnzGkjtyMexDhnjCwbLDmQ8Ub'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'STR/USDC',
    deprecated: false,
    address: new PublicKey('6vXecj4ipEXChK9uPAd5giWn6aB3fn5Lbu4eVMLX7rRU'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'DATE/USDC',
    deprecated: false,
    address: new PublicKey('3jszawPiXjuqg5MwAAHS8wehWy1k7de5u5pWmmPZf6dM'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'COBAN/USDC',
    deprecated: false,
    address: new PublicKey('4VCnuHoo6A3XhQ9YrD6YZWQKVvLxVGzHTB2opNyQi7bz'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SOLX/USDC',
    deprecated: false,
    address: new PublicKey('6DhnyzBiw59MgjjVE1dGwfX8PKSFmN5gagcoCAn6U6x8'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SOLAR/USDC',
    deprecated: false,
    address: new PublicKey('BHfFJM36MirbBtLCcnZokwRvxUPxk7Ez6EAT6k44q6Go'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'BASIS/USDC',
    deprecated: false,
    address: new PublicKey('HCWgghHfDefcGZsPsLAdMP3NigJwBrptZnXemeQchZ69'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'CHICKS/USDC',
    deprecated: false,
    address: new PublicKey('Eg8a9ZicLPSyak4CiXfiMeJK6jmHq57Xx5ag5GY6vcDj'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'NOVA/USDT',
    deprecated: false,
    address: new PublicKey('2JYtpRB51ShaB7i4eaQyx6QYqWFmm38CAakFSMP8xush'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'GST/USDC',
    deprecated: false,
    address: new PublicKey('2JiQd14xAjmcNEJicyU1m3TVbzQDktTvY285gkozD46J'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MBS/USDC',
    deprecated: false,
    address: new PublicKey('9sUSmgx78tt692hzwiRdBdfwjxPF6nsYeJfPCrTz6vxm'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'RACEFI/USDC',
    deprecated: false,
    address: new PublicKey('4iQ4BRcg6E7hNB384TzhQAjjVYnweMkQh5WFC2t8JNjw'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MEAN/RAY',
    deprecated: false,
    address: new PublicKey('2zJKJgDb8M57J8K5JHZqJyU5ZWZHsxyFtCPi6GdRCi91'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MEAN/USDC',
    deprecated: false,
    address: new PublicKey('3WXrxhrj4PXYUwW4ozBjxdSxwEp9ELKf3vETxXTqdiQJ'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  // ...MARKETS,
];

export const startMarkets = () => {
  let markets: any[] = [];
  for (const market of [...SERUM_MARKETS, ..._MARKETS]) {
    const address = market.address.toBase58();
    if (!market.deprecated && !markets.includes(address)) {
      markets.push(market);
    }
  }
  return markets;
}

export const getMarkets = async (connection: Connection) => {

  try {

    let markets: any = { };
    const marketItems = startMarkets();

    const marketInfos = await getMultipleAccounts(
      connection,
      marketItems.map((m) => new PublicKey(m.address)),
      connection.commitment
    );

    marketInfos.forEach((marketInfo) => {
      if (marketInfo) {
        const address = marketInfo.publicKey.toBase58();
        const data = marketInfo.account.data;

        if (address && data) {
          const decoded = MARKET_STATE_LAYOUT_V3.decode(data);
          markets[address] = decoded;
        }
      }
    });

    return markets;

  } catch (error) {
    throw error;
  }
}

export const getMarket = async (
  connection: Connection,
  from: string,
  to: string
  
): Promise<any> => {

  try {

    let marketInfo: any;
    const allMarkets = await getMarkets(connection);

    for (let address of Object.keys(allMarkets)) {

      let info = Object.assign({}, allMarkets[address]);
      let fromAddress = from;
      let toAddress = to;

      if (fromAddress === NATIVE_SOL_MINT.toBase58()) {
        fromAddress = WRAPPED_SOL_MINT.toBase58();
      }

      if (toAddress === NATIVE_SOL_MINT.toBase58()) {
        toAddress = WRAPPED_SOL_MINT.toBase58();
      }

      if (
        (info.baseMint.toBase58() === fromAddress &&
          info.quoteMint.toBase58() === toAddress) ||
        (info.quoteMint.toBase58() === fromAddress &&
          info.baseMint.toBase58() === toAddress)
      ) {
        marketInfo = info;
        break;
      }
    }

    return marketInfo

  } catch (error) {
    throw error;
  }
};