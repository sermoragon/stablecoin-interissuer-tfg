import { Body, Controller, Get, Post } from '@nestjs/common';
import { SettleXrpPaymentDto } from './dto/settle-xrp-payment.dto';
import { XrplClientService } from './xrpl-client.service';
import { XrplSettlementService } from './xrpl-settlement.service';

@Controller('xrpl')
export class XrplController {
  constructor(
    private readonly xrplClientService: XrplClientService,
    private readonly xrplSettlementService: XrplSettlementService,
  ) {}

  @Get('health')
  async health() {
    return this.xrplClientService.getHealth();
  }

  @Post('settlements/xrp')
  async settleXrpPayment(@Body() body: SettleXrpPaymentDto) {
    return this.xrplSettlementService.settleXrpPayment(body);
  }
}