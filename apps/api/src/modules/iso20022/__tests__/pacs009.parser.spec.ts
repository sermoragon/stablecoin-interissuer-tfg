import { Pacs009Parser } from '../parsers/pacs009.parser';

describe('Pacs009Parser', () => {
  let parser: Pacs009Parser;

  beforeEach(() => {
    parser = new Pacs009Parser();
  });

  it('should parse a valid pacs.009 XML', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08">
      <FICdtTrf>
        <GrpHdr>
          <MsgId>MSG-20260407-0001</MsgId>
          <CreDtTm>2026-04-07T19:00:00Z</CreDtTm>
          <NbOfTxs>1</NbOfTxs>
          <SttlmInf>
            <SttlmMtd>CLRG</SttlmMtd>
          </SttlmInf>
        </GrpHdr>
        <CdtTrfTxInf>
          <PmtId>
            <InstrId>INSTR-20260407-0001</InstrId>
            <EndToEndId>E2E-20260407-0001</EndToEndId>
            <TxId>CORR-20260407-0001</TxId>
          </PmtId>
          <IntrBkSttlmAmt Ccy="EUR">125.50</IntrBkSttlmAmt>
          <IntrBkSttlmDt>2026-04-07</IntrBkSttlmDt>
          <DbtrAgt>
            <FinInstnId>
              <BICFI>ISSRAESMXXX</BICFI>
            </FinInstnId>
          </DbtrAgt>
          <CdtrAgt>
            <FinInstnId>
              <BICFI>ISSRBESMXXX</BICFI>
            </FinInstnId>
          </CdtrAgt>
          <Dbtr>
            <Nm>Issuer A Treasury</Nm>
          </Dbtr>
          <Cdtr>
            <Nm>Issuer B Treasury</Nm>
          </Cdtr>
          <RmtInf>
            <Ustrd>TFG prototype payment</Ustrd>
          </RmtInf>
        </CdtTrfTxInf>
      </FICdtTrf>
    </Document>`;

    const result = parser.parse(xml);

    expect(result).toEqual({
      messageId: 'MSG-20260407-0001',
      correlationId: 'CORR-20260407-0001',
      instructionId: 'INSTR-20260407-0001',
      endToEndId: 'E2E-20260407-0001',
      amount: '125.50',
      currency: 'EUR',
      settlementDate: '2026-04-07',
      debtorName: 'Issuer A Treasury',
      creditorName: 'Issuer B Treasury',
      debtorBic: 'ISSRAESMXXX',
      creditorBic: 'ISSRBESMXXX',
      remittanceInfo: 'TFG prototype payment',
    });
  });

  it('should throw if MsgId is missing', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08">
  <FICdtTrf>
    <GrpHdr>
      <CreDtTm>2026-04-07T19:00:00Z</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf>
        <SttlmMtd>CLRG</SttlmMtd>
      </SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <InstrId>INSTR-20260407-0001</InstrId>
        <EndToEndId>E2E-20260407-0001</EndToEndId>
        <TxId>CORR-20260407-0001</TxId>
      </PmtId>
      <IntrBkSttlmAmt Ccy="EUR">125.50</IntrBkSttlmAmt>
      <IntrBkSttlmDt>2026-04-07</IntrBkSttlmDt>
      <DbtrAgt>
        <FinInstnId>
          <BICFI>ISSRAESMXXX</BICFI>
        </FinInstnId>
      </DbtrAgt>
      <CdtrAgt>
        <FinInstnId>
          <BICFI>ISSRBESMXXX</BICFI>
        </FinInstnId>
      </CdtrAgt>
      <Dbtr>
        <Nm>Issuer A Treasury</Nm>
      </Dbtr>
      <Cdtr>
        <Nm>Issuer B Treasury</Nm>
      </Cdtr>
    </CdtTrfTxInf>
  </FICdtTrf>
</Document>`;

    expect(() => parser.parse(xml)).toThrow(
      'Missing required field: GrpHdr.MsgId',
    );
  });
});