export type XrplNetwork = 'testnet' | 'devnet' | 'mainnet';

export type XrplConfig = {
  network: XrplNetwork;
  serverUrl: string;

  issuerATreasurySeed?: string;
  issuerBTreasurySeed?: string;

  issuerAColdSeed?: string;
  issuerBColdSeed?: string;

  marketMakerSeed?: string;

  defaultXrpAmount: string;

  stablecoinCurrency: string;
  stablecoinTrustLimit: string;
  initialIssuanceAmount: string;

  marketMakerTrustLimit: string;
  marketMakerInitialIouBalance: string;

  dexOfferSizeXrp: string;
  dexOfferSizeUsd: string;

  crossCurrencyDestinationAmount: string;
  crossCurrencySendMax: string;
};

export function getXrplConfig(): XrplConfig {
  const network = (process.env.XRPL_NETWORK ?? 'testnet') as XrplNetwork;

  const serverUrl =
    process.env.XRPL_SERVER_URL ?? 'wss://s.altnet.rippletest.net:51233';

  return {
    network,
    serverUrl,

    issuerATreasurySeed: process.env.XRPL_ISSUER_A_TREASURY_SEED,
    issuerBTreasurySeed: process.env.XRPL_ISSUER_B_TREASURY_SEED,

    issuerAColdSeed: process.env.XRPL_ISSUER_A_COLD_SEED,
    issuerBColdSeed: process.env.XRPL_ISSUER_B_COLD_SEED,

    marketMakerSeed: process.env.XRPL_MARKET_MAKER_SEED,

    defaultXrpAmount: process.env.XRPL_DEFAULT_XRP_AMOUNT ?? '1',

    stablecoinCurrency: process.env.XRPL_STABLECOIN_CURRENCY ?? 'USD',
    stablecoinTrustLimit: process.env.XRPL_STABLECOIN_TRUST_LIMIT ?? '1000000',
    initialIssuanceAmount: process.env.XRPL_INITIAL_ISSUANCE_AMOUNT ?? '1000',

    marketMakerTrustLimit:
      process.env.XRPL_MARKET_MAKER_TRUST_LIMIT ?? '1000000',
    marketMakerInitialIouBalance:
      process.env.XRPL_MARKET_MAKER_INITIAL_IOU_BALANCE ?? '500',

    dexOfferSizeXrp: process.env.XRPL_DEX_OFFER_SIZE_XRP ?? '20',
    dexOfferSizeUsd: process.env.XRPL_DEX_OFFER_SIZE_USD ?? '20',

    crossCurrencyDestinationAmount:
      process.env.XRPL_CROSS_CURRENCY_DESTINATION_AMOUNT ?? '5',
    crossCurrencySendMax: process.env.XRPL_CROSS_CURRENCY_SEND_MAX ?? '5.5',
  };
}