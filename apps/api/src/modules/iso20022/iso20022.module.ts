import { Module } from '@nestjs/common';
import { Pacs009Builder } from './builders/pacs009.builder';
import { TechnicalAckBuilder } from './builders/technical-ack.builder';
import { Pacs009ToPaymentMapper } from './mappers/pacs009-to-payment.mapper';
import { Pacs009Parser } from './parsers/pacs009.parser';
import { TechnicalAckParser } from './parsers/technical-ack.parser';

@Module({
  providers: [
    Pacs009Builder,
    Pacs009Parser,
    Pacs009ToPaymentMapper,
    TechnicalAckBuilder,
    TechnicalAckParser,
  ],
  exports: [
    Pacs009Builder,
    Pacs009Parser,
    Pacs009ToPaymentMapper,
    TechnicalAckBuilder,
    TechnicalAckParser,
  ],
})
export class Iso20022Module {}