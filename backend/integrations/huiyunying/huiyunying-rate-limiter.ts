type BucketState = {
  startedAt: number;
  count: number;
};

export class HuiYunYingRateLimiter {
  private bucket: BucketState = {
    startedAt: 0,
    count: 0
  };

  constructor(
    private readonly maxCount: number,
    private readonly windowMs: number
  ) {}

  async acquire(): Promise<void> {
    const now = Date.now();
    if (!this.bucket.startedAt || now - this.bucket.startedAt >= this.windowMs) {
      this.bucket = { startedAt: now, count: 1 };
      return;
    }

    if (this.bucket.count < this.maxCount) {
      this.bucket.count += 1;
      return;
    }

    const waitMs = Math.max(0, this.windowMs - (now - this.bucket.startedAt));
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.bucket = { startedAt: Date.now(), count: 1 };
  }
}
