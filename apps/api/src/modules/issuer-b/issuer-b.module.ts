import { Module } from '@nestjs/common';
import { IssuerBController } from './issuer-b.controller';
import { IssuerBService } from './issuer-b.service';

@Module({
  controllers: [IssuerBController],
  providers: [IssuerBService]
})
export class IssuerBModule {}
