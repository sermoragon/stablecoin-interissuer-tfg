import 'dotenv/config';
import { Client, Wallet } from 'xrpl';
import { getXrplConfig } from '../xrpl.config';

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

async function printTrustLine(params: {
  client: Client;
  label: string;
  holderAddress: string;
  issuerAddress: string;
  currency: string;
}): Promise<void> {
  const { client, label, holderAddress, issuerAddress, currency } = params;

  const trustLine = await getTrustLine(
    client,
    holderAddress,
    issuerAddress,
    currency,
  );

  console.log('');
  console.log(label);
  console.log(`Holder: ${holderAddress}`);
  console.log(`Issuer: ${issuerAddress}`);
  console.log(`Currency: ${currency}`);

  if (!trustLine) {
    console.log('Trust line: NOT_FOUND');
    console.log('Balance: 0');
    console.log('Limit: 0');
    return;
  }

  console.log('Trust line: FOUND');
  console.log(`Balance: ${trustLine.balance} ${currency}`);
  console.log(`Limit: ${trustLine.limit}`);
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
    console.log('XRPL issued currency balances');
    console.log('');
    console.log(`Network: ${config.network}`);
    console.log(`Server: ${config.serverUrl}`);

    await printTrustLine({
      client,
      label: 'Issuer A stablecoin balance',
      holderAddress: issuerATreasuryWallet.address,
      issuerAddress: issuerAColdWallet.address,
      currency: config.stablecoinCurrency,
    });

    await printTrustLine({
      client,
      label: 'Issuer B stablecoin balance',
      holderAddress: issuerBTreasuryWallet.address,
      issuerAddress: issuerBColdWallet.address,
      currency: config.stablecoinCurrency,
    });
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

main().catch((error) => {
  console.error('Failed to check XRPL issued currency balances.');
  console.error(error);
  process.exit(1);
});