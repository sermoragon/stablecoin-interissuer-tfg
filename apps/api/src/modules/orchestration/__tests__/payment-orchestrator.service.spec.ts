import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PaymentOrchestratorService } from '../payment-orchestrator.service';
import { PaymentStateMachineService } from '../payment-state-machine.service';

describe('PaymentOrchestratorService', () => {
  const paymentId = 'payment-1';

  let prisma: any;
  let xrplSettlementService: any;
  let stateMachine: PaymentStateMachineService;
  let service: PaymentOrchestratorService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (callback) => callback(prisma)),
      payment: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      paymentEvent: {
        create: jest.fn(),
      },
    };

    xrplSettlementService = {
      settleCrossCurrencyPayment: jest.fn(),
    };

    stateMachine = new PaymentStateMachineService();

    service = new PaymentOrchestratorService(
      prisma,
      stateMachine,
      xrplSettlementService,
    );
  });

  it('orchestrates a successful XRPL settlement and marks the payment as SETTLED', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: paymentId,
      status: PaymentStatus.ISO_ACK_ACCEPTED,
    });

    prisma.payment.update
      .mockResolvedValueOnce({
        id: paymentId,
        status: PaymentStatus.XRPL_SETTLEMENT_REQUESTED,
      })
      .mockResolvedValueOnce({
        id: paymentId,
        status: PaymentStatus.XRPL_SETTLEMENT_CONFIRMED,
      })
      .mockResolvedValueOnce({
        id: paymentId,
        status: PaymentStatus.SETTLED,
      });

    xrplSettlementService.settleCrossCurrencyPayment.mockResolvedValue({
      alreadySettled: false,
      paymentId,
      txHash: 'ABC123',
      engineResult: 'tesSUCCESS',
      validated: true,
    });

    const result = await service.settlePaymentWithXrpl({
      paymentId,
      destinationAmount: '2',
      sendMax: '2.2',
    });

    expect(result).toMatchObject({
      paymentId,
      status: PaymentStatus.SETTLED,
      xrpl: {
        txHash: 'ABC123',
        engineResult: 'tesSUCCESS',
        validated: true,
      },
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(prisma.payment.update).toHaveBeenCalledTimes(3);
    expect(prisma.paymentEvent.create).toHaveBeenCalledTimes(3);

    expect(xrplSettlementService.settleCrossCurrencyPayment).toHaveBeenCalledWith(
      {
        paymentId,
        destinationAmount: '2',
        sendMax: '2.2',
      },
    );

    expect(prisma.payment.update).toHaveBeenNthCalledWith(1, {
      where: {
        id: paymentId,
      },
      data: {
        status: PaymentStatus.XRPL_SETTLEMENT_REQUESTED,
      },
    });

    expect(prisma.payment.update).toHaveBeenNthCalledWith(2, {
      where: {
        id: paymentId,
      },
      data: {
        status: PaymentStatus.XRPL_SETTLEMENT_CONFIRMED,
      },
    });

    expect(prisma.payment.update).toHaveBeenNthCalledWith(3, {
      where: {
        id: paymentId,
      },
      data: {
        status: PaymentStatus.SETTLED,
      },
    });
  });

  it('resumes settlement when the payment is already XRPL_SETTLEMENT_REQUESTED', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: paymentId,
      status: PaymentStatus.XRPL_SETTLEMENT_REQUESTED,
    });

    prisma.payment.update
      .mockResolvedValueOnce({
        id: paymentId,
        status: PaymentStatus.XRPL_SETTLEMENT_CONFIRMED,
      })
      .mockResolvedValueOnce({
        id: paymentId,
        status: PaymentStatus.SETTLED,
      });

    xrplSettlementService.settleCrossCurrencyPayment.mockResolvedValue({
      alreadySettled: false,
      paymentId,
      txHash: 'ABC123',
      engineResult: 'tesSUCCESS',
      validated: true,
    });

    const result = await service.settlePaymentWithXrpl({
      paymentId,
      destinationAmount: '2',
      sendMax: '2.2',
    });

    expect(result).toMatchObject({
      paymentId,
      status: PaymentStatus.SETTLED,
      xrpl: {
        txHash: 'ABC123',
        engineResult: 'tesSUCCESS',
        validated: true,
      },
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.payment.update).toHaveBeenCalledTimes(2);
    expect(prisma.paymentEvent.create).toHaveBeenCalledTimes(2);

    expect(prisma.payment.update).not.toHaveBeenCalledWith({
      where: {
        id: paymentId,
      },
      data: {
        status: PaymentStatus.XRPL_SETTLEMENT_REQUESTED,
      },
    });

    expect(prisma.payment.update).toHaveBeenNthCalledWith(1, {
      where: {
        id: paymentId,
      },
      data: {
        status: PaymentStatus.XRPL_SETTLEMENT_CONFIRMED,
      },
    });

    expect(prisma.payment.update).toHaveBeenNthCalledWith(2, {
      where: {
        id: paymentId,
      },
      data: {
        status: PaymentStatus.SETTLED,
      },
    });

    expect(xrplSettlementService.settleCrossCurrencyPayment).toHaveBeenCalledWith(
      {
        paymentId,
        destinationAmount: '2',
        sendMax: '2.2',
      },
    );
  });

  it('marks the payment as FAILED when XRPL settlement fails', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: paymentId,
      status: PaymentStatus.ISO_ACK_ACCEPTED,
    });

    prisma.payment.update
      .mockResolvedValueOnce({
        id: paymentId,
        status: PaymentStatus.XRPL_SETTLEMENT_REQUESTED,
      })
      .mockResolvedValueOnce({
        id: paymentId,
        status: PaymentStatus.XRPL_SETTLEMENT_FAILED,
      })
      .mockResolvedValueOnce({
        id: paymentId,
        status: PaymentStatus.FAILED,
      });

    xrplSettlementService.settleCrossCurrencyPayment.mockRejectedValue(
      new Error('XRPL settlement failed'),
    );

    await expect(
      service.settlePaymentWithXrpl({
        paymentId,
        destinationAmount: '2',
        sendMax: '2.2',
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(prisma.payment.update).toHaveBeenCalledTimes(3);
    expect(prisma.paymentEvent.create).toHaveBeenCalledTimes(3);

    expect(prisma.payment.update).toHaveBeenNthCalledWith(2, {
      where: {
        id: paymentId,
      },
      data: {
        status: PaymentStatus.XRPL_SETTLEMENT_FAILED,
      },
    });

    expect(prisma.payment.update).toHaveBeenNthCalledWith(3, {
      where: {
        id: paymentId,
      },
      data: {
        status: PaymentStatus.FAILED,
      },
    });
  });

  it('returns alreadySettled when the payment is already SETTLED', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: paymentId,
      status: PaymentStatus.SETTLED,
    });

    const result = await service.settlePaymentWithXrpl({
      paymentId,
      destinationAmount: '2',
      sendMax: '2.2',
    });

    expect(result).toEqual({
      paymentId,
      status: PaymentStatus.SETTLED,
      alreadySettled: true,
    });

    expect(xrplSettlementService.settleCrossCurrencyPayment).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.paymentEvent.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when payment does not exist', async () => {
    prisma.payment.findUnique.mockResolvedValue(null);

    await expect(
      service.settlePaymentWithXrpl({
        paymentId,
        destinationAmount: '2',
        sendMax: '2.2',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(xrplSettlementService.settleCrossCurrencyPayment).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects payments that are not ready for XRPL orchestration', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: paymentId,
      status: PaymentStatus.CREATED,
    });

    await expect(
      service.settlePaymentWithXrpl({
        paymentId,
        destinationAmount: '2',
        sendMax: '2.2',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(xrplSettlementService.settleCrossCurrencyPayment).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.paymentEvent.create).not.toHaveBeenCalled();
  });
});