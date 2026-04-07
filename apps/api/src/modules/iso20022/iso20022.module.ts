import { Module } from '@nestjs/common';
import { Pacs009Builder } from './builders/pacs009.builder';
import { Pacs009Parser } from './parsers/pacs009.parser';

@Module({
  providers: [Pacs009Builder, Pacs009Parser],
  exports: [Pacs009Builder, Pacs009Parser],
})
export class Iso20022Module {}