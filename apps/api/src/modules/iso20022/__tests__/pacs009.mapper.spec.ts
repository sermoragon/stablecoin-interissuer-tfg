import { Pacs009ToPaymentMapper } from '../mappers/pacs009-to-payment.mapper';

describe('Pacs009ToPaymentMapper', () => {
  let mapper: Pacs009ToPaymentMapper;

  beforeEach(() => {
    mapper = new Pacs009ToPaymentMapper();
  });

  it('should map parsed pacs.009 data to internal payment shape', () => {
    const result = mapper.map({
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

    expect(result).toEqual({
      correlationId: 'CORR-20260407-0001',
      instructionId: 'INSTR-20260407-0001',
      endToEndId: 'E2E-20260407-0001',
      amount: '125.50',
      currency: 'EUR',
      debtorName: 'Issuer A Treasury',
      creditorName: 'Issuer B Treasury',
      debtorBic: 'ISSRAESMXXX',
      creditorBic: 'ISSRBESMXXX',
      remittanceInfo: 'TFG prototype payment',
      status: 'RECEIVED',
    });
  });
});