import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as express from 'express';
import { AddressInfo } from 'net';
import { AppModule } from '../src/app.module';
import { Pacs009Builder } from '../src/modules/iso20022/builders/pacs009.builder';
import { PrismaService } from '../src/modules/persistence/prisma.service';
import { HmacService } from '../src/modules/security/hmac.service';

describe('Point 3 - security and idempotency E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let pacs009Builder: Pacs009Builder;
  let hmacService: HmacService;

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
    pacs009Builder = app.get(Pacs009Builder);
    hmacService = app.get(HmacService);
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

  it('should return the same response for repeated client calls to issuer A without creating extra records', async () => {
    const payload = {
      instructionId: 'INSTR-IDEMP-0001',
      endToEndId: 'E2E-IDEMP-0001',
      correlationId: 'CORR-IDEMP-0001',
      amount: '125.50',
      currency: 'EUR',
      settlementDate: '2026-04-08',
      debtorName: 'Issuer A Treasury',
      creditorName: 'Issuer B Treasury',
      debtorBic: 'ISSRAESMXXX',
      creditorBic: 'ISSRBESMXXX',
      remittanceInfo: 'TFG point 3 idempotency',
    };

    const first = await request(app.getHttpServer())
      .post('/issuer-a/payments/simulate')
      .set('Idempotency-Key', 'SIM-KEY-0001')
      .send(payload)
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/issuer-a/payments/simulate')
      .set('Idempotency-Key', 'SIM-KEY-0001')
      .send(payload)
      .expect(201);

    expect(second.body).toEqual(first.body);

    expect(await prisma.payment.count()).toBe(1);
    expect(await prisma.isoMessage.count()).toBe(4);
    expect(await prisma.paymentEvent.count()).toBe(4);

    const outboxMessages = await prisma.outboxMessage.findMany({
      orderBy: { createdAt: 'asc' },
    });

    expect(outboxMessages).toHaveLength(1);
    expect(outboxMessages[0].status).toBe('DELIVERED');
    expect(outboxMessages[0].attemptCount).toBe(1);
    expect(outboxMessages[0].messageId).toBe(`MSG-${payload.instructionId}`);
  });

  it('should reject the same Idempotency-Key with a different simulate payload', async () => {
    const payload = {
      instructionId: 'INSTR-IDEMP-0002',
      endToEndId: 'E2E-IDEMP-0002',
      correlationId: 'CORR-IDEMP-0002',
      amount: '125.50',
      currency: 'EUR',
      settlementDate: '2026-04-08',
      debtorName: 'Issuer A Treasury',
      creditorName: 'Issuer B Treasury',
      debtorBic: 'ISSRAESMXXX',
      creditorBic: 'ISSRBESMXXX',
      remittanceInfo: 'TFG point 3 idempotency',
    };

    await request(app.getHttpServer())
      .post('/issuer-a/payments/simulate')
      .set('Idempotency-Key', 'SIM-KEY-0002')
      .send(payload)
      .expect(201);

    await request(app.getHttpServer())
      .post('/issuer-a/payments/simulate')
      .set('Idempotency-Key', 'SIM-KEY-0002')
      .send({ ...payload, amount: '999.99' })
      .expect(409);
  });

  it('should reject a bad HMAC signature at issuer B', async () => {
    const xml = buildSampleXml();

    await request(app.getHttpServer())
      .post('/issuer-b/iso/pacs009')
      .set('Content-Type', 'application/xml')
      .set('Idempotency-Key', 'PACS009:MSG-BAD-SIG')
      .set('X-Issuer-Id', 'ISSUER_A')
      .set('X-Timestamp', Date.now().toString())
      .set('X-Nonce', 'nonce-bad-sig')
      .set('X-Signature', 'bad-signature')
      .send(xml)
      .expect(401);
  });

  it('should reject a stale timestamp at issuer B', async () => {
    const xml = buildSampleXml();
    const timestamp = (Date.now() - 10 * 60 * 1000).toString();

    const signature = hmacService.signRequest({
      issuerId: 'ISSUER_A',
      idempotencyKey: 'PACS009:MSG-STALE',
      timestamp,
      nonce: 'nonce-stale',
      method: 'POST',
      path: '/issuer-b/iso/pacs009',
      body: xml,
    });

    await request(app.getHttpServer())
      .post('/issuer-b/iso/pacs009')
      .set('Content-Type', 'application/xml')
      .set('Idempotency-Key', 'PACS009:MSG-STALE')
      .set('X-Issuer-Id', 'ISSUER_A')
      .set('X-Timestamp', timestamp)
      .set('X-Nonce', 'nonce-stale')
      .set('X-Signature', signature)
      .send(xml)
      .expect(401);
  });

  it('should return the same ACK for a duplicated signed pacs.009 without creating extra records', async () => {
    const xml = buildSampleXml({
      messageId: 'MSG-DUPLICATE-0001',
      correlationId: 'CORR-DUPLICATE-0001',
      instructionId: 'INSTR-DUPLICATE-0001',
      endToEndId: 'E2E-DUPLICATE-0001',
    });

    const timestamp = Date.now().toString();

    const signature = hmacService.signRequest({
      issuerId: 'ISSUER_A',
      idempotencyKey: 'PACS009:MSG-DUPLICATE-0001',
      timestamp,
      nonce: 'nonce-duplicate-0001',
      method: 'POST',
      path: '/issuer-b/iso/pacs009',
      body: xml,
    });

    const first = await request(app.getHttpServer())
      .post('/issuer-b/iso/pacs009')
      .set('Content-Type', 'application/xml')
      .set('Idempotency-Key', 'PACS009:MSG-DUPLICATE-0001')
      .set('X-Issuer-Id', 'ISSUER_A')
      .set('X-Timestamp', timestamp)
      .set('X-Nonce', 'nonce-duplicate-0001')
      .set('X-Signature', signature)
      .send(xml)
      .expect(200);

    const second = await request(app.getHttpServer())
      .post('/issuer-b/iso/pacs009')
      .set('Content-Type', 'application/xml')
      .set('Idempotency-Key', 'PACS009:MSG-DUPLICATE-0001')
      .set('X-Issuer-Id', 'ISSUER_A')
      .set('X-Timestamp', timestamp)
      .set('X-Nonce', 'nonce-duplicate-0001')
      .set('X-Signature', signature)
      .send(xml)
      .expect(200);

    expect(second.text).toBe(first.text);
    expect(await prisma.payment.count()).toBe(1);
    expect(await prisma.isoMessage.count()).toBe(2);
    expect(await prisma.paymentEvent.count()).toBe(2);
    expect(await prisma.outboxMessage.count()).toBe(0);
  });

  function buildSampleXml(overrides?: {
    messageId?: string;
    correlationId?: string;
    instructionId?: string;
    endToEndId?: string;
  }): string {
    return pacs009Builder.build({
      messageId: overrides?.messageId ?? 'MSG-SECURITY-0001',
      correlationId: overrides?.correlationId ?? 'CORR-SECURITY-0001',
      instructionId: overrides?.instructionId ?? 'INSTR-SECURITY-0001',
      endToEndId: overrides?.endToEndId ?? 'E2E-SECURITY-0001',
      amount: '125.50',
      currency: 'EUR',
      settlementDate: '2026-04-08',
      senderIssuer: 'ISSUER_A',
      receiverIssuer: 'ISSUER_B',
      debtorName: 'Issuer A Treasury',
      creditorName: 'Issuer B Treasury',
      debtorBic: 'ISSRAESMXXX',
      creditorBic: 'ISSRBESMXXX',
      remittanceInfo: 'TFG point 3 security',
      createdAt: new Date().toISOString(),
    });
  }
});