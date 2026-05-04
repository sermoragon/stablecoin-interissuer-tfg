import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { SettleXrpPaymentDto } from './dto/settle-xrp-payment.dto';
import { getXrplConfig } from './xrpl.config';
import { XrplClientService, XrplPaymentResult } from './xrpl-client.service';

const XRPL_XRP_PAYMENT_REQUESTED = 'XRPL_XRP_PAYMENT_REQUESTED';
const XRPL_XRP_PAYMENT_CONFIRMED = 'XRPL_XRP_PAYMENT_CONFIRMED';
const XRPL_XRP_PAYMENT_FAILED = 'XRPL_XRP_PAYMENT_FAILED';

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