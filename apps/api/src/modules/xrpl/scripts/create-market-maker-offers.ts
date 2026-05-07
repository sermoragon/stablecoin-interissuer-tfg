import 'dotenv/config';
import { Client, Wallet, xrpToDrops } from 'xrpl';
import type { OfferCreate } from 'xrpl';
import { getXrplConfig } from '../xrpl.config';

type IssuedAmount = {
  currency: string;
  issuer: string;
  value: string;
};

type XrplAmount = string | IssuedAmount;

type AccountOffer = {
  seq: number;
  flags: number;
  taker_gets: XrplAmount;
  taker_pays: XrplAmount;
  quality?: string;
};

type TxSummary = {
  txHash: string;
  ledgerIndex: number | null;
  engineResult: string | null;
  validated: boolean;
};

function requireValue(name: string, value?: string): string {
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function assertPositiveDecimal(name: string, value: string): void {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive decimal number`);
  }
}

function isIssuedAmount(value: XrplAmount): value is IssuedAmount {
  return typeof value === 'object';
}

function decimalEquals(left: string, right: string): boolean {
  return Number(left) === Number(right);
}

function amountMatches(left: XrplAmount, right: XrplAmount): boolean {
  if (typeof left === 'string' && typeof right === 'string') {
    return left === right;
  }

  if (isIssuedAmount(left) && isIssuedAmount(right)) {
    return (
      left.currency === right.currency &&
      left.issuer === right.issuer &&
      decimalEquals(left.value, right.value)
    );
  }

  return false;
}

async function submitOffer(
  client: Client,
  wallet: Wallet,
  offer: OfferCreate,
  label: string,
): Promise<TxSummary> {
  const prepared = await client.autofill(offer);
  const signed = wallet.sign(prepared);
  const response = await client.submitAndWait(signed.tx_blob);

  const result = response.result as any;
  const meta = result.meta;

  const engineResult =
    meta && typeof meta === 'object' ? meta.TransactionResult ?? null : null;

  const summary: TxSummary = {
    txHash: result.hash ?? signed.hash,
    ledgerIndex: result.ledger_index ?? result.ledgerIndex ?? null,
    engineResult,
    validated: result.validated === true,
  };

  if (!summary.validated || summary.engineResult !== 'tesSUCCESS') {
    throw new Error(`${label} failed: ${JSON.stringify(summary)}`);
  }

  return summary;
}

async function getMarketMakerOffers(
  client: Client,
  marketMakerAddress: string,
): Promise<AccountOffer[]> {
  const response = await client.request({
    command: 'account_offers',
    account: marketMakerAddress,
    ledger_index: 'validated',
    limit: 400,
  });

  const result = response.result as any;

  return (result.offers ?? []) as AccountOffer[];
}

async function ensureOffer(params: {
  client: Client;
  wallet: Wallet;
  label: string;
  takerGets: XrplAmount;
  takerPays: XrplAmount;
}): Promise<void> {
  const { client, wallet, label, takerGets, takerPays } = params;

  const existingOffers = await getMarketMakerOffers(client, wallet.address);

  const existingOffer = existingOffers.find(
    (offer) =>
      amountMatches(offer.taker_gets, takerGets) &&
      amountMatches(offer.taker_pays, takerPays),
  );

  if (existingOffer) {
    console.log(
      `[${label}] Offer already exists. Sequence=${existingOffer.seq}, Quality=${existingOffer.quality}`,
    );
    return;
  }

  const offer: OfferCreate = {
    TransactionType: 'OfferCreate',
    Account: wallet.address,
    TakerGets: takerGets,
    TakerPays: takerPays,
  };

  const summary = await submitOffer(client, wallet, offer, label);

  console.log(
    `[${label}] Offer created. Tx=${summary.txHash}, Ledger=${summary.ledgerIndex}`,
  );
}

function issuedAmount(params: {
  currency: string;
  issuer: string;
  value: string;
}): IssuedAmount {
  return {
    currency: params.currency,
    issuer: params.issuer,
    value: params.value,
  };
}

async function main() {
  const config = getXrplConfig();

  const issuerAColdSeed = requireValue(
    'XRPL_ISSUER_A_COLD_SEED',
    config.issuerAColdSeed,
  );
  const issuerBColdSeed = requireValue(
    'XRPL_ISSUER_B_COLD_SEED',
    config.issuerBColdSeed,
  );
  const marketMakerSeed = requireValue(
    'XRPL_MARKET_MAKER_SEED',
    config.marketMakerSeed,
  );

  assertPositiveDecimal('XRPL_DEX_OFFER_SIZE_XRP', config.dexOfferSizeXrp);
  assertPositiveDecimal('XRPL_DEX_OFFER_SIZE_USD', config.dexOfferSizeUsd);

  const issuerAColdWallet = Wallet.fromSeed(issuerAColdSeed);
  const issuerBColdWallet = Wallet.fromSeed(issuerBColdSeed);
  const marketMakerWallet = Wallet.fromSeed(marketMakerSeed);

  const usdA = issuedAmount({
    currency: config.stablecoinCurrency,
    issuer: issuerAColdWallet.address,
    value: config.dexOfferSizeUsd,
  });

  const usdB = issuedAmount({
    currency: config.stablecoinCurrency,
    issuer: issuerBColdWallet.address,
    value: config.dexOfferSizeUsd,
  });

  const xrpDrops = xrpToDrops(config.dexOfferSizeXrp);

  const client = new Client(config.serverUrl);

  try {
    console.log(`Connecting to XRPL ${config.network}...`);
    await client.connect();

    console.log('');
    console.log('Creating XRPL DEX offers');
    console.log('');
    console.log(`Market Maker: ${marketMakerWallet.address}`);
    console.log(`Currency: ${config.stablecoinCurrency}`);
    console.log(`Offer size XRP: ${config.dexOfferSizeXrp}`);
    console.log(`Offer size USD: ${config.dexOfferSizeUsd}`);
    console.log('');
    console.log(`USD_A issuer: ${issuerAColdWallet.address}`);
    console.log(`USD_B issuer: ${issuerBColdWallet.address}`);
    console.log('');

    await ensureOffer({
      client,
      wallet: marketMakerWallet,
      label: 'Book USD_A -> XRP',
      takerGets: xrpDrops,
      takerPays: usdA,
    });

    await ensureOffer({
      client,
      wallet: marketMakerWallet,
      label: 'Book XRP -> USD_B',
      takerGets: usdB,
      takerPays: xrpDrops,
    });

    console.log('');
    console.log('XRPL DEX offers setup completed successfully.');
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

main().catch((error) => {
  console.error('Failed to create XRPL DEX offers.');
  console.error(error);
  process.exit(1);
});