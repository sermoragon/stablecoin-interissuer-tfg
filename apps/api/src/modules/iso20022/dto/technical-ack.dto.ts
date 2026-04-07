export type TechnicalAck = {
  originalMessageId: string;
  originalCorrelationId: string;
  status: 'ACCEPTED' | 'REJECTED';
  timestamp: string;
};