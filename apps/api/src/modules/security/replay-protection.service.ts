import { ConflictException, Injectable } from '@nestjs/common';
import { Issuer, Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';

@Injectable()
export class ReplayProtectionService {
  constructor(private readonly prisma: PrismaService) {}

  async registerNonceOrThrow(args: {
    issuer: Issuer;
    nonce: string;
    idempotencyKey: string;
    requestHash: string;
    signatureTimestamp: string;
  }): Promise<void> {
    try {
      await this.prisma.replayNonce.create({
        data: {
          issuer: args.issuer,
          nonce: args.nonce,
          idempotencyKey: args.idempotencyKey,
          requestHash: args.requestHash,
          signatureTimestamp: new Date(Number(args.signatureTimestamp)),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Replay detected for issuer nonce');
      }

      throw error;
    }
  }
}