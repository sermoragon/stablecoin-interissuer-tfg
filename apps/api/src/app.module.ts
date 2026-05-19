import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { IssuerAModule } from './modules/issuer-a/issuer-a.module';
import { IssuerBModule } from './modules/issuer-b/issuer-b.module';
import { XrplModule } from './modules/xrpl/xrpl.module';
import { OrchestrationModule } from './modules/orchestration/orchestration.module';

@Module({
  imports: [
    HealthModule,
    IssuerAModule,
    IssuerBModule,
    XrplModule,
    OrchestrationModule,
  ],
})
export class AppModule {}