import { Injectable } from '@nestjs/common';
import { PACS_009_NS } from '../constants/iso.constants';
import { BuildPacs009Input } from '../dto/build-pacs009.input';

@Injectable()
export class Pacs009Builder {
  build(input: BuildPacs009Input): string {
    const remittanceBlock = input.remittanceInfo
      ? `
      <RmtInf>
        <Ustrd>${this.escapeXml(input.remittanceInfo)}</Ustrd>
      </RmtInf>`
      : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
    <Document xmlns="${PACS_009_NS}">
      <FICdtTrf>
        <GrpHdr>
          <MsgId>${this.escapeXml(input.messageId)}</MsgId>
          <CreDtTm>${this.escapeXml(input.createdAt)}</CreDtTm>
          <NbOfTxs>1</NbOfTxs>
          <SttlmInf>
            <SttlmMtd>CLRG</SttlmMtd>
          </SttlmInf>
        </GrpHdr>
        <CdtTrfTxInf>
          <PmtId>
            <InstrId>${this.escapeXml(input.instructionId)}</InstrId>
            <EndToEndId>${this.escapeXml(input.endToEndId)}</EndToEndId>
            <TxId>${this.escapeXml(input.correlationId)}</TxId>
          </PmtId>
          <IntrBkSttlmAmt Ccy="${this.escapeXml(input.currency)}">${this.escapeXml(input.amount)}</IntrBkSttlmAmt>
          <IntrBkSttlmDt>${this.escapeXml(input.settlementDate)}</IntrBkSttlmDt>
          <DbtrAgt>
            <FinInstnId>
              <BICFI>${this.escapeXml(input.debtorBic)}</BICFI>
            </FinInstnId>
          </DbtrAgt>
          <CdtrAgt>
            <FinInstnId>
              <BICFI>${this.escapeXml(input.creditorBic)}</BICFI>
            </FinInstnId>
          </CdtrAgt>
          <Dbtr>
            <Nm>${this.escapeXml(input.debtorName)}</Nm>
          </Dbtr>
          <Cdtr>
            <Nm>${this.escapeXml(input.creditorName)}</Nm>
          </Cdtr>${remittanceBlock}
        </CdtTrfTxInf>
      </FICdtTrf>
    </Document>`;
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