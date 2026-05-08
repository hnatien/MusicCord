export const DISCORD_ACTIVITY_UPDATE_INTERVAL_MS = 15_000;

type TimerHandle = ReturnType<typeof setTimeout>;

type DiscordUpdateThrottleOptions<TUpdate> = Readonly<{
  intervalMs?: number;
  now?: () => number;
  setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer?: (timer: TimerHandle) => void;
  onError?: (error: unknown) => void;
  send: (update: TUpdate) => Promise<void>;
}>;

export class DiscordUpdateThrottle<TUpdate> {
  private readonly intervalMs: number;
  private readonly now: () => number;
  private readonly setTimer: (callback: () => void, delayMs: number) => TimerHandle;
  private readonly clearTimer: (timer: TimerHandle) => void;
  private readonly onError: (error: unknown) => void;
  private readonly send: (update: TUpdate) => Promise<void>;
  private lastSentAt: number | null = null;
  private pendingUpdate: TUpdate | null = null;
  private timer: TimerHandle | null = null;
  private isSending = false;

  public constructor(options: DiscordUpdateThrottleOptions<TUpdate>) {
    this.intervalMs = options.intervalMs ?? DISCORD_ACTIVITY_UPDATE_INTERVAL_MS;
    this.now = options.now ?? Date.now;
    this.setTimer = options.setTimer ?? setTimeout;
    this.clearTimer = options.clearTimer ?? clearTimeout;
    this.onError = options.onError ?? (() => undefined);
    this.send = options.send;
  }

  public schedule(update: TUpdate): void {
    this.pendingUpdate = update;
    this.queueFlush();
  }

  public stop(): void {
    if (this.timer) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
    this.pendingUpdate = null;
  }

  private queueFlush(): void {
    if (this.isSending || !this.pendingUpdate) {
      return;
    }

    const delayMs = this.getDelayUntilNextSend();
    if (delayMs > 0) {
      this.scheduleTimer(delayMs);
      return;
    }

    void this.flush();
  }

  private getDelayUntilNextSend(): number {
    if (this.lastSentAt === null) {
      return 0;
    }

    return Math.max(this.intervalMs - (this.now() - this.lastSentAt), 0);
  }

  private scheduleTimer(delayMs: number): void {
    if (this.timer) {
      return;
    }

    this.timer = this.setTimer(() => {
      this.timer = null;
      this.queueFlush();
    }, delayMs);
  }

  private async flush(): Promise<void> {
    const update = this.pendingUpdate;
    if (!update) {
      return;
    }

    this.pendingUpdate = null;
    this.isSending = true;

    try {
      await this.send(update);
    } catch (error) {
      this.onError(error);
    } finally {
      this.lastSentAt = this.now();
      this.isSending = false;
      this.queueFlush();
    }
  }
}
