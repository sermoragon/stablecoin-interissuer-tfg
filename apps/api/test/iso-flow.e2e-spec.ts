import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/persistence/prisma.service';
import * as express from 'express';

describe('ISO Flow E2E', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    beforeAll(async () => {
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

    await app.listen(3000);

    prisma = app.get(PrismaService);
    });

    beforeEach(async () => {
        await prisma.isoMessage.deleteMany();
        await prisma.paymentEvent.deleteMany();
        await prisma.payment.deleteMany();
    });

    afterAll(async () => {
        await prisma.isoMessage.deleteMany();
        await prisma.paymentEvent.deleteMany();
        await prisma.payment.deleteMany();
        await app.close();
    });

    it('should execute the simulated A -> B ISO flow and persist the full trace', async () => {
    const payload = {
      instructionId: 'INSTR-E2E-0001',
      endToEndId: 'E2E-E2E-0001',
      correlationId: 'CORR-E2E-0001',
      amount: '125.50',
      currency: 'EUR',
      settlementDate: '2026-04-08',
      debtorName: 'Issuer A Treasury',
      creditorName: 'Issuer B Treasury',
      debtorBic: 'ISSRAESMXXX',
      creditorBic: 'ISSRBESMXXX',
      remittanceInfo: 'TFG e2e flow',
    };

    const response = await request(app.getHttpServer())
      .post('/issuer-a/payments/simulate')
      .send(payload)
      .expect(201);

    expect(response.body).toEqual({
      paymentId: expect.any(String),
      messageId: 'MSG-INSTR-E2E-0001',
      correlationId: 'CORR-E2E-0001',
      ackStatus: 'ACCEPTED',
    });

    const payment = await prisma.payment.findUnique({
      where: { correlationId: 'CORR-E2E-0001' },
    });

    expect(payment).toBeTruthy();
    expect(payment?.instructionId).toBe('INSTR-E2E-0001');
    expect(payment?.status).toBe('ISO_ACK_ACCEPTED');

    const messages = await prisma.isoMessage.findMany({
      where: { paymentId: payment!.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(messages).toHaveLength(4);
    expect(messages.map((m) => [m.direction, m.messageType])).toEqual([
      ['OUTBOUND', 'pacs.009'],
      ['INBOUND', 'pacs.009'],
      ['OUTBOUND', 'tech_ack'],
      ['INBOUND', 'tech_ack'],
    ]);

    const events = await prisma.paymentEvent.findMany({
      where: { paymentId: payment!.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(events).toHaveLength(4);
    expect(events.map((e) => e.type)).toEqual([
      'ISO_PACS009_BUILT',
      'ISO_PACS009_RECEIVED',
      'ISO_TECH_ACK_SENT',
      'ISO_TECH_ACK_RECEIVED',
    ]);
  });
});