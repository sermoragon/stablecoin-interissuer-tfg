export type TechnicalAck = {
  messageId: string;  
  originalMessageId: string;
  originalCorrelationId: string;
  status: 'ACCEPTED' | 'REJECTED';
  timestamp: string;
};