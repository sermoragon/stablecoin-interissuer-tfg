import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'stablecoin-interissuer-api',
      timestamp: new Date().toISOString(),
    };
  }
}