import { HmacService } from '../hmac.service';

describe('HmacService', () => {
  let service: HmacService;

  beforeEach(() => {
    process.env.ISSUER_A_TO_ISSUER_B_HMAC_SECRET = 'test-secret';
    process.env.HMAC_MAX_CLOCK_SKEW_SECONDS = '300';
    service = new HmacService();
  });

  it('should sign and verify a valid request', () => {
    const timestamp = Date.now().toString();

    const signature = service.signRequest({
      issuerId: 'ISSUER_A',
      idempotencyKey: 'PACS009:MSG-1',
      timestamp,
      nonce: 'nonce-1',
      method: 'POST',
      path: '/issuer-b/iso/pacs009',
      body: '<xml>ok</xml>',
    });

    expect(() =>
      service.verifyRequest({
        issuerId: 'ISSUER_A',
        idempotencyKey: 'PACS009:MSG-1',
        timestamp,
        nonce: 'nonce-1',
        method: 'POST',
        path: '/issuer-b/iso/pacs009',
        body: '<xml>ok</xml>',
        signature,
      }),
    ).not.toThrow();
  });

  it('should reject an invalid signature', () => {
    const timestamp = Date.now().toString();

    expect(() =>
      service.verifyRequest({
        issuerId: 'ISSUER_A',
        idempotencyKey: 'PACS009:MSG-1',
        timestamp,
        nonce: 'nonce-1',
        method: 'POST',
        path: '/issuer-b/iso/pacs009',
        body: '<xml>ok</xml>',
        signature: 'bad-signature',
      }),
    ).toThrow('Invalid signature');
  });
});