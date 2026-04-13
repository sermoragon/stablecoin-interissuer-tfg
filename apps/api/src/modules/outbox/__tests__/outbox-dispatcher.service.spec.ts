import { OutboxStatus } from '@prisma/client';
import { OutboxDispatcherService } from '../outbox-dispatcher.service';

describe('OutboxDispatcherService', () => {
  let service: OutboxDispatcherService;

  beforeEach(() => {
    process.env.OUTBOX_PROCESSING_TIMEOUT_MS = '1000';
    process.env.OUTBOX_POLL_INTERVAL_MS = '1000';
    process.env.OUTBOX_RETRY_BASE_DELAY_MS = '2000';
    process.env.ISSUER_B_BASE_URL = 'http://localhost:3000';
    process.env.ISSUER_A_TO_ISSUER_B_HMAC_SECRET = 'test-secret';

    const prisma = {
      outboxMessage: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const hmacService = {} as never;
    const technicalAckParser = {} as never;

    service = new OutboxDispatcherService(
      prisma as never,
      hmacService,
      technicalAckParser,
    );
  });

  it('should recover stale processing messages back to pending', async () => {
    const recovered = await service.recoverStaleProcessingMessages();

    expect(recovered).toBe(1);
  });

  it('should treat 5xx as retryable and common 4xx as non-retryable', () => {
    expect(
      (
        service as unknown as {
          isRetryableHttpStatus(status: number): boolean;
        }
      ).isRetryableHttpStatus(500),
    ).toBe(true);

    expect(
      (
        service as unknown as {
          isRetryableHttpStatus(status: number): boolean;
        }
      ).isRetryableHttpStatus(503),
    ).toBe(true);

    expect(
      (
        service as unknown as {
          isRetryableHttpStatus(status: number): boolean;
        }
      ).isRetryableHttpStatus(408),
    ).toBe(true);

    expect(
      (
        service as unknown as {
          isRetryableHttpStatus(status: number): boolean;
        }
      ).isRetryableHttpStatus(429),
    ).toBe(true);

    expect(
      (
        service as unknown as {
          isRetryableHttpStatus(status: number): boolean;
        }
      ).isRetryableHttpStatus(400),
    ).toBe(false);

    expect(
      (
        service as unknown as {
          isRetryableHttpStatus(status: number): boolean;
        }
      ).isRetryableHttpStatus(401),
    ).toBe(false);

    expect(
      (
        service as unknown as {
          isRetryableHttpStatus(status: number): boolean;
        }
      ).isRetryableHttpStatus(404),
    ).toBe(false);
  });

  it('should fail finally when a non-retryable error happens', async () => {
    const update = jest.fn().mockResolvedValue({});

    const prisma = {
      outboxMessage: {
        update: update,
      },
    };

    const testService = new OutboxDispatcherService(
      prisma as never,
      {} as never,
      {} as never,
    );

    await (
      testService as unknown as {
        handleDeliveryFailure(
          message: {
            id: string;
            attemptCount: number;
            maxAttempts: number;
          },
          args: {
            errorMessage: string;
            retryable: boolean;
            statusCode?: number;
            responseBody?: string;
          },
        ): Promise<void>;
      }
    ).handleDeliveryFailure(
      {
        id: 'outbox-1',
        attemptCount: 1,
        maxAttempts: 5,
      },
      {
        errorMessage: 'Issuer B responded with HTTP 400',
        retryable: false,
        statusCode: 400,
        responseBody: 'Bad Request',
      },
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: 'outbox-1' },
      data: expect.objectContaining({
        status: OutboxStatus.FAILED,
        lastHttpStatus: 400,
        lastResponseBody: 'Bad Request',
        lastError: 'Issuer B responded with HTTP 400',
      }),
    });
  });
});