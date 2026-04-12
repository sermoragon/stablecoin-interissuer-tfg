export function calculateRetryDelayMs(
  attemptCount: number,
  baseDelayMs: number,
): number {
  if (attemptCount <= 0 || baseDelayMs <= 0) {
    return 0;
  }

  return attemptCount * baseDelayMs;
}