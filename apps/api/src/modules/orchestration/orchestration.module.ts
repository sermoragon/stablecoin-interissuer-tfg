import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { XrplModule } from '../xrpl/xrpl.module';
import { OrchestrationController } from './orchestration.controller';
import { PaymentOrchestratorService } from './payment-orchestrator.service';
import { PaymentStateMachineService } from './payment-state-machine.service';

@Module({
  imports: [PersistenceModule, XrplModule],
  controllers: [OrchestrationController],
  providers: [PaymentStateMachineService, PaymentOrchestratorService],
  exports: [PaymentStateMachineService, PaymentOrchestratorService],
})
export class OrchestrationModule {}