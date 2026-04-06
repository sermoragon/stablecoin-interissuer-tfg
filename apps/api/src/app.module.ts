import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './modules/health/health.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { IssuerAModule } from './modules/issuer-a/issuer-a.module';
import { IssuerBModule } from './modules/issuer-b/issuer-b.module';
import { PersistenceModule } from './modules/persistence/persistence.module';
import { ObservabilityModule } from './modules/observability/observability.module';

@Module({
  imports: [HealthModule, PaymentsModule, IssuerAModule, IssuerBModule, PersistenceModule, ObservabilityModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
