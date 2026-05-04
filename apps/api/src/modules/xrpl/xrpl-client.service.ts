import { Injectable, InternalServerErrorException, OnModuleDestroy } from '@nestjs/common';
import { Client, Payment, Wallet, xrpToDrops } from 'xrpl';
import { getXrplConfig } from './xrpl.config';

export type XrplPaymentResult = {
  txHash: string;
  ledgerIndex: number | null;
  engineResult: string | null;
  validated: boolean;
  from: string;
  to: string;
  amountXrp: string;
};

@Injectable()
export class XrplClientService implements OnModuleDestroy {
  private readonly config = getXrplConfig();
  private client?: Client;

  async getClient(): Promise<Client> {
    if (!this.client) {
      this.client = new Client(this.config.serverUrl);
    }

    if (!this.client.isConnected()) {
      await this.client.connect();
    }

    return this.client;
  }

  async getHealth() {
    const client = await this.getClient();

    const response = await client.request({
      command: 'server_info',
    });

    const result = response.result as any;
    const info = result.info ?? {};

    return {
      network: this.config.network,
      serverUrl: this.config.serverUrl,
      connected: client.isConnected(),
      validatedLedgerSeq: info.validated_ledger?.seq ?? null,
      completeLedgers: info.complete_ledgers ?? null,
    };
  }

  getIssuerATreasuryWallet(): Wallet {
    if (!this.config.issuerATreasurySeed) {
      throw new InternalServerErrorException(
        'XRPL_ISSUER_A_TREASURY_SEED is required',
      );
    }

    return Wallet.fromSeed(this.config.issuerATreasurySeed);
  }

  getIssuerBTreasuryWallet(): Wallet {
    if (!this.config.issuerBTreasurySeed) {
      throw new InternalServerErrorException(
        'XRPL_ISSUER_B_TREASURY_SEED is required',
      );
    }

    return Wallet.fromSeed(this.config.issuerBTreasurySeed);
  }

  async sendXrpFromIssuerAToIssuerB(amountXrp: string): Promise<XrplPaymentResult> {
    this.assertValidAmount(amountXrp);

    const client = await this.getClient();

    const issuerAWallet = this.getIssuerATreasuryWallet();
    const issuerBWallet = this.getIssuerBTreasuryWallet();

    const payment: Payment = {
      TransactionType: 'Payment',
      Account: issuerAWallet.address,
      Destination: issuerBWallet.address,
      Amount: xrpToDrops(amountXrp),
    };

    const prepared = await client.autofill(payment);
    const signed = issuerAWallet.sign(prepared);
    const response = await client.submitAndWait(signed.tx_blob);

    const result = response.result as any;
    const meta = result.meta;

    const engineResult =
      meta && typeof meta === 'object' ? meta.TransactionResult ?? null : null;

    const validated = result.validated === true;
    const ledgerIndex = result.ledger_index ?? result.ledgerIndex ?? null;
    const txHash = result.hash ?? signed.hash;

    if (!validated || engineResult !== 'tesSUCCESS') {
      throw new InternalServerErrorException({
        message: 'XRPL transaction was not confirmed successfully',
        txHash,
        engineResult,
        validated,
        ledgerIndex,
      });
    }

    return {
      txHash,
      ledgerIndex,
      engineResult,
      validated,
      from: issuerAWallet.address,
      to: issuerBWallet.address,
      amountXrp,
    };
  }

  private assertValidAmount(amountXrp: string): void {
    const parsed = Number(amountXrp);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new InternalServerErrorException(
        'amountXrp must be a positive number',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isConnected()) {
      await this.client.disconnect();
    }
  }
}