export type TechnicalAck = {
  originalBusinessMsgId: string;
  originalCorrelationId: string;
  status: 'ACCEPTED' | 'REJECTED';
  timestamp: string;
};