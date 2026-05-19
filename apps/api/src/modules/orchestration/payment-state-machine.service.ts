import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class PaymentStateMachineService {
  private readonly allowedTransitions = new Map<PaymentStatus, PaymentStatus[]>([
    [
      PaymentStatus.ISO_ACK_ACCEPTED,
      [PaymentStatus.XRPL_SETTLEMENT_REQUESTED],
    ],
    [
      PaymentStatus.XRPL_SETTLEMENT_REQUESTED,
      [
        PaymentStatus.XRPL_SETTLEMENT_CONFIRMED,
        PaymentStatus.XRPL_SETTLEMENT_FAILED,
      ],
    ],
    [PaymentStatus.XRPL_SETTLEMENT_CONFIRMED, [PaymentStatus.SETTLED]],
    [PaymentStatus.XRPL_SETTLEMENT_FAILED, [PaymentStatus.FAILED]],
    [PaymentStatus.SETTLED, []],
    [PaymentStatus.FAILED, []],
  ]);

  getAllowedTransitions(from: PaymentStatus): PaymentStatus[] {
    return this.allowedTransitions.get(from) ?? [];
  }

  canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
    return this.getAllowedTransitions(from).includes(to);
  }

  assertTransitionAllowed(from: PaymentStatus, to: PaymentStatus): void {
    if (this.canTransition(from, to)) {
      return;
    }

    throw new BadRequestException(
      `Invalid payment status transition: ${from} -> ${to}`,
    );
  }
}