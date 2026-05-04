import 'dotenv/config';
import { Client } from 'xrpl';
import { getXrplConfig } from '../xrpl.config';

async function main() {
  const config = getXrplConfig();

  if (config.network !== 'testnet' && config.network !== 'devnet') {
    throw new Error(
      `Funding wallets is only allowed on testnet/devnet. Current network: ${config.network}`,
    );
  }

  const client = new Client(config.serverUrl);

  try {
    console.log(`Connecting to XRPL ${config.network}...`);
    await client.connect();

    console.log('Funding Issuer A treasury wallet...');
    const issuerA = await client.fundWallet();

    console.log('Funding Issuer B treasury wallet...');
    const issuerB = await client.fundWallet();

    console.log('');
    console.log('XRPL test wallets generated successfully.');
    console.log('');
    console.log('Copy these values into apps/api/.env:');
    console.log('');
    console.log(`XRPL_ISSUER_A_TREASURY_SEED=${issuerA.wallet.seed}`);
    console.log(`XRPL_ISSUER_B_TREASURY_SEED=${issuerB.wallet.seed}`);
    console.log('');
    console.log('Public addresses:');
    console.log('');
    console.log(`Issuer A Treasury Address: ${issuerA.wallet.address}`);
    console.log(`Issuer A Balance: ${issuerA.balance} XRP`);
    console.log('');
    console.log(`Issuer B Treasury Address: ${issuerB.wallet.address}`);
    console.log(`Issuer B Balance: ${issuerB.balance} XRP`);
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

main().catch((error) => {
  console.error('Failed to fund XRPL testnet wallets.');
  console.error(error);
  process.exit(1);
});