import { ConflictException } from '@nestjs/common';
import { IdempotencyStatus } from '@prisma/client';
import { IdempotencyService } from '../idempotency.service';

describe('IdempotencyService', () => {
  it('should start a fresh request', async () => {
    const prisma = {
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'idem-1',
          scope: 'scope-1',
          idempotencyKey: 'key-1',
          requestHash: 'hash-1',
          status: IdempotencyStatus.PROCESSING,
        }),
      },
    };

    const service = new IdempotencyService(prisma as never);
    const result = await service.begin('scope-1', 'key-1', 'hash-1');

    expect(result.kind).toBe('started');
  });

  it('should return a completed replay when hash matches', async () => {
    const prisma = {
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'idem-1',
          scope: 'scope-1',
          idempotencyKey: 'key-1',
          requestHash: 'hash-1',
          status: IdempotencyStatus.COMPLETED,
          responseBody: '{"ok":true}',
        }),
      },
    };

    const service = new IdempotencyService(prisma as never);
    const result = await service.begin('scope-1', 'key-1', 'hash-1');

    expect(result.kind).toBe('replay_completed');
  });

  it('should reject the same key with a different payload hash', async () => {
    const prisma = {
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'idem-1',
          scope: 'scope-1',
          idempotencyKey: 'key-1',
          requestHash: 'hash-1',
          status: IdempotencyStatus.COMPLETED,
        }),
      },
    };

    const service = new IdempotencyService(prisma as never);

    await expect(service.begin('scope-1', 'key-1', 'hash-2')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});