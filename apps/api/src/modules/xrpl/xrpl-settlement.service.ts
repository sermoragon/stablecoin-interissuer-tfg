import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { SettleCrossCurrencyPaymentDto } from './dto/settle-cross-currency-payment.dto';
import { SettleXrpPaymentDto } from './dto/settle-xrp-payment.dto';
import { getXrplConfig } from './xrpl.config';
import { XrplClientService, XrplPaymentResult } from './xrpl-client.service';

const XRPL_XRP_PAYMENT_REQUESTED = 'XRPL_XRP_PAYMENT_REQUESTED';
const XRPL_XRP_PAYMENT_CONFIRMED = 'XRPL_XRP_PAYMENT_CONFIRMED';
const XRPL_XRP_PAYMENT_FAILED = 'XRPL_XRP_PAYMENT_FAILED';

const XRPL_CROSS_CURRENCY_PAYMENT_REQUESTED =
  'XRPL_CROSS_CURRENCY_PAYMENT_REQUESTED';
const XRPL_CROSS_CURRENCY_PAYMENT_CONFIRMED =
  'XRPL_CROSS_CURRENCY_PAYMENT_CONFIRMED';
const XRPL_CROSS_CURRENCY_PAYMENT_FAILED =
  'XRPL_CROSS_CURRENCY_PAYMENT_FAILED';

function toPrismaJson(value: unknown): Prisma.InputJsonValue | null {
  if (value === undefined || value === null) {
    return null;
  }

  const serialized = JSON.stringify(value);

  if (serialized === undefined) {
    return null;
  }

  return JSON.parse(serialized) as Prisma.InputJsonValue;
}

@Injectable()
export class XrplSettlementService {
  private readonly config = getXrplConfig();

  constructor(
    private readonly prisma: PrismaService,
    private readonly xrplClientService: XrplClientService,
  ) {}

  async settleXrpPayment(input: SettleXrpPaymentDto) {
    const payment = await this.prisma.payment.findUnique({
      where: {
        id: input.paymentId,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${input.paymentId} not found`);
    }

    if (payment.status !== PaymentStatus.ISO_ACK_ACCEPTED) {
      throw new BadRequestException(
        `Payment must be ISO_ACK_ACCEPTED before XRPL settlement. Current status: ${payment.status}`,
      );
    }

    const existingConfirmedEvent = await this.prisma.paymentEvent.findFirst({
      where: {
        paymentId: payment.id,
        type: XRPL_XRP_PAYMENT_CONFIRMED,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existingConfirmedEvent) {
      return {
        alreadySettled: true,
        paymentId: payment.id,
        eventId: existingConfirmedEvent.id,
        payload: existingConfirmedEvent.payload,
      };
    }

    const amountXrp = input.amountXrp ?? this.config.defaultXrpAmount;

    await this.prisma.paymentEvent.create({
      data: {
        paymentId: payment.id,
        type: XRPL_XRP_PAYMENT_REQUESTED,
        payload: {
          network: this.config.network,
          amountXrp,
          requestedAt: new Date().toISOString(),
        },
      },
    });

    try {
      const xrplResult =
        await this.xrplClientService.sendXrpFromIssuerAToIssuerB(amountXrp);

      await this.prisma.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: XRPL_XRP_PAYMENT_CONFIRMED,
          payload: this.buildConfirmedPayload(xrplResult),
        },
      });

      return {
        alreadySettled: false,
        paymentId: payment.id,
        network: this.config.network,
        ...xrplResult,
      };
    } catch (error) {
      await this.prisma.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: XRPL_XRP_PAYMENT_FAILED,
          payload: {
            network: this.config.network,
            amountXrp,
            error:
              error instanceof Error
                ? error.message
                : 'Unknown XRPL settlement error',
            failedAt: new Date().toISOString(),
          },
        },
      });

      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'XRPL settlement failed',
      );
    }
  }

  async settleCrossCurrencyPayment(input: SettleCrossCurrencyPaymentDto) {
    const payment = await this.prisma.payment.findUnique({
      where: {
        id: input.paymentId,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${input.paymentId} not found`);
    }

    const isAllowedStatus =
      payment.status === PaymentStatus.ISO_ACK_ACCEPTED ||
      payment.status === PaymentStatus.XRPL_SETTLEMENT_REQUESTED;

    if (!isAllowedStatus) {
      throw new BadRequestException(
        `Payment must be ISO_ACK_ACCEPTED or XRPL_SETTLEMENT_REQUESTED before XRPL settlement. Current status: ${payment.status}`,
      );
    }

    const existingConfirmedEvent = await this.prisma.paymentEvent.findFirst({
      where: {
        paymentId: payment.id,
        type: XRPL_CROSS_CURRENCY_PAYMENT_CONFIRMED,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existingConfirmedEvent) {
      return {
        alreadySettled: true,
        paymentId: payment.id,
        eventId: existingConfirmedEvent.id,
        payload: existingConfirmedEvent.payload,
      };
    }

    const destinationAmount =
      input.destinationAmount ?? this.config.crossCurrencyDestinationAmount;

    const sendMax = input.sendMax ?? this.config.crossCurrencySendMax;

    await this.prisma.paymentEvent.create({
      data: {
        paymentId: payment.id,
        type: XRPL_CROSS_CURRENCY_PAYMENT_REQUESTED,
        payload: {
          network: this.config.network,
          destinationAmount,
          sendMax,
          requestedAt: new Date().toISOString(),
        },
      },
    });

    try {
      const xrplResult =
        await this.xrplClientService.sendCrossCurrencyPaymentFromIssuerAToIssuerB(
          {
            destinationAmountValue: destinationAmount,
            sendMaxValue: sendMax,
          },
        );

      const confirmedPayload: Prisma.InputJsonObject = {
        network: this.config.network,
        txHash: xrplResult.txHash,
        ledgerIndex: xrplResult.ledgerIndex,
        engineResult: xrplResult.engineResult,
        validated: xrplResult.validated,
        from: xrplResult.from,
        to: xrplResult.to,
        sourceAmount: toPrismaJson(xrplResult.sourceAmount),
        destinationAmount: toPrismaJson(xrplResult.destinationAmount),
        sendMax: toPrismaJson(xrplResult.sendMax),
        deliveredAmount: toPrismaJson(xrplResult.deliveredAmount),
        paths: toPrismaJson(xrplResult.paths),
        confirmedAt: new Date().toISOString(),
      };

      await this.prisma.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: XRPL_CROSS_CURRENCY_PAYMENT_CONFIRMED,
          payload: confirmedPayload,
        },
      });

      return {
        alreadySettled: false,
        paymentId: payment.id,
        network: this.config.network,
        ...xrplResult,
      };
    } catch (error) {
      await this.prisma.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: XRPL_CROSS_CURRENCY_PAYMENT_FAILED,
          payload: {
            network: this.config.network,
            destinationAmount,
            sendMax,
            error:
              error instanceof Error
                ? error.message
                : 'Unknown XRPL cross-currency settlement error',
            failedAt: new Date().toISOString(),
          },
        },
      });

      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'XRPL cross-currency settlement failed',
      );
    }
  }

  private buildConfirmedPayload(result: XrplPaymentResult) {
    return {
      network: this.config.network,
      txHash: result.txHash,
      ledgerIndex: result.ledgerIndex,
      engineResult: result.engineResult,
      validated: result.validated,
      from: result.from,
      to: result.to,
      amountXrp: result.amountXrp,
      confirmedAt: new Date().toISOString(),
    };
  }
}