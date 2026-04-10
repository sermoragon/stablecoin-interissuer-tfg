import { TechnicalAckBuilder } from '../builders/technical-ack.builder';

describe('TechnicalAckBuilder', () => {
  let builder: TechnicalAckBuilder;

  beforeEach(() => {
    builder = new TechnicalAckBuilder();
  });

  it('should build a valid technical ACK XML', () => {
    const xml = builder.build({
      messageId: 'ACK-MSG-20260407-0001',
      originalMessageId: 'MSG-20260407-0001',
      originalCorrelationId: 'CORR-20260407-0001',
      status: 'ACCEPTED',
      timestamp: '2026-04-07T19:00:02Z',
    });

    expect(xml).toContain('<MessageId>ACK-MSG-20260407-0001</MessageId>');
    expect(xml).toContain('<TechAck>');
    expect(xml).toContain(
      '<OriginalMessageId>MSG-20260407-0001</OriginalMessageId>',
    );
    expect(xml).toContain(
      '<OriginalCorrelationId>CORR-20260407-0001</OriginalCorrelationId>',
    );
    expect(xml).toContain('<Status>ACCEPTED</Status>');
    expect(xml).toContain('<Timestamp>2026-04-07T19:00:02Z</Timestamp>');
  });
});