import { Body, Controller, Post } from '@nestjs/common';
import { CreateSimulatedPaymentDto } from './dto/create-simulated-payment.dto';
import { IssuerAPaymentsService } from './issuer-a-payments.service';

@Controller('issuer-a/payments')
export class IssuerAPaymentsController {
  constructor(
    private readonly issuerAPaymentsService: IssuerAPaymentsService,
  ) {}

  @Post('simulate')
  async simulatePayment(@Body() body: CreateSimulatedPaymentDto) {
    return this.issuerAPaymentsService.simulatePayment(body);
  }
}