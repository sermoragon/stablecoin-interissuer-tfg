import { Module } from '@nestjs/common';
import { IssuerAController } from './issuer-a.controller';
import { IssuerAService } from './issuer-a.service';

@Module({
  controllers: [IssuerAController],
  providers: [IssuerAService]
})
export class IssuerAModule {}
