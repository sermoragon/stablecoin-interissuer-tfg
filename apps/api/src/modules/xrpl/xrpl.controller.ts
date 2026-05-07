import { Body, Controller, Get, Post } from '@nestjs/common';
import { SettleXrpPaymentDto } from './dto/settle-xrp-payment.dto';
import { XrplClientService } from './xrpl-client.service';
import { XrplSettlementService } from './xrpl-settlement.service';
import { SettleCrossCurrencyPaymentDto } from './dto/settle-cross-currency-payment.dto';

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

  @Post('settlements/cross-currency')
  async settleCrossCurrencyPayment(@Body() body: SettleCrossCurrencyPaymentDto) {
    return this.xrplSettlementService.settleCrossCurrencyPayment(body);
  }
}