import { describe, expect, it, vi } from 'vitest';
import {
  DISCORD_ACTIVITY_UPDATE_INTERVAL_MS,
  DiscordUpdateThrottle
} from '../../src/services/discordUpdateThrottle.js';

const flushPromises = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('DiscordUpdateThrottle', () => {
  it('sends the first update immediately', async () => {
    const send = vi.fn<[(update: string) => Promise<void>]>().mockResolvedValue(undefined);
    const throttle = new DiscordUpdateThrottle<string>({
      send
    });

    throttle.schedule('first');
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith('first'));
  });

  it('coalesces updates during the throttle window and sends the latest one', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T00:00:00.000Z'));

    const send = vi.fn<[(update: string) => Promise<void>]>().mockResolvedValue(undefined);
    const throttle = new DiscordUpdateThrottle<string>({
      send
    });

    throttle.schedule('first');
    await flushPromises();
    expect(send).toHaveBeenCalledTimes(1);

    throttle.schedule('second');
    throttle.schedule('third');

    await vi.advanceTimersByTimeAsync(DISCORD_ACTIVITY_UPDATE_INTERVAL_MS - 1);
    expect(send).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith('third');

    throttle.stop();
    vi.useRealTimers();
  });

  it('counts failed attempts toward the throttle window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T00:00:00.000Z'));

    const onError = vi.fn();
    const send = vi
      .fn<(update: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValue(undefined);
    const throttle = new DiscordUpdateThrottle<string>({
      onError,
      send
    });

    throttle.schedule('first');
    await flushPromises();
    expect(onError).toHaveBeenCalledTimes(1);

    throttle.schedule('second');
    await vi.advanceTimersByTimeAsync(DISCORD_ACTIVITY_UPDATE_INTERVAL_MS - 1);
    expect(send).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith('second');

    throttle.stop();
    vi.useRealTimers();
  });
});
