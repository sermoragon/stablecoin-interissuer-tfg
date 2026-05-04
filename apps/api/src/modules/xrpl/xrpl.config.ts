export type XrplNetwork = 'testnet' | 'devnet' | 'mainnet';

export type XrplConfig = {
  network: XrplNetwork;
  serverUrl: string;
  issuerATreasurySeed?: string;
  issuerBTreasurySeed?: string;
  defaultXrpAmount: string;
};

export function getXrplConfig(): XrplConfig {
  const network = (process.env.XRPL_NETWORK ?? 'testnet') as XrplNetwork;

  const serverUrl =
    process.env.XRPL_SERVER_URL ?? 'wss://s.altnet.rippletest.net:51233';

  const defaultXrpAmount = process.env.XRPL_DEFAULT_XRP_AMOUNT ?? '1';

  return {
    network,
    serverUrl,
    issuerATreasurySeed: process.env.XRPL_ISSUER_A_TREASURY_SEED,
    issuerBTreasurySeed: process.env.XRPL_ISSUER_B_TREASURY_SEED,
    defaultXrpAmount,
  };
}