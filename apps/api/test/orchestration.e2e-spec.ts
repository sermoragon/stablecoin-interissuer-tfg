import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PaymentStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PaymentOrchestratorService } from '../src/modules/orchestration/payment-orchestrator.service';

describe('Orchestration E2E', () => {
  const paymentId = 'payment-1';

  let app: INestApplication;
  let paymentOrchestratorService: any;

  beforeAll(async () => {
    paymentOrchestratorService = {
      settlePaymentWithXrpl: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PaymentOrchestratorService)
      .useValue(paymentOrchestratorService)
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
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('POST /orchestration/payments/:paymentId/settle-xrpl delegates to the orchestrator without calling real XRPL', async () => {
    paymentOrchestratorService.settlePaymentWithXrpl.mockResolvedValue({
      paymentId,
      status: PaymentStatus.SETTLED,
      xrpl: {
        alreadySettled: false,
        txHash: 'ABC123',
        engineResult: 'tesSUCCESS',
        validated: true,
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/orchestration/payments/${paymentId}/settle-xrpl`)
      .send({
        destinationAmount: '2',
        sendMax: '2.2',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      paymentId,
      status: PaymentStatus.SETTLED,
      xrpl: {
        txHash: 'ABC123',
        engineResult: 'tesSUCCESS',
        validated: true,
      },
    });

    expect(
      paymentOrchestratorService.settlePaymentWithXrpl,
    ).toHaveBeenCalledWith({
      paymentId,
      destinationAmount: '2',
      sendMax: '2.2',
    });
  });

  it('rejects unknown body fields before reaching the orchestrator', async () => {
    await request(app.getHttpServer())
      .post(`/orchestration/payments/${paymentId}/settle-xrpl`)
      .send({
        destinationAmount: '2',
        unexpected: 'not-allowed',
      })
      .expect(400);

    expect(
      paymentOrchestratorService.settlePaymentWithXrpl,
    ).not.toHaveBeenCalled();
  });
});