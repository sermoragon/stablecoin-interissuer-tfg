import { Injectable } from '@nestjs/common';
import { TechnicalAck } from '../dto/technical-ack.dto';

@Injectable()
export class TechnicalAckBuilder {
  build(input: TechnicalAck): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<TechAck>
  <OriginalMessageId>${this.escapeXml(input.originalMessageId)}</OriginalMessageId>
  <OriginalCorrelationId>${this.escapeXml(input.originalCorrelationId)}</OriginalCorrelationId>
  <Status>${this.escapeXml(input.status)}</Status>
  <Timestamp>${this.escapeXml(input.timestamp)}</Timestamp>
</TechAck>`;
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}