import 'dotenv/config';
import { Client, Wallet } from 'xrpl';
import type { AccountSet, TrustSet } from 'xrpl';
import { getXrplConfig } from '../xrpl.config';

const ASF_DEFAULT_RIPPLE = 8;
const LSF_DEFAULT_RIPPLE = 0x00800000;
const TF_CLEAR_NO_RIPPLE = 0x00040000;

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

async function submitTransaction(
  client: Client,
  wallet: Wallet,
  tx: AccountSet | TrustSet,
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

async function hasDefaultRipple(
  client: Client,
  account: string,
): Promise<boolean> {
  const response = await client.request({
    command: 'account_info',
    account,
    ledger_index: 'validated',
  });

  const result = response.result as any;

  if (typeof result.account_flags?.defaultRipple === 'boolean') {
    return result.account_flags.defaultRipple;
  }

  const flags = result.account_data?.Flags ?? 0;
  return (flags & LSF_DEFAULT_RIPPLE) !== 0;
}

async function ensureDefaultRipple(params: {
  client: Client;
  issuerWallet: Wallet;
  label: string;
}): Promise<void> {
  const { client, issuerWallet, label } = params;

  const alreadyEnabled = await hasDefaultRipple(client, issuerWallet.address);

  if (alreadyEnabled) {
    console.log(`[${label}] DefaultRipple already enabled`);
    return;
  }

  const accountSet: AccountSet = {
    TransactionType: 'AccountSet',
    Account: issuerWallet.address,
    SetFlag: ASF_DEFAULT_RIPPLE,
  };

  const summary = await submitTransaction(
    client,
    issuerWallet,
    accountSet,
    `${label} AccountSet DefaultRipple`,
  );

  console.log(
    `[${label}] DefaultRipple enabled. Tx=${summary.txHash}, Ledger=${summary.ledgerIndex}`,
  );
}

async function getTrustLine(
  client: Client,
  accountAddress: string,
  peerAddress: string,
  currency: string,
): Promise<TrustLine | null> {
  const response = await client.request({
    command: 'account_lines',
    account: accountAddress,
    peer: peerAddress,
    ledger_index: 'validated',
  });

  const result = response.result as any;
  const lines = (result.lines ?? []) as TrustLine[];

  return (
    lines.find(
      (line) => line.account === peerAddress && line.currency === currency,
    ) ?? null
  );
}

async function clearIssuerNoRipple(params: {
  client: Client;
  issuerWallet: Wallet;
  holderWallet: Wallet;
  currency: string;
  label: string;
}): Promise<void> {
  const { client, issuerWallet, holderWallet, currency, label } = params;

  const issuerSideLine = await getTrustLine(
    client,
    issuerWallet.address,
    holderWallet.address,
    currency,
  );

  if (!issuerSideLine) {
    throw new Error(
      `[${label}] Trust line not found between issuer ${issuerWallet.address} and holder ${holderWallet.address}`,
    );
  }

  if (issuerSideLine.no_ripple !== true) {
    console.log(`[${label}] Issuer-side NoRipple already cleared`);
    return;
  }

  const trustSet: TrustSet = {
    TransactionType: 'TrustSet',
    Account: issuerWallet.address,
    LimitAmount: {
      currency,
      issuer: holderWallet.address,
      value: '0',
    },
    Flags: TF_CLEAR_NO_RIPPLE,
  };

  const summary = await submitTransaction(
    client,
    issuerWallet,
    trustSet,
    `${label} TrustSet clear issuer NoRipple`,
  );

  console.log(
    `[${label}] Issuer-side NoRipple cleared. Tx=${summary.txHash}, Ledger=${summary.ledgerIndex}`,
  );
}

async function printHolderView(params: {
  client: Client;
  holderLabel: string;
  holderWallet: Wallet;
  issuerLabel: string;
  issuerWallet: Wallet;
  currency: string;
}): Promise<void> {
  const { client, holderLabel, holderWallet, issuerLabel, issuerWallet, currency } =
    params;

  const holderSideLine = await getTrustLine(
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

  if (!holderSideLine) {
    console.log('Trust line: NOT_FOUND');
    return;
  }

  console.log(`Balance: ${holderSideLine.balance}`);
  console.log(`Limit: ${holderSideLine.limit}`);
  console.log(`no_ripple: ${holderSideLine.no_ripple ?? false}`);
  console.log(`no_ripple_peer: ${holderSideLine.no_ripple_peer ?? false}`);
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

  const issuerATreasuryWallet = Wallet.fromSeed(issuerATreasurySeed);
  const issuerBTreasuryWallet = Wallet.fromSeed(issuerBTreasurySeed);
  const issuerAColdWallet = Wallet.fromSeed(issuerAColdSeed);
  const issuerBColdWallet = Wallet.fromSeed(issuerBColdSeed);

  const client = new Client(config.serverUrl);

  try {
    console.log(`Connecting to XRPL ${config.network}...`);
    await client.connect();

    console.log('');
    console.log('Configuring issuer rippling settings');
    console.log('');
    console.log(`Currency: ${config.stablecoinCurrency}`);
    console.log(`Issuer A Cold: ${issuerAColdWallet.address}`);
    console.log(`Issuer B Cold: ${issuerBColdWallet.address}`);

    await ensureDefaultRipple({
      client,
      issuerWallet: issuerAColdWallet,
      label: 'Issuer A Cold',
    });

    await ensureDefaultRipple({
      client,
      issuerWallet: issuerBColdWallet,
      label: 'Issuer B Cold',
    });

    await clearIssuerNoRipple({
      client,
      issuerWallet: issuerAColdWallet,
      holderWallet: issuerATreasuryWallet,
      currency: config.stablecoinCurrency,
      label: 'Issuer A',
    });

    await clearIssuerNoRipple({
      client,
      issuerWallet: issuerBColdWallet,
      holderWallet: issuerBTreasuryWallet,
      currency: config.stablecoinCurrency,
      label: 'Issuer B',
    });

    await printHolderView({
      client,
      holderLabel: 'Issuer A Treasury',
      holderWallet: issuerATreasuryWallet,
      issuerLabel: 'Issuer A Cold',
      issuerWallet: issuerAColdWallet,
      currency: config.stablecoinCurrency,
    });

    await printHolderView({
      client,
      holderLabel: 'Issuer B Treasury',
      holderWallet: issuerBTreasuryWallet,
      issuerLabel: 'Issuer B Cold',
      issuerWallet: issuerBColdWallet,
      currency: config.stablecoinCurrency,
    });

    console.log('');
    console.log('Issuer rippling configuration completed successfully.');
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

main().catch((error) => {
  console.error('Failed to configure issuer rippling.');
  console.error(error);
  process.exit(1);
});