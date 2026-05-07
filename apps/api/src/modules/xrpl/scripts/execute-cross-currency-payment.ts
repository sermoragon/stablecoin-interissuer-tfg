import 'dotenv/config';
import { Client, Wallet } from 'xrpl';
import type { Payment } from 'xrpl';
import { getXrplConfig } from '../xrpl.config';

type IssuedAmount = {
  currency: string;
  issuer: string;
  value: string;
};

type TrustLine = {
  account: string;
  balance: string;
  currency: string;
  limit: string;
};

type TxSummary = {
  txHash: string;
  ledgerIndex: number | null;
  engineResult: string | null;
  validated: boolean;
  deliveredAmount: unknown;
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

async function getTrustLine(params: {
  client: Client;
  holderAddress: string;
  issuerAddress: string;
  currency: string;
}): Promise<TrustLine | null> {
  const { client, holderAddress, issuerAddress, currency } = params;

  const response = await client.request({
    command: 'account_lines',
    account: holderAddress,
    peer: issuerAddress,
    ledger_index: 'validated',
  });

  const result = response.result as any;
  const lines = (result.lines ?? []) as TrustLine[];

  return (
    lines.find(
      (line) => line.account === issuerAddress && line.currency === currency,
    ) ?? null
  );
}

async function printBalances(params: {
  client: Client;
  issuerATreasuryWallet: Wallet;
  issuerBTreasuryWallet: Wallet;
  issuerAColdWallet: Wallet;
  issuerBColdWallet: Wallet;
  marketMakerWallet: Wallet;
  currency: string;
  label: string;
}): Promise<void> {
  const {
    client,
    issuerATreasuryWallet,
    issuerBTreasuryWallet,
    issuerAColdWallet,
    issuerBColdWallet,
    marketMakerWallet,
    currency,
    label,
  } = params;

  const issuerATreasuryUsdA = await getTrustLine({
    client,
    holderAddress: issuerATreasuryWallet.address,
    issuerAddress: issuerAColdWallet.address,
    currency,
  });

  const issuerBTreasuryUsdB = await getTrustLine({
    client,
    holderAddress: issuerBTreasuryWallet.address,
    issuerAddress: issuerBColdWallet.address,
    currency,
  });

  const marketMakerUsdA = await getTrustLine({
    client,
    holderAddress: marketMakerWallet.address,
    issuerAddress: issuerAColdWallet.address,
    currency,
  });

  const marketMakerUsdB = await getTrustLine({
    client,
    holderAddress: marketMakerWallet.address,
    issuerAddress: issuerBColdWallet.address,
    currency,
  });

  const issuerATreasuryXrp = await client.getXrpBalance(
    issuerATreasuryWallet.address,
  );
  const marketMakerXrp = await client.getXrpBalance(marketMakerWallet.address);

  console.log('');
  console.log(label);
  console.log('');
  console.log(
    `Issuer A Treasury USD_A: ${issuerATreasuryUsdA?.balance ?? '0'} ${currency}`,
  );
  console.log(
    `Issuer B Treasury USD_B: ${issuerBTreasuryUsdB?.balance ?? '0'} ${currency}`,
  );
  console.log(
    `Market Maker USD_A: ${marketMakerUsdA?.balance ?? '0'} ${currency}`,
  );
  console.log(
    `Market Maker USD_B: ${marketMakerUsdB?.balance ?? '0'} ${currency}`,
  );
  console.log(`Issuer A Treasury XRP: ${issuerATreasuryXrp} XRP`);
  console.log(`Market Maker XRP: ${marketMakerXrp} XRP`);
}

async function submitPayment(params: {
  client: Client;
  senderWallet: Wallet;
  destinationAddress: string;
  destinationAmount: IssuedAmount;
  sendMax: IssuedAmount;
  paths: unknown[];
}): Promise<TxSummary> {
  const {
    client,
    senderWallet,
    destinationAddress,
    destinationAmount,
    sendMax,
    paths,
  } = params;

  const payment: Payment = {
    TransactionType: 'Payment',
    Account: senderWallet.address,
    Destination: destinationAddress,
    Amount: destinationAmount,
    SendMax: sendMax,
  } as Payment;

  if (paths.length > 0) {
    (payment as any).Paths = paths;
  }

  const prepared = await client.autofill(payment);
  const signed = senderWallet.sign(prepared);
  const response = await client.submitAndWait(signed.tx_blob);

  const result = response.result as any;
  const meta = result.meta;

  const engineResult =
    meta && typeof meta === 'object' ? meta.TransactionResult ?? null : null;

  const deliveredAmount =
    meta && typeof meta === 'object'
      ? meta.delivered_amount ?? meta.DeliveredAmount ?? null
      : null;

  const summary: TxSummary = {
    txHash: result.hash ?? signed.hash,
    ledgerIndex: result.ledger_index ?? result.ledgerIndex ?? null,
    engineResult,
    validated: result.validated === true,
    deliveredAmount,
  };

  if (!summary.validated || summary.engineResult !== 'tesSUCCESS') {
    throw new Error(
      `Cross-currency payment failed: ${JSON.stringify(summary)}`,
    );
  }

  return summary;
}

async function main() {
  const config = getXrplConfig();

  const issuerATreasurySeed = requireValue(
    'XRPL_ISSUER_A_TREASURY_SEED',
    config.issuerATreasurySeed,
  );
  const issuerBTreasurySeed = requireValue(
    'XRPL_ISSUER_B_TREASURY_SEED',
    config.issuerBTreasurySeed,
  );
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

  assertPositiveDecimal(
    'XRPL_CROSS_CURRENCY_DESTINATION_AMOUNT',
    config.crossCurrencyDestinationAmount,
  );
  assertPositiveDecimal(
    'XRPL_CROSS_CURRENCY_SEND_MAX',
    config.crossCurrencySendMax,
  );

  const issuerATreasuryWallet = Wallet.fromSeed(issuerATreasurySeed);
  const issuerBTreasuryWallet = Wallet.fromSeed(issuerBTreasurySeed);
  const issuerAColdWallet = Wallet.fromSeed(issuerAColdSeed);
  const issuerBColdWallet = Wallet.fromSeed(issuerBColdSeed);
  const marketMakerWallet = Wallet.fromSeed(marketMakerSeed);

  const destinationAmount = issuedAmount({
    currency: config.stablecoinCurrency,
    issuer: issuerBColdWallet.address,
    value: config.crossCurrencyDestinationAmount,
  });

  const sendMax = issuedAmount({
    currency: config.stablecoinCurrency,
    issuer: issuerAColdWallet.address,
    value: config.crossCurrencySendMax,
  });

  const client = new Client(config.serverUrl);

  try {
    console.log(`Connecting to XRPL ${config.network}...`);
    await client.connect();

    console.log('');
    console.log('XRPL cross-currency payment test');
    console.log('');
    console.log(`Source: Issuer A Treasury ${issuerATreasuryWallet.address}`);
    console.log(
      `Destination: Issuer B Treasury ${issuerBTreasuryWallet.address}`,
    );
    console.log(`USD_A issuer: ${issuerAColdWallet.address}`);
    console.log(`USD_B issuer: ${issuerBColdWallet.address}`);
    console.log(`Market Maker: ${marketMakerWallet.address}`);
    console.log('');
    console.log(`Destination amount: ${formatAmount(destinationAmount)}`);
    console.log(`SendMax: ${formatAmount(sendMax)}`);

    await printBalances({
      client,
      issuerATreasuryWallet,
      issuerBTreasuryWallet,
      issuerAColdWallet,
      issuerBColdWallet,
      marketMakerWallet,
      currency: config.stablecoinCurrency,
      label: 'Balances before payment',
    });

    console.log('');
    console.log('Using explicit XRPL path for USD_A -> XRP -> USD_B...');
    console.log('');

    const paths = [
      [
        {
          currency: 'XRP',
        },
        {
          currency: config.stablecoinCurrency,
          issuer: issuerBColdWallet.address,
        },
      ],
    ];

    console.log('Manual path');
    console.log(JSON.stringify(paths, null, 2));

    console.log('');
    console.log('Submitting cross-currency Payment...');

    const result = await submitPayment({
      client,
      senderWallet: issuerATreasuryWallet,
      destinationAddress: issuerBTreasuryWallet.address,
      destinationAmount,
      sendMax,
      paths,
    });

    console.log('');
    console.log('Cross-currency payment confirmed');
    console.log(`Tx hash: ${result.txHash}`);
    console.log(`Ledger index: ${result.ledgerIndex}`);
    console.log(`Engine result: ${result.engineResult}`);
    console.log(`Validated: ${result.validated}`);
    console.log(`Delivered amount: ${formatAmount(result.deliveredAmount)}`);

    await printBalances({
      client,
      issuerATreasuryWallet,
      issuerBTreasuryWallet,
      issuerAColdWallet,
      issuerBColdWallet,
      marketMakerWallet,
      currency: config.stablecoinCurrency,
      label: 'Balances after payment',
    });

    console.log('');
    console.log('XRPL cross-currency payment test completed successfully.');
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

main().catch((error) => {
  console.error('Failed to execute XRPL cross-currency payment.');
  console.error(error);
  process.exit(1);
});