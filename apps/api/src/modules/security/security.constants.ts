export const IDEMPOTENCY_SCOPES = {
  ISSUER_A_SIMULATE_PAYMENT: 'ISSUER_A_SIMULATE_PAYMENT',
  ISSUER_B_INBOUND_PACS009: 'ISSUER_B_INBOUND_PACS009',
} as const;

export const ISSUER_IDS = {
  ISSUER_A: 'ISSUER_A',
  ISSUER_B: 'ISSUER_B',
} as const;

export const HMAC_PATHS = {
  ISSUER_B_PACS009: '/issuer-b/iso/pacs009',
} as const;