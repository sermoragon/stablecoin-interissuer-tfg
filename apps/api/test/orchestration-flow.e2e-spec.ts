import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Issuer, PaymentStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/persistence/prisma.service';
import { XrplSettlementService } from '../src/modules/xrpl/xrpl-settlement.service';

describe('Orchestration flow E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let xrplSettlementService: any;

  beforeAll(async () => {
    process.env.OUTBOX_POLLING_ENABLED = 'false';

    xrplSettlementService = {
      settleCrossCurrencyPayment: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(XrplSettlementService)
      .useValue(xrplSettlementService)
      .compile();

    app = moduleRef.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    await prisma.outboxMessage.deleteMany();
    await prisma.replayNonce.deleteMany();
    await prisma.idempotencyRecord.deleteMany();
    await prisma.isoMessage.deleteMany();
    await prisma.paymentEvent.deleteMany();
    await prisma.payment.deleteMany();
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.outboxMessage.deleteMany();
      await prisma.replayNonce.deleteMany();
      await prisma.idempotencyRecord.deleteMany();
      await prisma.isoMessage.deleteMany();
      await prisma.paymentEvent.deleteMany();
      await prisma.payment.deleteMany();
    }

    if (app) {
      await app.close();
    }
  });

  it('settles an ISO_ACK_ACCEPTED payment through the orchestration endpoint and persists the state timeline', async () => {
    const payment = await createPayment({
      id: 'payment-orchestration-success',
      status: PaymentStatus.ISO_ACK_ACCEPTED,
    });

    xrplSettlementService.settleCrossCurrencyPayment.mockResolvedValue({
      alreadySettled: false,
      paymentId: payment.id,
      network: 'testnet',
      txHash: 'ABC123',
      ledgerIndex: 12345,
      engineResult: 'tesSUCCESS',
      validated: true,
    });

    const response = await request(app.getHttpServer())
      .post(`/orchestration/payments/${payment.id}/settle-xrpl`)
      .send({
        destinationAmount: '2',
        sendMax: '2.2',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      paymentId: payment.id,
      status: PaymentStatus.SETTLED,
      xrpl: {
        txHash: 'ABC123',
        engineResult: 'tesSUCCESS',
        validated: true,
      },
    });

    expect(xrplSettlementService.settleCrossCurrencyPayment).toHaveBeenCalledTimes(
      1,
    );

    expect(xrplSettlementService.settleCrossCurrencyPayment).toHaveBeenCalledWith(
      {
        paymentId: payment.id,
        destinationAmount: '2',
        sendMax: '2.2',
      },
    );

    const persistedPayment = await prisma.payment.findUniqueOrThrow({
      where: {
        id: payment.id,
      },
    });

    expect(persistedPayment.status).toBe(PaymentStatus.SETTLED);

    const statusEvents = await prisma.paymentEvent.findMany({
      where: {
        paymentId: payment.id,
        type: 'PAYMENT_STATUS_CHANGED',
      },
    });

    expect(statusEvents).toHaveLength(3);

    expect(statusEvents.map((event) => event.payload as any)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: PaymentStatus.ISO_ACK_ACCEPTED,
          to: PaymentStatus.XRPL_SETTLEMENT_REQUESTED,
        }),
        expect.objectContaining({
          from: PaymentStatus.XRPL_SETTLEMENT_REQUESTED,
          to: PaymentStatus.XRPL_SETTLEMENT_CONFIRMED,
        }),
        expect.objectContaining({
          from: PaymentStatus.XRPL_SETTLEMENT_CONFIRMED,
          to: PaymentStatus.SETTLED,
        }),
      ]),
    );

    const secondResponse = await request(app.getHttpServer())
      .post(`/orchestration/payments/${payment.id}/settle-xrpl`)
      .send({
        destinationAmount: '2',
        sendMax: '2.2',
      })
      .expect(200);

    expect(secondResponse.body).toEqual({
      paymentId: payment.id,
      status: PaymentStatus.SETTLED,
      alreadySettled: true,
    });

    expect(xrplSettlementService.settleCrossCurrencyPayment).toHaveBeenCalledTimes(
      1,
    );

    const statusEventCountAfterSecondCall = await prisma.paymentEvent.count({
      where: {
        paymentId: payment.id,
        type: 'PAYMENT_STATUS_CHANGED',
      },
    });

    expect(statusEventCountAfterSecondCall).toBe(3);
  });

  it('marks the payment as FAILED when the mocked XRPL settlement fails', async () => {
    const payment = await createPayment({
      id: 'payment-orchestration-failure',
      status: PaymentStatus.ISO_ACK_ACCEPTED,
    });

    xrplSettlementService.settleCrossCurrencyPayment.mockRejectedValue(
      new Error('Mocked XRPL settlement failure'),
    );

    await request(app.getHttpServer())
      .post(`/orchestration/payments/${payment.id}/settle-xrpl`)
      .send({
        destinationAmount: '2',
        sendMax: '2.2',
      })
      .expect(500);

    expect(xrplSettlementService.settleCrossCurrencyPayment).toHaveBeenCalledTimes(
      1,
    );

    const persistedPayment = await prisma.payment.findUniqueOrThrow({
      where: {
        id: payment.id,
      },
    });

    expect(persistedPayment.status).toBe(PaymentStatus.FAILED);

    const statusEvents = await prisma.paymentEvent.findMany({
      where: {
        paymentId: payment.id,
        type: 'PAYMENT_STATUS_CHANGED',
      },
    });

    expect(statusEvents).toHaveLength(3);

    expect(statusEvents.map((event) => event.payload as any)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: PaymentStatus.ISO_ACK_ACCEPTED,
          to: PaymentStatus.XRPL_SETTLEMENT_REQUESTED,
        }),
        expect.objectContaining({
          from: PaymentStatus.XRPL_SETTLEMENT_REQUESTED,
          to: PaymentStatus.XRPL_SETTLEMENT_FAILED,
        }),
        expect.objectContaining({
          from: PaymentStatus.XRPL_SETTLEMENT_FAILED,
          to: PaymentStatus.FAILED,
        }),
      ]),
    );
  });

  async function createPayment(args: {
    id: string;
    status: PaymentStatus;
  }) {
    return prisma.payment.create({
      data: {
        id: args.id,
        correlationId: `CORR-${args.id}`,
        instructionId: `INSTR-${args.id}`,
        endToEndId: `E2E-${args.id}`,
        senderIssuer: Issuer.ISSUER_A,
        receiverIssuer: Issuer.ISSUER_B,
        amount: '125.50',
        currency: 'USD_A',
        debtorName: 'Issuer A Treasury',
        creditorName: 'Issuer B Treasury',
        debtorBic: 'ISSRAESMXXX',
        creditorBic: 'ISSRBESMXXX',
        remittanceInfo: 'TFG orchestration flow E2E',
        status: args.status,
      },
    });
  }
});