import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { SettlePaymentWithXrplDto } from './dto/settle-payment-with-xrpl.dto';
import { PaymentOrchestratorService } from './payment-orchestrator.service';

@Controller('orchestration')
export class OrchestrationController {
  constructor(
    private readonly paymentOrchestratorService: PaymentOrchestratorService,
  ) {}

  @Post('payments/:paymentId/settle-xrpl')
  @HttpCode(200)
  async settlePaymentWithXrpl(
    @Param('paymentId') paymentId: string,
    @Body() body: SettlePaymentWithXrplDto = {},
  ) {
    return this.paymentOrchestratorService.settlePaymentWithXrpl({
      paymentId,
      destinationAmount: body.destinationAmount,
      sendMax: body.sendMax,
    });
  }
}