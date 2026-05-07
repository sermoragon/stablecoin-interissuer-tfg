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
  limit_peer?: string;
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

function assertCurrencyCode(currency: string): void {
  const isClassicCode = /^[A-Z0-9]{3}$/.test(currency);
  const isHexCode = /^[A-Fa-f0-9]{40}$/.test(currency);

  if (!isClassicCode && !isHexCode) {
    throw new Error(
      `Invalid XRPL currency code: ${currency}. Use a 3-character code like USD or a 160-bit hex code.`,
    );
  }

  if (currency === 'XRP') {
    throw new Error('XRP cannot be used as an issued currency code');
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

  if (
    existingLine &&
    Number(existingLine.limit) >= Number(trustLimit)
  ) {
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

async function printFinalTrustLine(params: {
  client: Client;
  holderLabel: string;
  holderWallet: Wallet;
  issuerLabel: string;
  issuerWallet: Wallet;
  currency: string;
}): Promise<void> {
  const { client, holderLabel, holderWallet, issuerLabel, issuerWallet, currency } =
    params;

  const trustLine = await getTrustLine(
    client,
    holderWallet.address,
    issuerWallet.address,
    currency,
  );

  console.log('');
  console.log(`${holderLabel} trust line to ${issuerLabel}`);
  console.log(`Holder: ${holderWallet.address}`);
  console.log(`Issuer: ${issuerWallet.address}`);
  console.log(`Currency: ${currency}`);
  console.log(`Limit: ${trustLine?.limit ?? '0'}`);
  console.log(`Balance: ${trustLine?.balance ?? '0'} ${currency}`);
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

  assertCurrencyCode(config.stablecoinCurrency);
  assertPositiveDecimal(
    'XRPL_STABLECOIN_TRUST_LIMIT',
    config.stablecoinTrustLimit,
  );
  assertPositiveDecimal(
    'XRPL_INITIAL_ISSUANCE_AMOUNT',
    config.initialIssuanceAmount,
  );

  const issuerATreasuryWallet = Wallet.fromSeed(issuerATreasurySeed);
  const issuerBTreasuryWallet = Wallet.fromSeed(issuerBTreasurySeed);
  const issuerAColdWallet = Wallet.fromSeed(issuerAColdSeed);
  const issuerBColdWallet = Wallet.fromSeed(issuerBColdSeed);

  const client = new Client(config.serverUrl);

  try {
    console.log(`Connecting to XRPL ${config.network}...`);
    await client.connect();

    console.log('');
    console.log('XRPL issued currencies setup');
    console.log('');
    console.log(`Currency: ${config.stablecoinCurrency}`);
    console.log(`Trust limit: ${config.stablecoinTrustLimit}`);
    console.log(`Target initial balance: ${config.initialIssuanceAmount}`);
    console.log('');
    console.log(`Issuer A Cold: ${issuerAColdWallet.address}`);
    console.log(`Issuer A Treasury: ${issuerATreasuryWallet.address}`);
    console.log('');
    console.log(`Issuer B Cold: ${issuerBColdWallet.address}`);
    console.log(`Issuer B Treasury: ${issuerBTreasuryWallet.address}`);
    console.log('');

    await ensureTrustLine({
      client,
      holderWallet: issuerATreasuryWallet,
      issuerWallet: issuerAColdWallet,
      currency: config.stablecoinCurrency,
      trustLimit: config.stablecoinTrustLimit,
      label: 'Issuer A',
    });

    await ensureTrustLine({
      client,
      holderWallet: issuerBTreasuryWallet,
      issuerWallet: issuerBColdWallet,
      currency: config.stablecoinCurrency,
      trustLimit: config.stablecoinTrustLimit,
      label: 'Issuer B',
    });

    await ensureIssuedBalance({
      client,
      issuerWallet: issuerAColdWallet,
      holderWallet: issuerATreasuryWallet,
      currency: config.stablecoinCurrency,
      targetAmount: config.initialIssuanceAmount,
      label: 'Issuer A',
    });

    await ensureIssuedBalance({
      client,
      issuerWallet: issuerBColdWallet,
      holderWallet: issuerBTreasuryWallet,
      currency: config.stablecoinCurrency,
      targetAmount: config.initialIssuanceAmount,
      label: 'Issuer B',
    });

    await printFinalTrustLine({
      client,
      holderLabel: 'Issuer A Treasury',
      holderWallet: issuerATreasuryWallet,
      issuerLabel: 'Issuer A Cold',
      issuerWallet: issuerAColdWallet,
      currency: config.stablecoinCurrency,
    });

    await printFinalTrustLine({
      client,
      holderLabel: 'Issuer B Treasury',
      holderWallet: issuerBTreasuryWallet,
      issuerLabel: 'Issuer B Cold',
      issuerWallet: issuerBColdWallet,
      currency: config.stablecoinCurrency,
    });

    console.log('');
    console.log('XRPL issued currencies setup completed successfully.');
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

main().catch((error) => {
  console.error('Failed to setup XRPL issued currencies.');
  console.error(error);
  process.exit(1);
});