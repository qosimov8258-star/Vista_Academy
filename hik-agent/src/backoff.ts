/** Exponential backoff: 5s, 10s, 20s ... 5 daqiqagacha; muvaffaqiyatda qaytadan. */
export class Backoff {
  private failures = 0;

  constructor(
    private readonly baseMs = 5_000,
    private readonly maxMs = 5 * 60_000,
  ) {}

  /** Keyingi urinishgacha kutish (ms). */
  fail(): number {
    this.failures++;
    return Math.min(this.maxMs, this.baseMs * 2 ** (this.failures - 1));
  }

  succeed() {
    this.failures = 0;
  }

  get failing(): boolean {
    return this.failures > 0;
  }
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
