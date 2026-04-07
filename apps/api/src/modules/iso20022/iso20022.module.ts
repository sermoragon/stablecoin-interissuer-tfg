import { Module } from '@nestjs/common';
import { Pacs009Builder } from './builders/pacs009.builder';
import { Pacs009Parser } from './parsers/pacs009.parser';
import { Pacs009ToPaymentMapper } from './mappers/pacs009-to-payment.mapper';

@Module({
  providers: [Pacs009Builder, Pacs009Parser, Pacs009ToPaymentMapper],
  exports: [Pacs009Builder, Pacs009Parser, Pacs009ToPaymentMapper],
})
export class Iso20022Module {}