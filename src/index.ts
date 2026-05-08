#!/usr/bin/env node

import { run } from './app/run.js';
import { logger } from './utils/logger.js';

const HELP_TEXT = `MusicCord

Apple Music Rich Presence for Discord on macOS and Windows.

Usage:
  musiccord

Supported players:
  macOS Music app
  Apple Music app for Windows

Environment overrides:
  DISCORD_CLIENT_ID
  POLL_INTERVAL_MS
  DISCORD_APPLE_MUSIC_ASSET_KEY
  ENABLE_DYNAMIC_ARTWORK
`;

const arg = process.argv[2];

if (arg === '--help' || arg === '-h') {
  console.log(HELP_TEXT);
  process.exit(0);
}

void run().catch((error) => {
  logger.error('app', 'Startup failed', error);
  process.exit(1);
});
