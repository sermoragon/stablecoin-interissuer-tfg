import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as express from 'express';
import { AddressInfo } from 'net';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/persistence/prisma.service';
import { OutboxDispatcherService } from '../src/modules/outbox/outbox-dispatcher.service';

describe('Point 3 - outbox and retries E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dispatcher: OutboxDispatcherService;

  beforeAll(async () => {
    process.env.ISSUER_A_TO_ISSUER_B_HMAC_SECRET = 'test-secret';
    process.env.HMAC_MAX_CLOCK_SKEW_SECONDS = '300';
    process.env.OUTBOX_POLLING_ENABLED = 'false';
    process.env.OUTBOX_RETRY_BASE_DELAY_MS = '0';
    process.env.OUTBOX_MAX_ATTEMPTS = '5';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    app.use(
      express.text({
        type: ['application/xml', 'text/xml'],
        limit: '1mb',
      }),
    );

    await app.listen(0);

    const serverAddress = app.getHttpServer().address() as AddressInfo;
    process.env.ISSUER_B_BASE_URL = `http://127.0.0.1:${serverAddress.port}`;

    prisma = app.get(PrismaService);
    dispatcher = app.get(OutboxDispatcherService);
  });

  beforeEach(async () => {
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

  it('should queue the outbound message after a transient failure and deliver it on retry without duplicates', async () => {
    const payload = {
      instructionId: 'INSTR-RETRY-0001',
      endToEndId: 'E2E-RETRY-0001',
      correlationId: 'CORR-RETRY-0001',
      amount: '125.50',
      currency: 'EUR',
      settlementDate: '2026-04-08',
      debtorName: 'Issuer A Treasury',
      creditorName: 'Issuer B Treasury',
      debtorBic: 'ISSRAESMXXX',
      creditorBic: 'ISSRBESMXXX',
      remittanceInfo: 'TFG point 3 outbox retry',
    };

    const realFetch = global.fetch;
    let failOnce = true;

    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (url.includes('/issuer-b/iso/pacs009') && failOnce) {
          failOnce = false;
          throw new Error('Simulated transient network failure');
        }

        return realFetch(input as never, init as never);
      });

    try {
      const response = await request(app.getHttpServer())
        .post('/issuer-a/payments/simulate')
        .set('Idempotency-Key', 'SIM-RETRY-0001')
        .send(payload)
        .expect(201);

      expect(response.body).toMatchObject({
        paymentId: expect.any(String),
        messageId: `MSG-${payload.instructionId}`,
        correlationId: payload.correlationId,
        deliveryStatus: 'QUEUED',
        outboxMessageId: expect.any(String),
      });

      const paymentAfterQueue = await prisma.payment.findUniqueOrThrow({
        where: { id: response.body.paymentId },
      });

      const outboxAfterQueue = await prisma.outboxMessage.findUniqueOrThrow({
        where: { id: response.body.outboxMessageId },
      });

      expect(paymentAfterQueue.status).toBe('ISO_OUTBOUND_BUILT');
      expect(outboxAfterQueue.status).toBe('PENDING');
      expect(outboxAfterQueue.attemptCount).toBe(1);

      expect(await prisma.payment.count()).toBe(1);
      expect(await prisma.isoMessage.count()).toBe(1);
      expect(await prisma.paymentEvent.count()).toBe(1);

      const processed = await dispatcher.processDueMessages();
      expect(processed).toBe(1);

      const paymentAfterRetry = await prisma.payment.findUniqueOrThrow({
        where: { id: response.body.paymentId },
      });

      const outboxAfterRetry = await prisma.outboxMessage.findUniqueOrThrow({
        where: { id: response.body.outboxMessageId },
      });

      expect(paymentAfterRetry.status).toBe('ISO_ACK_ACCEPTED');
      expect(outboxAfterRetry.status).toBe('DELIVERED');
      expect(outboxAfterRetry.attemptCount).toBe(2);

      expect(await prisma.payment.count()).toBe(1);
      expect(await prisma.isoMessage.count()).toBe(4);
      expect(await prisma.paymentEvent.count()).toBe(4);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});