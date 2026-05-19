import { Test, TestingModule } from '@nestjs/testing';
import { PaymentStatus } from '@prisma/client';
import { OrchestrationController } from '../orchestration.controller';
import { PaymentOrchestratorService } from '../payment-orchestrator.service';

describe('OrchestrationController', () => {
  const paymentId = 'payment-1';

  let controller: OrchestrationController;
  let paymentOrchestratorService: any;

  beforeEach(async () => {
    paymentOrchestratorService = {
      settlePaymentWithXrpl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrchestrationController],
      providers: [
        {
          provide: PaymentOrchestratorService,
          useValue: paymentOrchestratorService,
        },
      ],
    }).compile();

    controller = module.get<OrchestrationController>(OrchestrationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates XRPL settlement orchestration to PaymentOrchestratorService', async () => {
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

    const result = await controller.settlePaymentWithXrpl(paymentId, {
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

    expect(
      paymentOrchestratorService.settlePaymentWithXrpl,
    ).toHaveBeenCalledWith({
      paymentId,
      destinationAmount: '2',
      sendMax: '2.2',
    });
  });

  it('passes only the paymentId when optional XRPL amounts are not provided', async () => {
    paymentOrchestratorService.settlePaymentWithXrpl.mockResolvedValue({
      paymentId,
      status: PaymentStatus.SETTLED,
    });

    await controller.settlePaymentWithXrpl(paymentId, {});

    expect(
      paymentOrchestratorService.settlePaymentWithXrpl,
    ).toHaveBeenCalledWith({
      paymentId,
      destinationAmount: undefined,
      sendMax: undefined,
    });
  });
});