export type BuildPacs009Input = {
  messageId: string;
  correlationId: string;
  instructionId: string;
  endToEndId: string;
  amount: string;
  currency: string;
  settlementDate: string;
  senderIssuer: 'ISSUER_A' | 'ISSUER_B';
  receiverIssuer: 'ISSUER_A' | 'ISSUER_B';
  debtorName: string;
  creditorName: string;
  debtorBic: string;
  creditorBic: string;
  remittanceInfo?: string;
  createdAt: string;
};