import { BadRequestException, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { TechnicalAck } from '../dto/technical-ack.dto';

@Injectable()
export class TechnicalAckParser {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
  });

  parse(xml: string): TechnicalAck {
    try {
      const parsed = this.parser.parse(xml);
      const techAck = parsed?.TechAck;

      const originalMessageId = this.getRequiredString(
        techAck?.OriginalMessageId,
        'TechAck.OriginalMessageId',
      );

      const originalCorrelationId = this.getRequiredString(
        techAck?.OriginalCorrelationId,
        'TechAck.OriginalCorrelationId',
      );

      const status = this.getRequiredString(techAck?.Status, 'TechAck.Status');

      if (status !== 'ACCEPTED' && status !== 'REJECTED') {
        throw new BadRequestException(
          'Invalid TechAck.Status. Expected ACCEPTED or REJECTED',
        );
      }

      const timestamp = this.getRequiredString(
        techAck?.Timestamp,
        'TechAck.Timestamp',
      );

      return {
        originalMessageId,
        originalCorrelationId,
        status,
        timestamp,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Invalid technical ACK XML');
    }
  }

  private getRequiredString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new BadRequestException(`Missing required field: ${fieldName}`);
    }

    return value.trim();
  }
}