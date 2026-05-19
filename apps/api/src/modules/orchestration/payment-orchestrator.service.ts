import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { XrplSettlementService } from '../xrpl/xrpl-settlement.service';
import { PaymentStateMachineService } from './payment-state-machine.service';

const PAYMENT_STATUS_CHANGED = 'PAYMENT_STATUS_CHANGED';

export type SettlePaymentWithXrplInput = {
  paymentId: string;
  destinationAmount?: string;
  sendMax?: string;
};

@Injectable()
export class PaymentOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: PaymentStateMachineService,
    private readonly xrplSettlementService: XrplSettlementService,
  ) {}

  async settlePaymentWithXrpl(input: SettlePaymentWithXrplInput) {
    const payment = await this.prisma.payment.findUnique({
      where: {
        id: input.paymentId,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${input.paymentId} not found`);
    }

    if (payment.status === PaymentStatus.SETTLED) {
      return {
        paymentId: payment.id,
        status: payment.status,
        alreadySettled: true,
      };
    }

    if (payment.status === PaymentStatus.ISO_ACK_ACCEPTED) {
      await this.transitionPayment(
        payment.id,
        payment.status,
        PaymentStatus.XRPL_SETTLEMENT_REQUESTED,
        'XRPL settlement requested by orchestrator',
      );
    } else if (payment.status !== PaymentStatus.XRPL_SETTLEMENT_REQUESTED) {
      throw new BadRequestException(
        `Payment must be ISO_ACK_ACCEPTED or XRPL_SETTLEMENT_REQUESTED before XRPL orchestration. Current status: ${payment.status}`,
      );
    }

    try {
      const xrplResult =
        await this.xrplSettlementService.settleCrossCurrencyPayment({
          paymentId: payment.id,
          destinationAmount: input.destinationAmount,
          sendMax: input.sendMax,
        });

      await this.transitionPayment(
        payment.id,
        PaymentStatus.XRPL_SETTLEMENT_REQUESTED,
        PaymentStatus.XRPL_SETTLEMENT_CONFIRMED,
        'XRPL settlement confirmed',
      );

      const settledPayment = await this.transitionPayment(
        payment.id,
        PaymentStatus.XRPL_SETTLEMENT_CONFIRMED,
        PaymentStatus.SETTLED,
        'Payment settled after XRPL confirmation',
      );

      return {
        paymentId: payment.id,
        status: settledPayment.status,
        xrpl: xrplResult,
      };
    } catch (error) {
      await this.transitionPayment(
        payment.id,
        PaymentStatus.XRPL_SETTLEMENT_REQUESTED,
        PaymentStatus.XRPL_SETTLEMENT_FAILED,
        'XRPL settlement failed',
      );

      await this.transitionPayment(
        payment.id,
        PaymentStatus.XRPL_SETTLEMENT_FAILED,
        PaymentStatus.FAILED,
        'Payment failed after XRPL settlement failure',
      );

      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'Payment orchestration failed during XRPL settlement',
      );
    }
  }

  private async transitionPayment(
    paymentId: string,
    from: PaymentStatus,
    to: PaymentStatus,
    reason: string,
  ) {
    this.stateMachine.assertTransitionAllowed(from, to);

    return this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: {
          id: paymentId,
        },
        data: {
          status: to,
        },
      });

      await tx.paymentEvent.create({
        data: {
          paymentId,
          type: PAYMENT_STATUS_CHANGED,
          payload: {
            from,
            to,
            reason,
            changedAt: new Date().toISOString(),
          },
        },
      });

      return updatedPayment;
    });
  }
}