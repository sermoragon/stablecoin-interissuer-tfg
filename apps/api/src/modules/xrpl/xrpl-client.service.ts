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

export type XrplIssuedAmount = {
  currency: string;
  issuer: string;
  value: string;
};

export type XrplCrossCurrencyPaymentResult = {
  txHash: string;
  ledgerIndex: number | null;
  engineResult: string | null;
  validated: boolean;
  from: string;
  to: string;
  sourceAmount: XrplIssuedAmount;
  destinationAmount: XrplIssuedAmount;
  sendMax: XrplIssuedAmount;
  deliveredAmount: unknown;
  paths: unknown[];
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

  getIssuerAColdWallet(): Wallet {
    if (!this.config.issuerAColdSeed) {
      throw new InternalServerErrorException(
        'XRPL_ISSUER_A_COLD_SEED is required',
      );
    }

    return Wallet.fromSeed(this.config.issuerAColdSeed);
  }

  getIssuerBColdWallet(): Wallet {
    if (!this.config.issuerBColdSeed) {
      throw new InternalServerErrorException(
        'XRPL_ISSUER_B_COLD_SEED is required',
      );
    }

    return Wallet.fromSeed(this.config.issuerBColdSeed);
  }

  async sendCrossCurrencyPaymentFromIssuerAToIssuerB(params: {
    destinationAmountValue: string;
    sendMaxValue: string;
  }): Promise<XrplCrossCurrencyPaymentResult> {
    const { destinationAmountValue, sendMaxValue } = params;

    this.assertValidAmount(destinationAmountValue);
    this.assertValidAmount(sendMaxValue);

    const client = await this.getClient();

    const issuerATreasuryWallet = this.getIssuerATreasuryWallet();
    const issuerBTreasuryWallet = this.getIssuerBTreasuryWallet();
    const issuerAColdWallet = this.getIssuerAColdWallet();
    const issuerBColdWallet = this.getIssuerBColdWallet();

    const sourceAmount: XrplIssuedAmount = {
      currency: this.config.stablecoinCurrency,
      issuer: issuerAColdWallet.address,
      value: destinationAmountValue,
    };

    const destinationAmount: XrplIssuedAmount = {
      currency: this.config.stablecoinCurrency,
      issuer: issuerBColdWallet.address,
      value: destinationAmountValue,
    };

    const sendMax: XrplIssuedAmount = {
      currency: this.config.stablecoinCurrency,
      issuer: issuerAColdWallet.address,
      value: sendMaxValue,
    };

    const paths = [
      [
        {
          currency: 'XRP',
        },
        {
          currency: this.config.stablecoinCurrency,
          issuer: issuerBColdWallet.address,
        },
      ],
    ];

    const payment: Payment = {
      TransactionType: 'Payment',
      Account: issuerATreasuryWallet.address,
      Destination: issuerBTreasuryWallet.address,
      Amount: destinationAmount,
      SendMax: sendMax,
      Paths: paths,
    } as Payment;

    const prepared = await client.autofill(payment);
    const signed = issuerATreasuryWallet.sign(prepared);
    const response = await client.submitAndWait(signed.tx_blob);

    const result = response.result as any;
    const meta = result.meta;

    const engineResult =
      meta && typeof meta === 'object' ? meta.TransactionResult ?? null : null;

    const deliveredAmount =
      meta && typeof meta === 'object'
        ? meta.delivered_amount ?? meta.DeliveredAmount ?? null
        : null;

    const validated = result.validated === true;
    const ledgerIndex = result.ledger_index ?? result.ledgerIndex ?? null;
    const txHash = result.hash ?? signed.hash;

    if (!validated || engineResult !== 'tesSUCCESS') {
      throw new InternalServerErrorException({
        message: 'XRPL cross-currency transaction was not confirmed successfully',
        txHash,
        engineResult,
        validated,
        ledgerIndex,
        deliveredAmount,
      });
    }

    return {
      txHash,
      ledgerIndex,
      engineResult,
      validated,
      from: issuerATreasuryWallet.address,
      to: issuerBTreasuryWallet.address,
      sourceAmount,
      destinationAmount,
      sendMax,
      deliveredAmount,
      paths,
    };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isConnected()) {
      await this.client.disconnect();
    }
  }
}