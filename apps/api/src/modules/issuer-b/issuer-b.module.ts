import { Module } from '@nestjs/common';
import { Iso20022Module } from '../iso20022/iso20022.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { IssuerBIsoController } from './issuer-b-iso.controller';
import { IssuerBIsoService } from './issuer-b-iso.service';

@Module({
  imports: [PersistenceModule, Iso20022Module],
  controllers: [IssuerBIsoController],
  providers: [IssuerBIsoService],
})
export class IssuerBModule {}