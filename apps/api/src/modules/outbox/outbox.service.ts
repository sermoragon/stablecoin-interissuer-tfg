import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { OutboxStatus } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { HMAC_PATHS, ISSUER_IDS } from '../security/security.constants';

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueuePacs009(args: {
    paymentId: string;
    messageId: string;
    correlationId: string;
    payload: string;
  }) {
    return this.prisma.outboxMessage.create({
      data: {
        paymentId: args.paymentId,
        messageId: args.messageId,
        correlationId: args.correlationId,
        messageType: 'pacs.009',
        httpMethod: 'POST',
        targetPath: HMAC_PATHS.ISSUER_B_PACS009,
        contentType: 'application/xml',
        issuerId: ISSUER_IDS.ISSUER_A,
        idempotencyKey: `PACS009:${args.messageId}`,
        payload: args.payload,
        status: OutboxStatus.PENDING,
        maxAttempts: this.getMaxAttempts(),
      },
    });
  }

  private getMaxAttempts(): number {
    const rawValue = process.env.OUTBOX_MAX_ATTEMPTS ?? '5';
    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new InternalServerErrorException(
        'OUTBOX_MAX_ATTEMPTS must be a positive number',
      );
    }

    return parsed;
  }
}