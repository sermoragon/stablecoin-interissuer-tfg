import { BadRequestException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PaymentStateMachineService } from '../payment-state-machine.service';

describe('PaymentStateMachineService', () => {
  let service: PaymentStateMachineService;

  beforeEach(() => {
    service = new PaymentStateMachineService();
  });

  it('allows ISO_ACK_ACCEPTED -> XRPL_SETTLEMENT_REQUESTED', () => {
    expect(
      service.canTransition(
        PaymentStatus.ISO_ACK_ACCEPTED,
        PaymentStatus.XRPL_SETTLEMENT_REQUESTED,
      ),
    ).toBe(true);
  });

  it('allows XRPL_SETTLEMENT_REQUESTED -> XRPL_SETTLEMENT_CONFIRMED', () => {
    expect(
      service.canTransition(
        PaymentStatus.XRPL_SETTLEMENT_REQUESTED,
        PaymentStatus.XRPL_SETTLEMENT_CONFIRMED,
      ),
    ).toBe(true);
  });

  it('allows XRPL_SETTLEMENT_REQUESTED -> XRPL_SETTLEMENT_FAILED', () => {
    expect(
      service.canTransition(
        PaymentStatus.XRPL_SETTLEMENT_REQUESTED,
        PaymentStatus.XRPL_SETTLEMENT_FAILED,
      ),
    ).toBe(true);
  });

  it('allows XRPL_SETTLEMENT_CONFIRMED -> SETTLED', () => {
    expect(
      service.canTransition(
        PaymentStatus.XRPL_SETTLEMENT_CONFIRMED,
        PaymentStatus.SETTLED,
      ),
    ).toBe(true);
  });

  it('allows XRPL_SETTLEMENT_FAILED -> FAILED', () => {
    expect(
      service.canTransition(
        PaymentStatus.XRPL_SETTLEMENT_FAILED,
        PaymentStatus.FAILED,
      ),
    ).toBe(true);
  });

  it('does not allow ISO_ACK_ACCEPTED -> SETTLED directly', () => {
    expect(
      service.canTransition(
        PaymentStatus.ISO_ACK_ACCEPTED,
        PaymentStatus.SETTLED,
      ),
    ).toBe(false);
  });

  it('does not allow SETTLED -> XRPL_SETTLEMENT_REQUESTED', () => {
    expect(
      service.canTransition(
        PaymentStatus.SETTLED,
        PaymentStatus.XRPL_SETTLEMENT_REQUESTED,
      ),
    ).toBe(false);
  });

  it('throws BadRequestException for invalid transitions', () => {
    expect(() =>
      service.assertTransitionAllowed(
        PaymentStatus.ISO_ACK_ACCEPTED,
        PaymentStatus.SETTLED,
      ),
    ).toThrow(BadRequestException);
  });

  it('returns an empty list for terminal SETTLED status', () => {
    expect(service.getAllowedTransitions(PaymentStatus.SETTLED)).toEqual([]);
  });

  it('returns an empty list for terminal FAILED status', () => {
    expect(service.getAllowedTransitions(PaymentStatus.FAILED)).toEqual([]);
  });
});