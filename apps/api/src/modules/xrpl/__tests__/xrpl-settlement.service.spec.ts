import { BadRequestException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { XrplSettlementService } from '../xrpl-settlement.service';

describe('XrplSettlementService', () => {
  const paymentId = 'payment-1';

  let prisma: any;
  let xrplClientService: any;
  let service: XrplSettlementService;

  beforeEach(() => {
    process.env.XRPL_NETWORK = 'testnet';
    process.env.XRPL_CROSS_CURRENCY_DESTINATION_AMOUNT = '5';
    process.env.XRPL_CROSS_CURRENCY_SEND_MAX = '5.5';

    prisma = {
      payment: {
        findUnique: jest.fn(),
      },
      paymentEvent: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    xrplClientService = {
      sendXrpFromIssuerAToIssuerB: jest.fn(),
      sendCrossCurrencyPaymentFromIssuerAToIssuerB: jest.fn(),
    };

    service = new XrplSettlementService(prisma, xrplClientService);
  });

  it('settles a cross-currency payment and persists requested and confirmed events', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: paymentId,
      status: PaymentStatus.ISO_ACK_ACCEPTED,
    });

    prisma.paymentEvent.findFirst.mockResolvedValue(null);

    xrplClientService.sendCrossCurrencyPaymentFromIssuerAToIssuerB.mockResolvedValue(
      {
        txHash: 'ABC123',
        ledgerIndex: 17113014,
        engineResult: 'tesSUCCESS',
        validated: true,
        from: 'rIssuerATreasury',
        to: 'rIssuerBTreasury',
        sourceAmount: {
          currency: 'USD',
          issuer: 'rIssuerACold',
          value: '2',
        },
        destinationAmount: {
          currency: 'USD',
          issuer: 'rIssuerBCold',
          value: '2',
        },
        sendMax: {
          currency: 'USD',
          issuer: 'rIssuerACold',
          value: '2.2',
        },
        deliveredAmount: {
          currency: 'USD',
          issuer: 'rIssuerBCold',
          value: '2',
        },
        paths: [
          [
            {
              currency: 'XRP',
            },
            {
              currency: 'USD',
              issuer: 'rIssuerBCold',
            },
          ],
        ],
      },
    );

    const result = await service.settleCrossCurrencyPayment({
      paymentId,
      destinationAmount: '2',
      sendMax: '2.2',
    });

    expect(result).toMatchObject({
      alreadySettled: false,
      paymentId,
      network: 'testnet',
      txHash: 'ABC123',
      ledgerIndex: 17113014,
      engineResult: 'tesSUCCESS',
      validated: true,
    });

    expect(
      xrplClientService.sendCrossCurrencyPaymentFromIssuerAToIssuerB,
    ).toHaveBeenCalledWith({
      destinationAmountValue: '2',
      sendMaxValue: '2.2',
    });

    expect(prisma.paymentEvent.create).toHaveBeenCalledTimes(2);

    expect(prisma.paymentEvent.create).toHaveBeenNthCalledWith(1, {
      data: {
        paymentId,
        type: 'XRPL_CROSS_CURRENCY_PAYMENT_REQUESTED',
        payload: expect.objectContaining({
          network: 'testnet',
          destinationAmount: '2',
          sendMax: '2.2',
          requestedAt: expect.any(String),
        }),
      },
    });

    expect(prisma.paymentEvent.create).toHaveBeenNthCalledWith(2, {
      data: {
        paymentId,
        type: 'XRPL_CROSS_CURRENCY_PAYMENT_CONFIRMED',
        payload: expect.objectContaining({
          network: 'testnet',
          txHash: 'ABC123',
          ledgerIndex: 17113014,
          engineResult: 'tesSUCCESS',
          validated: true,
          from: 'rIssuerATreasury',
          to: 'rIssuerBTreasury',
          sourceAmount: expect.objectContaining({
            currency: 'USD',
            issuer: 'rIssuerACold',
            value: '2',
          }),
          destinationAmount: expect.objectContaining({
            currency: 'USD',
            issuer: 'rIssuerBCold',
            value: '2',
          }),
          sendMax: expect.objectContaining({
            currency: 'USD',
            issuer: 'rIssuerACold',
            value: '2.2',
          }),
          deliveredAmount: expect.objectContaining({
            currency: 'USD',
            issuer: 'rIssuerBCold',
            value: '2',
          }),
          paths: expect.any(Array),
          confirmedAt: expect.any(String),
        }),
      },
    });
  });

  it('does not send a second XRPL transaction when the payment is already settled', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: paymentId,
      status: PaymentStatus.ISO_ACK_ACCEPTED,
    });

    prisma.paymentEvent.findFirst.mockResolvedValue({
      id: 'event-1',
      paymentId,
      type: 'XRPL_CROSS_CURRENCY_PAYMENT_CONFIRMED',
      payload: {
        txHash: 'ABC123',
        engineResult: 'tesSUCCESS',
        validated: true,
      },
    });

    const result = await service.settleCrossCurrencyPayment({
      paymentId,
      destinationAmount: '2',
      sendMax: '2.2',
    });

    expect(result).toEqual({
      alreadySettled: true,
      paymentId,
      eventId: 'event-1',
      payload: {
        txHash: 'ABC123',
        engineResult: 'tesSUCCESS',
        validated: true,
      },
    });

    expect(
      xrplClientService.sendCrossCurrencyPaymentFromIssuerAToIssuerB,
    ).not.toHaveBeenCalled();

    expect(prisma.paymentEvent.create).not.toHaveBeenCalled();
  });

  it('rejects cross-currency settlement if payment is not ISO_ACK_ACCEPTED', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: paymentId,
      status: PaymentStatus.CREATED,
    });

    await expect(
      service.settleCrossCurrencyPayment({
        paymentId,
        destinationAmount: '2',
        sendMax: '2.2',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(
      xrplClientService.sendCrossCurrencyPaymentFromIssuerAToIssuerB,
    ).not.toHaveBeenCalled();

    expect(prisma.paymentEvent.create).not.toHaveBeenCalled();
  });
});