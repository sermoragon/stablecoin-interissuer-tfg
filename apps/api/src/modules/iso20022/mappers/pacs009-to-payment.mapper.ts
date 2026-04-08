import { Injectable } from '@nestjs/common';
import { ParsedPacs009 } from '../dto/parsed-pacs009.dto';

@Injectable()
export class Pacs009ToPaymentMapper {
  map(parsed: ParsedPacs009) {
    return {
      correlationId: parsed.correlationId,
      instructionId: parsed.instructionId,
      endToEndId: parsed.endToEndId,
      amount: parsed.amount,
      currency: parsed.currency,
      debtorName: parsed.debtorName,
      creditorName: parsed.creditorName,
      debtorBic: parsed.debtorBic,
      creditorBic: parsed.creditorBic,
      remittanceInfo: parsed.remittanceInfo,
      status: 'ISO_INBOUND_RECEIVED',
    };
  }
}