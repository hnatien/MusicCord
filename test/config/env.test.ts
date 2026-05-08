import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DISCORD_APPLE_MUSIC_ASSET_KEY,
  DEFAULT_DISCORD_CLIENT_ID,
  loadConfig
} from '../../src/config/env.js';

describe('loadConfig', () => {
  it('uses packaged defaults when no env file is configured', () => {
    expect(loadConfig({})).toEqual({
      DISCORD_CLIENT_ID: DEFAULT_DISCORD_CLIENT_ID,
      POLL_INTERVAL_MS: 1000,
      DISCORD_APPLE_MUSIC_ASSET_KEY: DEFAULT_DISCORD_APPLE_MUSIC_ASSET_KEY,
      ENABLE_DYNAMIC_ARTWORK: true
    });
  });

  it('allows advanced users to override defaults', () => {
    expect(
      loadConfig({
        DISCORD_CLIENT_ID: 'custom-client-id',
        POLL_INTERVAL_MS: '3000',
        DISCORD_APPLE_MUSIC_ASSET_KEY: '',
        ENABLE_DYNAMIC_ARTWORK: 'false'
      })
    ).toEqual({
      DISCORD_CLIENT_ID: 'custom-client-id',
      POLL_INTERVAL_MS: 3000,
      DISCORD_APPLE_MUSIC_ASSET_KEY: '',
      ENABLE_DYNAMIC_ARTWORK: false
    });
  });
});
