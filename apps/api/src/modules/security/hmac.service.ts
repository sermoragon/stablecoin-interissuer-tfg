import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { sha256Hex } from '../idempotency/request-hash.util';

export interface SignedRequestInput {
  issuerId: string;
  idempotencyKey: string;
  timestamp: string;
  nonce: string;
  method: string;
  path: string;
  body: string;
}

@Injectable()
export class HmacService {
  signRequest(input: SignedRequestInput): string {
    return createHmac('sha256', this.getSharedSecret())
      .update(this.buildCanonicalString(input), 'utf8')
      .digest('hex');
  }

  verifyRequest(input: SignedRequestInput & { signature: string }): void {
    this.assertFreshTimestamp(input.timestamp);

    const expected = this.signRequest(input);

    const providedBuffer = Buffer.from(input.signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    if (providedBuffer.length !== expectedBuffer.length) {
      throw new UnauthorizedException('Invalid signature');
    }

    if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw new UnauthorizedException('Invalid signature');
    }
  }

  private buildCanonicalString(input: SignedRequestInput): string {
    const bodyHash = sha256Hex(input.body);

    return [
      input.issuerId,
      input.idempotencyKey,
      input.timestamp,
      input.nonce,
      input.method.toUpperCase(),
      input.path,
      bodyHash,
    ].join('\n');
  }

  private assertFreshTimestamp(timestamp: string): void {
    const parsed = Number(timestamp);

    if (!Number.isFinite(parsed)) {
      throw new UnauthorizedException('Invalid timestamp');
    }

    const driftMs = Math.abs(Date.now() - parsed);

    if (driftMs > this.getAllowedClockSkewMs()) {
      throw new UnauthorizedException('Timestamp outside allowed window');
    }
  }

  private getSharedSecret(): string {
    const secret = process.env.ISSUER_A_TO_ISSUER_B_HMAC_SECRET;

    if (!secret) {
      throw new InternalServerErrorException(
        'ISSUER_A_TO_ISSUER_B_HMAC_SECRET is not configured',
      );
    }

    return secret;
  }

  private getAllowedClockSkewMs(): number {
    const rawValue = process.env.HMAC_MAX_CLOCK_SKEW_SECONDS ?? '300';
    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new InternalServerErrorException(
        'HMAC_MAX_CLOCK_SKEW_SECONDS must be a positive number',
      );
    }

    return parsed * 1000;
  }
}