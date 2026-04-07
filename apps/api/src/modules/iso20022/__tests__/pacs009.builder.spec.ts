import { Pacs009Builder } from '../builders/pacs009.builder';

describe('Pacs009Builder', () => {
  let builder: Pacs009Builder;

  beforeEach(() => {
    builder = new Pacs009Builder();
  });

  it('should build a valid pacs.009 XML', () => {
    const xml = builder.build({
      messageId: 'MSG-20260407-0001',
      correlationId: 'CORR-20260407-0001',
      instructionId: 'INSTR-20260407-0001',
      endToEndId: 'E2E-20260407-0001',
      amount: '125.50',
      currency: 'EUR',
      settlementDate: '2026-04-07',
      senderIssuer: 'ISSUER_A',
      receiverIssuer: 'ISSUER_B',
      debtorName: 'Issuer A Treasury',
      creditorName: 'Issuer B Treasury',
      debtorBic: 'ISSRAESMXXX',
      creditorBic: 'ISSRBESMXXX',
      remittanceInfo: 'TFG prototype payment',
      createdAt: '2026-04-07T19:00:00Z',
    });

    expect(xml).toContain(
      '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08">',
    );
    expect(xml).toContain('<MsgId>MSG-20260407-0001</MsgId>');
    expect(xml).toContain('<InstrId>INSTR-20260407-0001</InstrId>');
    expect(xml).toContain('<EndToEndId>E2E-20260407-0001</EndToEndId>');
    expect(xml).toContain('<TxId>CORR-20260407-0001</TxId>');
    expect(xml).toContain('<IntrBkSttlmAmt Ccy="EUR">125.50</IntrBkSttlmAmt>');
    expect(xml).toContain('<IntrBkSttlmDt>2026-04-07</IntrBkSttlmDt>');
    expect(xml).toContain('<BICFI>ISSRAESMXXX</BICFI>');
    expect(xml).toContain('<BICFI>ISSRBESMXXX</BICFI>');
    expect(xml).toContain('<Nm>Issuer A Treasury</Nm>');
    expect(xml).toContain('<Nm>Issuer B Treasury</Nm>');
    expect(xml).toContain('<Ustrd>TFG prototype payment</Ustrd>');
  });

  it('should build pacs.009 XML without remittance block when remittanceInfo is not provided', () => {
    const xml = builder.build({
      messageId: 'MSG-20260407-0002',
      correlationId: 'CORR-20260407-0002',
      instructionId: 'INSTR-20260407-0002',
      endToEndId: 'E2E-20260407-0002',
      amount: '50.00',
      currency: 'EUR',
      settlementDate: '2026-04-07',
      senderIssuer: 'ISSUER_A',
      receiverIssuer: 'ISSUER_B',
      debtorName: 'Issuer A Treasury',
      creditorName: 'Issuer B Treasury',
      debtorBic: 'ISSRAESMXXX',
      creditorBic: 'ISSRBESMXXX',
      createdAt: '2026-04-07T19:05:00Z',
    });

    expect(xml).not.toContain('<RmtInf>');
    expect(xml).not.toContain('<Ustrd>');
  });
});