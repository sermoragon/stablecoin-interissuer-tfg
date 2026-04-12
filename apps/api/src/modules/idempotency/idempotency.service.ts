import { ConflictException, Injectable } from '@nestjs/common';
import { IdempotencyRecord, IdempotencyStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';

export type BeginRequestResult =
  | { kind: 'started'; record: IdempotencyRecord }
  | { kind: 'replay_completed'; record: IdempotencyRecord };

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async begin(
    scope: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<BeginRequestResult> {
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        scope_idempotencyKey: {
          scope,
          idempotencyKey,
        },
      },
    });

    if (existing) {
      return this.resolveExisting(existing, requestHash);
    }

    try {
      const created = await this.prisma.idempotencyRecord.create({
        data: {
          scope,
          idempotencyKey,
          requestHash,
          status: IdempotencyStatus.PROCESSING,
        },
      });

      return {
        kind: 'started',
        record: created,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.prisma.idempotencyRecord.findUniqueOrThrow({
          where: {
            scope_idempotencyKey: {
              scope,
              idempotencyKey,
            },
          },
        });

        return this.resolveExisting(raced, requestHash);
      }

      throw error;
    }
  }

  async complete(args: {
    recordId: string;
    responseStatusCode: number;
    responseContentType: string;
    responseBody: string;
    resourceType?: string;
    resourceId?: string;
  }): Promise<void> {
    await this.prisma.idempotencyRecord.update({
      where: { id: args.recordId },
      data: {
        status: IdempotencyStatus.COMPLETED,
        responseStatusCode: args.responseStatusCode,
        responseContentType: args.responseContentType,
        responseBody: args.responseBody,
        resourceType: args.resourceType,
        resourceId: args.resourceId,
        completedAt: new Date(),
      },
    });
  }

  async fail(recordId: string): Promise<void> {
    await this.prisma.idempotencyRecord.update({
      where: { id: recordId },
      data: {
        status: IdempotencyStatus.FAILED,
      },
    });
  }

  private resolveExisting(
    existing: IdempotencyRecord,
    requestHash: string,
  ): BeginRequestResult {
    if (existing.requestHash !== requestHash) {
      throw new ConflictException(
        'Idempotency-Key was already used with a different payload',
      );
    }

    if (existing.status === IdempotencyStatus.COMPLETED) {
      return {
        kind: 'replay_completed',
        record: existing,
      };
    }

    throw new ConflictException('Idempotent request is already in progress');
  }
}