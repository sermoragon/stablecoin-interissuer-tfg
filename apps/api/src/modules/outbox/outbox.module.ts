import { Module } from '@nestjs/common';
import { Iso20022Module } from '../iso20022/iso20022.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { SecurityModule } from '../security/security.module';
import { OutboxDispatcherService } from './outbox-dispatcher.service';
import { OutboxService } from './outbox.service';

@Module({
  imports: [PersistenceModule, Iso20022Module, SecurityModule],
  providers: [OutboxService, OutboxDispatcherService],
  exports: [OutboxService, OutboxDispatcherService],
})
export class OutboxModule {}