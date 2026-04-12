import { calculateRetryDelayMs } from '../outbox-retry.util';

describe('calculateRetryDelayMs', () => {
  it('should return linear backoff based on attempt count', () => {
    expect(calculateRetryDelayMs(1, 2000)).toBe(2000);
    expect(calculateRetryDelayMs(2, 2000)).toBe(4000);
    expect(calculateRetryDelayMs(3, 2000)).toBe(6000);
  });

  it('should return zero when base delay is zero or invalid', () => {
    expect(calculateRetryDelayMs(1, 0)).toBe(0);
    expect(calculateRetryDelayMs(0, 2000)).toBe(0);
  });
});