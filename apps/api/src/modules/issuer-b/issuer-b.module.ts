import { Module } from '@nestjs/common';
import { Iso20022Module } from '../iso20022/iso20022.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { IssuerBIsoController } from './issuer-b-iso.controller';
import { IssuerBIsoService } from './issuer-b-iso.service';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    PersistenceModule,
    Iso20022Module,
    IdempotencyModule,
    SecurityModule,
  ],
  controllers: [IssuerBIsoController],
  providers: [IssuerBIsoService],
})
export class IssuerBModule {}