import { TechnicalAckParser } from '../parsers/technical-ack.parser';

describe('TechnicalAckParser', () => {
  let parser: TechnicalAckParser;

  beforeEach(() => {
    parser = new TechnicalAckParser();
  });

  it('should parse a valid technical ACK XML', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <TechAck>
      <MessageId>ACK-MSG-20260407-0001</MessageId>
      <OriginalMessageId>MSG-20260407-0001</OriginalMessageId>
      <OriginalCorrelationId>CORR-20260407-0001</OriginalCorrelationId>
      <Status>ACCEPTED</Status>
      <Timestamp>2026-04-07T19:00:02Z</Timestamp>
    </TechAck>`;

    const result = parser.parse(xml);

    expect(result).toEqual({
      messageId: 'ACK-MSG-20260407-0001',
      originalMessageId: 'MSG-20260407-0001',
      originalCorrelationId: 'CORR-20260407-0001',
      status: 'ACCEPTED',
      timestamp: '2026-04-07T19:00:02Z',
    });
  });

  it('should throw if Status is invalid', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <TechAck>
      <MessageId>ACK-MSG-20260407-0001</MessageId>
      <OriginalMessageId>MSG-20260407-0001</OriginalMessageId>
      <OriginalCorrelationId>CORR-20260407-0001</OriginalCorrelationId>
      <Status>OK</Status>
      <Timestamp>2026-04-07T19:00:02Z</Timestamp>
    </TechAck>`;

    expect(() => parser.parse(xml)).toThrow(
      'Invalid TechAck.Status. Expected ACCEPTED or REJECTED',
    );
  });
});