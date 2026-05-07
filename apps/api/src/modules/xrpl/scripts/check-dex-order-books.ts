import 'dotenv/config';
import { Client, Wallet } from 'xrpl';
import { getXrplConfig } from '../xrpl.config';

type CurrencySpec =
  | {
      currency: 'XRP';
    }
  | {
      currency: string;
      issuer: string;
    };

type BookOffer = {
  Account: string;
  TakerGets: unknown;
  TakerPays: unknown;
  Sequence: number;
  quality?: string;
  taker_gets_funded?: unknown;
  taker_pays_funded?: unknown;
};

function requireValue(name: string, value?: string): string {
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function formatAmount(value: unknown): string {
  if (typeof value === 'string') {
    return `${Number(value) / 1_000_000} XRP`;
  }

  if (value && typeof value === 'object') {
    const amount = value as {
      currency?: string;
      issuer?: string;
      value?: string;
    };

    return `${amount.value} ${amount.currency} (${amount.issuer})`;
  }

  return JSON.stringify(value);
}

async function getBookOffers(params: {
  client: Client;
  takerGets: CurrencySpec;
  takerPays: CurrencySpec;
  taker?: string;
}): Promise<BookOffer[]> {
  const { client, takerGets, takerPays, taker } = params;

  const response = await client.request({
    command: 'book_offers',
    taker_gets: takerGets,
    taker_pays: takerPays,
    taker,
    ledger_index: 'validated',
    limit: 10,
  });

  const result = response.result as any;

  return (result.offers ?? []) as BookOffer[];
}

function printBook(label: string, offers: BookOffer[], marketMakerAddress: string) {
  console.log('');
  console.log(label);
  console.log('');

  if (offers.length === 0) {
    console.log('No offers found.');
    return;
  }

  offers.forEach((offer, index) => {
    console.log(`Offer #${index + 1}`);
    console.log(`Account: ${offer.Account}`);
    console.log(`Is Market Maker: ${offer.Account === marketMakerAddress}`);
    console.log(`Sequence: ${offer.Sequence}`);
    console.log(`TakerGets: ${formatAmount(offer.TakerGets)}`);
    console.log(`TakerPays: ${formatAmount(offer.TakerPays)}`);

    if (offer.taker_gets_funded) {
      console.log(`TakerGets funded: ${formatAmount(offer.taker_gets_funded)}`);
    }

    if (offer.taker_pays_funded) {
      console.log(`TakerPays funded: ${formatAmount(offer.taker_pays_funded)}`);
    }

    if (offer.quality) {
      console.log(`Quality: ${offer.quality}`);
    }

    console.log('');
  });
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

  const issuerAColdWallet = Wallet.fromSeed(issuerAColdSeed);
  const issuerBColdWallet = Wallet.fromSeed(issuerBColdSeed);
  const marketMakerWallet = Wallet.fromSeed(marketMakerSeed);

  const xrpCurrency: CurrencySpec = {
    currency: 'XRP',
  };

  const usdA: CurrencySpec = {
    currency: config.stablecoinCurrency,
    issuer: issuerAColdWallet.address,
  };

  const usdB: CurrencySpec = {
    currency: config.stablecoinCurrency,
    issuer: issuerBColdWallet.address,
  };

  const client = new Client(config.serverUrl);

  try {
    console.log(`Connecting to XRPL ${config.network}...`);
    await client.connect();

    console.log('');
    console.log('XRPL DEX order books');
    console.log('');
    console.log(`Market Maker: ${marketMakerWallet.address}`);
    console.log(`USD_A issuer: ${issuerAColdWallet.address}`);
    console.log(`USD_B issuer: ${issuerBColdWallet.address}`);

    const usdAToXrpOffers = await getBookOffers({
      client,
      takerGets: xrpCurrency,
      takerPays: usdA,
      taker: marketMakerWallet.address,
    });

    const xrpToUsdBOffers = await getBookOffers({
      client,
      takerGets: usdB,
      takerPays: xrpCurrency,
      taker: marketMakerWallet.address,
    });

    printBook(
      'Book 1 — taker pays USD_A and receives XRP',
      usdAToXrpOffers,
      marketMakerWallet.address,
    );

    printBook(
      'Book 2 — taker pays XRP and receives USD_B',
      xrpToUsdBOffers,
      marketMakerWallet.address,
    );
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

main().catch((error) => {
  console.error('Failed to check XRPL DEX order books.');
  console.error(error);
  process.exit(1);
});