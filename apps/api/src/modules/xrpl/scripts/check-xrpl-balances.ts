import 'dotenv/config';
import { Client, Wallet } from 'xrpl';
import { getXrplConfig } from '../xrpl.config';

function requireValue(name: string, value?: string): string {
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

async function main() {
  const config = getXrplConfig();

  const issuerASeed = requireValue(
    'XRPL_ISSUER_A_TREASURY_SEED',
    config.issuerATreasurySeed,
  );

  const issuerBSeed = requireValue(
    'XRPL_ISSUER_B_TREASURY_SEED',
    config.issuerBTreasurySeed,
  );

  const issuerAWallet = Wallet.fromSeed(issuerASeed);
  const issuerBWallet = Wallet.fromSeed(issuerBSeed);

  const client = new Client(config.serverUrl);

  try {
    console.log(`Connecting to XRPL ${config.network}...`);
    await client.connect();

    const issuerABalance = await client.getXrpBalance(issuerAWallet.address);
    const issuerBBalance = await client.getXrpBalance(issuerBWallet.address);

    console.log('');
    console.log('XRPL treasury balances');
    console.log('');
    console.log(`Network: ${config.network}`);
    console.log(`Server: ${config.serverUrl}`);
    console.log('');
    console.log('Issuer A Treasury');
    console.log(`Address: ${issuerAWallet.address}`);
    console.log(`Balance: ${issuerABalance} XRP`);
    console.log('');
    console.log('Issuer B Treasury');
    console.log(`Address: ${issuerBWallet.address}`);
    console.log(`Balance: ${issuerBBalance} XRP`);
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

main().catch((error) => {
  console.error('Failed to check XRPL balances.');
  console.error(error);
  process.exit(1);
});