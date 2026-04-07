import { BadRequestException, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { ParsedPacs009 } from '../dto/parsed-pacs009.dto';

@Injectable()
export class Pacs009Parser {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
  });

  parse(xml: string): ParsedPacs009 {
    try {
      const parsed = this.parser.parse(xml);

      const documentNode = parsed?.Document;
      const fiCdtTrf = documentNode?.FICdtTrf;
      const grpHdr = fiCdtTrf?.GrpHdr;
      const tx = fiCdtTrf?.CdtTrfTxInf;
      const pmtId = tx?.PmtId;

      const amountNode = tx?.IntrBkSttlmAmt;

      const messageId = this.getRequiredString(grpHdr?.MsgId, 'GrpHdr.MsgId');
      const instructionId = this.getRequiredString(
        pmtId?.InstrId,
        'CdtTrfTxInf.PmtId.InstrId',
      );
      const endToEndId = this.getRequiredString(
        pmtId?.EndToEndId,
        'CdtTrfTxInf.PmtId.EndToEndId',
      );
      const correlationId = this.getRequiredString(
        pmtId?.TxId,
        'CdtTrfTxInf.PmtId.TxId',
      );

      const amount = this.getRequiredString(
        amountNode?.['#text'],
        'CdtTrfTxInf.IntrBkSttlmAmt',
      );
      const currency = this.getRequiredString(
        amountNode?.Ccy,
        'CdtTrfTxInf.IntrBkSttlmAmt@Ccy',
      );

      const settlementDate = this.getRequiredString(
        tx?.IntrBkSttlmDt,
        'CdtTrfTxInf.IntrBkSttlmDt',
      );

      const debtorBic = this.getRequiredString(
        tx?.DbtrAgt?.FinInstnId?.BICFI,
        'CdtTrfTxInf.DbtrAgt.FinInstnId.BICFI',
      );
      const creditorBic = this.getRequiredString(
        tx?.CdtrAgt?.FinInstnId?.BICFI,
        'CdtTrfTxInf.CdtrAgt.FinInstnId.BICFI',
      );

      const debtorName = this.getRequiredString(
        tx?.Dbtr?.Nm,
        'CdtTrfTxInf.Dbtr.Nm',
      );
      const creditorName = this.getRequiredString(
        tx?.Cdtr?.Nm,
        'CdtTrfTxInf.Cdtr.Nm',
      );

      const remittanceInfo = this.getOptionalString(tx?.RmtInf?.Ustrd);

      return {
        messageId,
        correlationId,
        instructionId,
        endToEndId,
        amount,
        currency,
        settlementDate,
        debtorName,
        creditorName,
        debtorBic,
        creditorBic,
        remittanceInfo,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Invalid pacs.009 XML');
    }
  }

  private getRequiredString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new BadRequestException(`Missing required field: ${fieldName}`);
    }

    return value.trim();
  }

  private getOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }
}