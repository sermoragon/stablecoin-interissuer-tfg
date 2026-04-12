import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
} from '@nestjs/common';
import { CreateSimulatedPaymentDto } from './dto/create-simulated-payment.dto';
import { IssuerAPaymentsService } from './issuer-a-payments.service';

@Controller('issuer-a/payments')
export class IssuerAPaymentsController {
  constructor(
    private readonly issuerAPaymentsService: IssuerAPaymentsService,
  ) {}

  @Post('simulate')
  async simulatePayment(
    @Body() body: CreateSimulatedPaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    return this.issuerAPaymentsService.simulatePayment(body, idempotencyKey);
  }
}