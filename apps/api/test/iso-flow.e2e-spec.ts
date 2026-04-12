import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as express from 'express';
import { AddressInfo } from 'net';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/persistence/prisma.service';

describe('ISO Flow E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.ISSUER_A_TO_ISSUER_B_HMAC_SECRET = 'test-secret';
    process.env.HMAC_MAX_CLOCK_SKEW_SECONDS = '300';

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
  });

  beforeEach(async () => {
    await prisma.replayNonce.deleteMany();
    await prisma.idempotencyRecord.deleteMany();
    await prisma.isoMessage.deleteMany();
    await prisma.paymentEvent.deleteMany();
    await prisma.payment.deleteMany();
  });

  afterAll(async () => {
    if (prisma) {
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

  it('should execute the simulated ISO flow end-to-end and persist the full trace', async () => {
    const payload = {
      instructionId: 'INSTR-2026-0001',
      endToEndId: 'E2E-2026-0001',
      correlationId: 'CORR-2026-0001',
      amount: '125.50',
      currency: 'EUR',
      settlementDate: '2026-04-08',
      debtorName: 'Issuer A Treasury',
      creditorName: 'Issuer B Treasury',
      debtorBic: 'ISSRAESMXXX',
      creditorBic: 'ISSRBESMXXX',
      remittanceInfo: 'TFG ISO flow E2E',
    };

    const response = await request(app.getHttpServer())
      .post('/issuer-a/payments/simulate')
      .set('Idempotency-Key', 'ISO-FLOW-E2E-0001')
      .send(payload)
      .expect(201);

    expect(response.body).toMatchObject({
      paymentId: expect.any(String),
      messageId: `MSG-${payload.instructionId}`,
      correlationId: payload.correlationId,
      ackStatus: 'ACCEPTED',
    });

    const payment = await prisma.payment.findUnique({
      where: { id: response.body.paymentId },
    });

    expect(payment).not.toBeNull();

    if (!payment) {
      throw new Error('Payment was not persisted');
    }

    const messages = await prisma.isoMessage.findMany({
      where: { paymentId: payment.id },
      orderBy: { createdAt: 'asc' },
    });

    const events = await prisma.paymentEvent.findMany({
      where: { paymentId: payment.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(payment.instructionId).toBe(payload.instructionId);
    expect(payment.correlationId).toBe(payload.correlationId);
    expect(payment.status).toBe('ISO_ACK_ACCEPTED');

    expect(messages).toHaveLength(4);
    expect(events).toHaveLength(4);

    expect(messages.map((message) => message.messageType)).toEqual([
      'pacs.009',
      'pacs.009',
      'tech_ack',
      'tech_ack',
    ]);

    expect(events.map((event) => event.type)).toEqual([
      'ISO_PACS009_BUILT',
      'ISO_PACS009_RECEIVED',
      'ISO_TECH_ACK_SENT',
      'ISO_TECH_ACK_RECEIVED',
    ]);

    const outboundPacs009 = messages.find(
      (message) =>
        message.direction === 'OUTBOUND' && message.messageType === 'pacs.009',
    );
    const inboundPacs009 = messages.find(
      (message) =>
        message.direction === 'INBOUND' && message.messageType === 'pacs.009',
    );
    const outboundAck = messages.find(
      (message) =>
        message.direction === 'OUTBOUND' && message.messageType === 'tech_ack',
    );
    const inboundAck = messages.find(
      (message) =>
        message.direction === 'INBOUND' && message.messageType === 'tech_ack',
    );

    expect(outboundPacs009).toBeDefined();
    expect(inboundPacs009).toBeDefined();
    expect(outboundAck).toBeDefined();
    expect(inboundAck).toBeDefined();

    expect(outboundPacs009?.messageId).toBe(`MSG-${payload.instructionId}`);
    expect(inboundPacs009?.messageId).toBe(`MSG-${payload.instructionId}`);

    expect(outboundAck?.messageId).toBe(`ACK-MSG-${payload.instructionId}`);
    expect(outboundAck?.relatedMessageId).toBe(`MSG-${payload.instructionId}`);

    expect(inboundAck?.messageId).toBe(`ACK-MSG-${payload.instructionId}`);
    expect(inboundAck?.relatedMessageId).toBe(`MSG-${payload.instructionId}`);

    expect(outboundPacs009?.correlationId).toBe(payload.correlationId);
    expect(inboundPacs009?.correlationId).toBe(payload.correlationId);
    expect(outboundAck?.correlationId).toBe(payload.correlationId);
    expect(inboundAck?.correlationId).toBe(payload.correlationId);

    const paymentCount = await prisma.payment.count();
    const isoMessageCount = await prisma.isoMessage.count();
    const paymentEventCount = await prisma.paymentEvent.count();

    expect(paymentCount).toBe(1);
    expect(isoMessageCount).toBe(4);
    expect(paymentEventCount).toBe(4);
  });
});