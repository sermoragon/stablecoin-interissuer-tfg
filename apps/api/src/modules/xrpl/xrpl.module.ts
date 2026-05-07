import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { XrplController } from './xrpl.controller';
import { XrplClientService } from './xrpl-client.service';
import { XrplSettlementService } from './xrpl-settlement.service';

@Module({
  imports: [PersistenceModule],
  controllers: [XrplController],
  providers: [XrplClientService, XrplSettlementService],
  exports: [XrplClientService, XrplSettlementService],
})
export class XrplModule {}