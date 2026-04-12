import { Module } from '@nestjs/common';
import { Iso20022Module } from '../iso20022/iso20022.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { IssuerAPaymentsController } from './issuer-a-payments.controller';
import { IssuerAPaymentsService } from './issuer-a-payments.service';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [
    PersistenceModule,
    Iso20022Module,
    IdempotencyModule,
    OutboxModule,
  ],
  controllers: [IssuerAPaymentsController],
  providers: [IssuerAPaymentsService],
})
export class IssuerAModule {}