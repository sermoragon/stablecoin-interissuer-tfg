import 'dotenv/config';
import { Client, Wallet } from 'xrpl';
import type { Payment, TrustSet } from 'xrpl';
import { getXrplConfig } from '../xrpl.config';

type TxSummary = {
  txHash: string;
  ledgerIndex: number | null;
  engineResult: string | null;
  validated: boolean;
};

type TrustLine = {
  account: string;
  balance: string;
  currency: string;
  limit: string;
  no_ripple?: boolean;
  no_ripple_peer?: boolean;
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

function toSafeAmount(value: number): string {
  return value.toFixed(6).replace(/\.?0+$/, '');
}

async function submitTransaction(
  client: Client,
  wallet: Wallet,
  tx: TrustSet | Payment,
  label: string,
): Promise<TxSummary> {
  const prepared = await client.autofill(tx);
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

async function getTrustLine(
  client: Client,
  holderAddress: string,
  issuerAddress: string,
  currency: string,
): Promise<TrustLine | null> {
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

async function ensureTrustLine(params: {
  client: Client;
  holderWallet: Wallet;
  issuerWallet: Wallet;
  currency: string;
  trustLimit: string;
  label: string;
}): Promise<void> {
  const { client, holderWallet, issuerWallet, currency, trustLimit, label } =
    params;

  const existingLine = await getTrustLine(
    client,
    holderWallet.address,
    issuerWallet.address,
    currency,
  );

  if (existingLine && Number(existingLine.limit) >= Number(trustLimit)) {
    console.log(
      `[${label}] Trust line already exists. Limit=${existingLine.limit}, Balance=${existingLine.balance}`,
    );
    return;
  }

  const trustSet: TrustSet = {
    TransactionType: 'TrustSet',
    Account: holderWallet.address,
    LimitAmount: {
      currency,
      issuer: issuerWallet.address,
      value: trustLimit,
    },
  };

  const summary = await submitTransaction(
    client,
    holderWallet,
    trustSet,
    `${label} TrustSet`,
  );

  console.log(
    `[${label}] Trust line confirmed. Tx=${summary.txHash}, Ledger=${summary.ledgerIndex}`,
  );
}

async function ensureIssuedBalance(params: {
  client: Client;
  issuerWallet: Wallet;
  holderWallet: Wallet;
  currency: string;
  targetAmount: string;
  label: string;
}): Promise<void> {
  const { client, issuerWallet, holderWallet, currency, targetAmount, label } =
    params;

  const trustLine = await getTrustLine(
    client,
    holderWallet.address,
    issuerWallet.address,
    currency,
  );

  if (!trustLine) {
    throw new Error(`[${label}] Trust line does not exist`);
  }

  const currentBalance = Number(trustLine.balance);
  const targetBalance = Number(targetAmount);

  if (currentBalance >= targetBalance) {
    console.log(
      `[${label}] Issued balance already sufficient. Balance=${trustLine.balance} ${currency}`,
    );
    return;
  }

  const amountToIssue = toSafeAmount(targetBalance - currentBalance);

  const payment: Payment = {
    TransactionType: 'Payment',
    Account: issuerWallet.address,
    Destination: holderWallet.address,
    Amount: {
      currency,
      issuer: issuerWallet.address,
      value: amountToIssue,
    },
  };

  const summary = await submitTransaction(
    client,
    issuerWallet,
    payment,
    `${label} issued currency payment`,
  );

  console.log(
    `[${label}] Issued ${amountToIssue} ${currency}. Tx=${summary.txHash}, Ledger=${summary.ledgerIndex}`,
  );
}

async function printTrustLine(params: {
  client: Client;
  label: string;
  holderWallet: Wallet;
  issuerWallet: Wallet;
  currency: string;
}): Promise<void> {
  const { client, label, holderWallet, issuerWallet, currency } = params;

  const trustLine = await getTrustLine(
    client,
    holderWallet.address,
    issuerWallet.address,
    currency,
  );

  console.log('');
  console.log(label);
  console.log(`Holder: ${holderWallet.address}`);
  console.log(`Issuer: ${issuerWallet.address}`);
  console.log(`Currency: ${currency}`);

  if (!trustLine) {
    console.log('Trust line: NOT_FOUND');
    return;
  }

  console.log('Trust line: FOUND');
  console.log(`Balance: ${trustLine.balance} ${currency}`);
  console.log(`Limit: ${trustLine.limit}`);
  console.log(`no_ripple: ${trustLine.no_ripple ?? false}`);
  console.log(`no_ripple_peer: ${trustLine.no_ripple_peer ?? false}`);
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

  assertPositiveDecimal(
    'XRPL_MARKET_MAKER_TRUST_LIMIT',
    config.marketMakerTrustLimit,
  );
  assertPositiveDecimal(
    'XRPL_MARKET_MAKER_INITIAL_IOU_BALANCE',
    config.marketMakerInitialIouBalance,
  );

  const issuerAColdWallet = Wallet.fromSeed(issuerAColdSeed);
  const issuerBColdWallet = Wallet.fromSeed(issuerBColdSeed);
  const marketMakerWallet = Wallet.fromSeed(marketMakerSeed);

  const client = new Client(config.serverUrl);

  try {
    console.log(`Connecting to XRPL ${config.network}...`);
    await client.connect();

    console.log('');
    console.log('XRPL market maker liquidity setup');
    console.log('');
    console.log(`Currency: ${config.stablecoinCurrency}`);
    console.log(`Trust limit: ${config.marketMakerTrustLimit}`);
    console.log(`Target IOU balance per issuer: ${config.marketMakerInitialIouBalance}`);
    console.log('');
    console.log(`Issuer A Cold: ${issuerAColdWallet.address}`);
    console.log(`Issuer B Cold: ${issuerBColdWallet.address}`);
    console.log(`Market Maker: ${marketMakerWallet.address}`);
    console.log('');

    await ensureTrustLine({
      client,
      holderWallet: marketMakerWallet,
      issuerWallet: issuerAColdWallet,
      currency: config.stablecoinCurrency,
      trustLimit: config.marketMakerTrustLimit,
      label: 'Market Maker -> Issuer A Cold',
    });

    await ensureTrustLine({
      client,
      holderWallet: marketMakerWallet,
      issuerWallet: issuerBColdWallet,
      currency: config.stablecoinCurrency,
      trustLimit: config.marketMakerTrustLimit,
      label: 'Market Maker -> Issuer B Cold',
    });

    await ensureIssuedBalance({
      client,
      issuerWallet: issuerAColdWallet,
      holderWallet: marketMakerWallet,
      currency: config.stablecoinCurrency,
      targetAmount: config.marketMakerInitialIouBalance,
      label: 'Issuer A Cold -> Market Maker',
    });

    await ensureIssuedBalance({
      client,
      issuerWallet: issuerBColdWallet,
      holderWallet: marketMakerWallet,
      currency: config.stablecoinCurrency,
      targetAmount: config.marketMakerInitialIouBalance,
      label: 'Issuer B Cold -> Market Maker',
    });

    await printTrustLine({
      client,
      label: 'Market Maker balance for Issuer A USD',
      holderWallet: marketMakerWallet,
      issuerWallet: issuerAColdWallet,
      currency: config.stablecoinCurrency,
    });

    await printTrustLine({
      client,
      label: 'Market Maker balance for Issuer B USD',
      holderWallet: marketMakerWallet,
      issuerWallet: issuerBColdWallet,
      currency: config.stablecoinCurrency,
    });

    const xrpBalance = await client.getXrpBalance(marketMakerWallet.address);

    console.log('');
    console.log(`Market Maker XRP balance: ${xrpBalance} XRP`);
    console.log('');
    console.log('XRPL market maker liquidity setup completed successfully.');
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

main().catch((error) => {
  console.error('Failed to setup XRPL market maker liquidity.');
  console.error(error);
  process.exit(1);
});