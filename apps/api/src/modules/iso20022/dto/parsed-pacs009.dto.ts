export type ParsedPacs009 = {
  messageId: string;
  correlationId: string;
  instructionId: string;
  endToEndId: string;
  amount: string;
  currency: string;
  settlementDate: string;
  debtorName: string;
  creditorName: string;
  debtorBic: string;
  creditorBic: string;
  remittanceInfo?: string;
};