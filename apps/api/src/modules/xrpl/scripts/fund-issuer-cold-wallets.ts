import 'dotenv/config';
import { Client } from 'xrpl';
import { getXrplConfig } from '../xrpl.config';

async function main() {
  const config = getXrplConfig();

  if (config.network !== 'testnet' && config.network !== 'devnet') {
    throw new Error(
      `Funding issuer wallets is only allowed on testnet/devnet. Current network: ${config.network}`,
    );
  }

  const client = new Client(config.serverUrl);

  try {
    console.log(`Connecting to XRPL ${config.network}...`);
    await client.connect();

    console.log('Funding Issuer A cold wallet...');
    const issuerACold = await client.fundWallet();

    console.log('Funding Issuer B cold wallet...');
    const issuerBCold = await client.fundWallet();

    console.log('');
    console.log('XRPL issuer cold wallets generated successfully.');
    console.log('');
    console.log('Copy these values into apps/api/.env:');
    console.log('');
    console.log(`XRPL_ISSUER_A_COLD_SEED=${issuerACold.wallet.seed}`);
    console.log(`XRPL_ISSUER_B_COLD_SEED=${issuerBCold.wallet.seed}`);
    console.log('');
    console.log('Public addresses:');
    console.log('');
    console.log(`Issuer A Cold Address: ${issuerACold.wallet.address}`);
    console.log(`Issuer A Cold Balance: ${issuerACold.balance} XRP`);
    console.log('');
    console.log(`Issuer B Cold Address: ${issuerBCold.wallet.address}`);
    console.log(`Issuer B Cold Balance: ${issuerBCold.balance} XRP`);
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

main().catch((error) => {
  console.error('Failed to fund XRPL issuer cold wallets.');
  console.error(error);
  process.exit(1);
});