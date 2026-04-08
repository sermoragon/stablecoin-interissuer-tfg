import { Module } from '@nestjs/common';
import { Iso20022Module } from '../iso20022/iso20022.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { IssuerAPaymentsController } from './issuer-a-payments.controller';
import { IssuerAPaymentsService } from './issuer-a-payments.service';

@Module({
  imports: [PersistenceModule, Iso20022Module],
  controllers: [IssuerAPaymentsController],
  providers: [IssuerAPaymentsService],
})
export class IssuerAModule {}