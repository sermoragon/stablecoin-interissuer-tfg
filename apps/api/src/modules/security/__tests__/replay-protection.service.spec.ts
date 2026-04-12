import { ConflictException } from '@nestjs/common';
import { Issuer, Prisma } from '@prisma/client';
import { ReplayProtectionService } from '../replay-protection.service';

describe('ReplayProtectionService', () => {
  it('should persist a fresh nonce', async () => {
    const prisma = {
      replayNonce: {
        create: jest.fn().mockResolvedValue({ id: 'nonce-1' }),
      },
    };

    const service = new ReplayProtectionService(prisma as never);

    await expect(
      service.registerNonceOrThrow({
        issuer: Issuer.ISSUER_A,
        nonce: 'nonce-1',
        idempotencyKey: 'PACS009:MSG-1',
        requestHash: 'hash-1',
        signatureTimestamp: Date.now().toString(),
      }),
    ).resolves.toBeUndefined();
  });

  it('should reject a duplicated nonce', async () => {
    const prisma = {
      replayNonce: {
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('duplicate', {
            code: 'P2002',
            clientVersion: 'test',
          }),
        ),
      },
    };

    const service = new ReplayProtectionService(prisma as never);

    await expect(
      service.registerNonceOrThrow({
        issuer: Issuer.ISSUER_A,
        nonce: 'nonce-1',
        idempotencyKey: 'PACS009:MSG-1',
        requestHash: 'hash-1',
        signatureTimestamp: Date.now().toString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});