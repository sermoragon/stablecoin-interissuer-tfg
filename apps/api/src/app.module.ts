import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { IssuerAModule } from './modules/issuer-a/issuer-a.module';
import { IssuerBModule } from './modules/issuer-b/issuer-b.module';

@Module({
  imports: [HealthModule, IssuerAModule, IssuerBModule],
})
export class AppModule {}