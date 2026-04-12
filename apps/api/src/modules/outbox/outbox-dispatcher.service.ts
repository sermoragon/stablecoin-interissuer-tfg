import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  IsoDirection,
  OutboxMessage,
  OutboxStatus,
  PaymentStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { TechnicalAckParser } from '../iso20022/parsers/technical-ack.parser';
import { PrismaService } from '../persistence/prisma.service';
import { HmacService } from '../security/hmac.service';
import { calculateRetryDelayMs } from './outbox-retry.util';

export type DispatchResult =
  | { kind: 'delivered'; ackStatus: string }
  | { kind: 'queued'; reason: string };

@Injectable()
export class OutboxDispatcherService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(OutboxDispatcherService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly hmacService: HmacService,
    private readonly technicalAckParser: TechnicalAckParser,
  ) {}

  onModuleInit(): void {
    if (!this.isPollingEnabled()) {
      return;
    }

    this.timer = setInterval(() => {
      void this.processDueMessages();
    }, this.getPollIntervalMs());
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async processDueMessages(limit = 10): Promise<number> {
    const dueMessages = await this.prisma.outboxMessage.findMany({
      where: {
        status: OutboxStatus.PENDING,
        nextAttemptAt: {
          lte: new Date(),
        },
      },
      orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
      take: limit,
      select: { id: true },
    });

    for (const message of dueMessages) {
      await this.dispatchById(message.id);
    }

    return dueMessages.length;
  }

  async dispatchById(id: string): Promise<DispatchResult> {
    const claimedMessage = await this.claimPendingMessage(id);

    if (!claimedMessage) {
      return this.getResultFromCurrentState(id);
    }

    return this.attemptDelivery(claimedMessage);
  }

  private async claimPendingMessage(id: string): Promise<OutboxMessage | null> {
    const now = new Date();

    const result = await this.prisma.outboxMessage.updateMany({
      where: {
        id,
        status: OutboxStatus.PENDING,
        nextAttemptAt: {
          lte: now,
        },
      },
      data: {
        status: OutboxStatus.PROCESSING,
        lastAttemptAt: now,
        attemptCount: {
          increment: 1,
        },
      },
    });

    if (result.count === 0) {
      return null;
    }

    return this.prisma.outboxMessage.findUniqueOrThrow({
      where: { id },
    });
  }

  private async getResultFromCurrentState(id: string): Promise<DispatchResult> {
    const current = await this.prisma.outboxMessage.findUnique({
      where: { id },
    });

    if (!current) {
      return { kind: 'queued', reason: 'NOT_FOUND' };
    }

    if (current.status === OutboxStatus.DELIVERED) {
      const ackStatus = this.extractAckStatus(current.lastResponseBody);

      if (ackStatus) {
        return {
          kind: 'delivered',
          ackStatus,
        };
      }
    }

    return {
      kind: 'queued',
      reason: current.status,
    };
  }

  private async attemptDelivery(
    message: OutboxMessage,
  ): Promise<DispatchResult> {
    const timestamp = Date.now().toString();
    const nonce = randomUUID();

    const signature = this.hmacService.signRequest({
      issuerId: message.issuerId,
      idempotencyKey: message.idempotencyKey,
      timestamp,
      nonce,
      method: message.httpMethod,
      path: message.targetPath,
      body: message.payload,
    });

    let responseStatus: number | undefined;
    let responseBody = '';

    try {
      const response = await fetch(
        `${this.getIssuerBBaseUrl()}${message.targetPath}`,
        {
          method: message.httpMethod,
          headers: {
            'Content-Type': message.contentType,
            'Idempotency-Key': message.idempotencyKey,
            'X-Issuer-Id': message.issuerId,
            'X-Timestamp': timestamp,
            'X-Nonce': nonce,
            'X-Signature': signature,
          },
          body: message.payload,
        },
      );

      responseStatus = response.status;
      responseBody = await response.text();

      if (!response.ok) {
        await this.rescheduleAfterFailure(
          message,
          `Issuer B responded with HTTP ${response.status}`,
          responseStatus,
          responseBody,
        );

        return {
          kind: 'queued',
          reason: 'HTTP_ERROR',
        };
      }

      const parsedAck = this.technicalAckParser.parse(responseBody);

      await this.prisma.$transaction(async (tx) => {
        const existingInboundAck = await tx.isoMessage.findFirst({
          where: {
            paymentId: message.paymentId,
            direction: IsoDirection.INBOUND,
            messageType: 'tech_ack',
            messageId: parsedAck.messageId,
          },
        });

        if (!existingInboundAck) {
          await tx.isoMessage.create({
            data: {
              paymentId: message.paymentId,
              direction: IsoDirection.INBOUND,
              messageType: 'tech_ack',
              messageId: parsedAck.messageId,
              relatedMessageId: parsedAck.originalMessageId,
              correlationId: parsedAck.originalCorrelationId,
              sender: 'ISSUER_B',
              receiver: 'ISSUER_A',
              rawXml: responseBody,
              parsedJson: parsedAck,
            },
          });
        }

        const existingAckEvent = await tx.paymentEvent.findFirst({
          where: {
            paymentId: message.paymentId,
            type: 'ISO_TECH_ACK_RECEIVED',
          },
        });

        if (!existingAckEvent) {
          await tx.paymentEvent.create({
            data: {
              paymentId: message.paymentId,
              type: 'ISO_TECH_ACK_RECEIVED',
              payload: parsedAck,
            },
          });
        }

        await tx.payment.update({
          where: { id: message.paymentId },
          data: {
            status:
              parsedAck.status === 'ACCEPTED'
                ? PaymentStatus.ISO_ACK_ACCEPTED
                : PaymentStatus.ISO_ACK_REJECTED,
          },
        });

        await tx.outboxMessage.update({
          where: { id: message.id },
          data: {
            status: OutboxStatus.DELIVERED,
            deliveredAt: new Date(),
            lastHttpStatus: responseStatus,
            lastResponseBody: responseBody,
            lastError: null,
          },
        });
      });

      return {
        kind: 'delivered',
        ackStatus: parsedAck.status,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown outbox delivery error';

      this.logger.warn(
        `Outbox dispatch failed for ${message.messageId}: ${errorMessage}`,
      );

      await this.rescheduleAfterFailure(
        message,
        errorMessage,
        responseStatus,
        responseBody,
      );

      return {
        kind: 'queued',
        reason: 'NETWORK_ERROR',
      };
    }
  }

  private async rescheduleAfterFailure(
    message: OutboxMessage,
    errorMessage: string,
    statusCode?: number,
    responseBody?: string,
  ): Promise<void> {
    const shouldFailFinal = message.attemptCount >= message.maxAttempts;

    const data: {
      status: OutboxStatus;
      lastHttpStatus?: number;
      lastResponseBody?: string;
      lastError: string;
      nextAttemptAt?: Date;
    } = {
      status: shouldFailFinal ? OutboxStatus.FAILED : OutboxStatus.PENDING,
      lastError: errorMessage,
    };

    if (typeof statusCode === 'number') {
      data.lastHttpStatus = statusCode;
    }

    if (typeof responseBody === 'string' && responseBody.length > 0) {
      data.lastResponseBody = responseBody;
    }

    if (!shouldFailFinal) {
      data.nextAttemptAt = new Date(
        Date.now() +
          calculateRetryDelayMs(
            message.attemptCount,
            this.getRetryBaseDelayMs(),
          ),
      );
    }

    await this.prisma.outboxMessage.update({
      where: { id: message.id },
      data,
    });
  }

  private extractAckStatus(responseBody?: string | null): string | undefined {
    if (!responseBody) {
      return undefined;
    }

    try {
      return this.technicalAckParser.parse(responseBody).status;
    } catch {
      return undefined;
    }
  }

  private isPollingEnabled(): boolean {
    return (process.env.OUTBOX_POLLING_ENABLED ?? 'true').toLowerCase() !== 'false';
  }

  private getPollIntervalMs(): number {
    const rawValue = process.env.OUTBOX_POLL_INTERVAL_MS ?? '2000';
    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new InternalServerErrorException(
        'OUTBOX_POLL_INTERVAL_MS must be a positive number',
      );
    }

    return parsed;
  }

  private getRetryBaseDelayMs(): number {
    const rawValue = process.env.OUTBOX_RETRY_BASE_DELAY_MS ?? '2000';
    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new InternalServerErrorException(
        'OUTBOX_RETRY_BASE_DELAY_MS must be zero or a positive number',
      );
    }

    return parsed;
  }

  private getIssuerBBaseUrl(): string {
    const baseUrl = process.env.ISSUER_B_BASE_URL;

    if (!baseUrl) {
      throw new InternalServerErrorException(
        'ISSUER_B_BASE_URL is not configured',
      );
    }

    return baseUrl;
  }
}