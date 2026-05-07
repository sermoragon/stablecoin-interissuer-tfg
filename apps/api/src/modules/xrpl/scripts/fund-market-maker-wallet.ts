import 'dotenv/config';
import { Client } from 'xrpl';
import { getXrplConfig } from '../xrpl.config';

async function main() {
  const config = getXrplConfig();

  if (config.network !== 'testnet' && config.network !== 'devnet') {
    throw new Error(
      `Funding market maker wallet is only allowed on testnet/devnet. Current network: ${config.network}`,
    );
  }

  const client = new Client(config.serverUrl);

  try {
    console.log(`Connecting to XRPL ${config.network}...`);
    await client.connect();

    console.log('Funding Market Maker wallet...');
    const marketMaker = await client.fundWallet();

    console.log('');
    console.log('XRPL market maker wallet generated successfully.');
    console.log('');
    console.log('Copy this value into apps/api/.env:');
    console.log('');
    console.log(`XRPL_MARKET_MAKER_SEED=${marketMaker.wallet.seed}`);
    console.log('');
    console.log('Public address:');
    console.log('');
    console.log(`Market Maker Address: ${marketMaker.wallet.address}`);
    console.log(`Market Maker Balance: ${marketMaker.balance} XRP`);
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

main().catch((error) => {
  console.error('Failed to fund XRPL market maker wallet.');
  console.error(error);
  process.exit(1);
});