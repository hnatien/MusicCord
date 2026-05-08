![MusicCord Pixel Banner](./assets/musiccord-pixel-banner.svg)

# MusicCord

Bring Apple Music to Discord Rich Presence on macOS, with track metadata, album artwork, and playback progress that stays visible while music is paused.

<p>
  <img alt="Node.js 20+" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white">
  <img alt="macOS" src="https://img.shields.io/badge/macOS-Apple%20Music-000000?logo=apple&logoColor=white">
  <img alt="Discord RPC" src="https://img.shields.io/badge/Discord-Rich%20Presence-5865F2?logo=discord&logoColor=white">
  <img alt="Tests" src="https://img.shields.io/badge/tests-vitest-6E9F18?logo=vitest&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/license-ISC-blue">
</p>

## Contents

- [What It Does](#what-it-does)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Homebrew Install](#homebrew-install)
- [Configuration](#configuration)
- [Discord Asset Setup](#discord-asset-setup)
- [How It Works](#how-it-works)
- [Scripts](#scripts)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)

## What It Does

MusicCord is a small local bridge between Apple Music and Discord. It polls the macOS Music app with AppleScript, resolves artwork through the iTunes Search API when enabled, and publishes the current track to Discord over local IPC.

- Shows song title, artist, album artwork, and progress in Discord Rich Presence.
- Keeps the progress bar available for both playing and paused tracks.
- Uses dynamic iTunes artwork when Discord accepts the image URL.
- Falls back to a configured Discord Rich Presence asset key when dynamic artwork is unavailable.
- Retries Discord IPC and artwork lookup failures without crashing the sync loop.

## Requirements

- macOS with the Music app installed.
- Discord desktop app running and logged in.
- Homebrew for the easiest install path, or Node.js 20 or newer for local development.
- Terminal permission to control Music, if macOS prompts for automation access.

## Quick Start

For normal users, install and run MusicCord with Homebrew:

```bash
brew tap hnatien/musiccord
brew install --HEAD musiccord
brew services start musiccord
```

That is enough for the default setup. Keep Discord open, play something in Apple Music, and accept the macOS Automation permission prompt if it appears.

To stop the background service:

```bash
brew services stop musiccord
```

To run it in the foreground instead of as a service:

```bash
musiccord
```

## Homebrew Install

MusicCord ships with a default Discord application Client ID and fallback asset key, so users do not need to create a Discord Developer Portal app or edit `.env`.

Install:

```bash
brew tap hnatien/musiccord
brew install --HEAD musiccord
```

Start automatically in the background:

```bash
brew services start musiccord
```

Useful commands:

| Command | Purpose |
| --- | --- |
| `brew services start musiccord` | Start MusicCord in the background and keep it running. |
| `brew services stop musiccord` | Stop the background service. |
| `brew services restart musiccord` | Restart after updating. |
| `tail -f "$(brew --prefix)/var/log/musiccord.log"` | View service logs. |
| `brew upgrade --fetch-HEAD musiccord` | Update to the latest commit from the tap. |

The tap lives in `hnatien/homebrew-musiccord`, which Homebrew resolves from `hnatien/musiccord`.

You can also install with the fully qualified formula name:

```bash
brew install --HEAD hnatien/musiccord/musiccord
```

## Developer Run

Install dependencies:

```bash
npm install
```

Optional: create `.env` only if you want to override the packaged defaults:

```env
DISCORD_CLIENT_ID=1501873458127048745
POLL_INTERVAL_MS=15000
DISCORD_APPLE_MUSIC_ASSET_KEY=apple-music-svgrepo-com
ENABLE_DYNAMIC_ARTWORK=true
```

Run MusicCord in development:

```bash
npm run dev
```

For a compiled run:

```bash
npm run build
npm start
```

## Configuration

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DISCORD_CLIENT_ID` | No | `1501873458127048745` | Discord application Client ID used for Rich Presence. Override only if you want to use your own Discord app. |
| `POLL_INTERVAL_MS` | No | `15000` | Apple Music polling interval in milliseconds. |
| `DISCORD_APPLE_MUSIC_ASSET_KEY` | No | `apple-music-svgrepo-com` | Apple Music logo asset key from Discord Rich Presence assets. Used as the small logo with album artwork and as fallback large artwork. Use an empty value to disable the static asset. |
| `ENABLE_DYNAMIC_ARTWORK` | No | `true` | Looks up album artwork through the iTunes Search API before falling back to the static asset. |

## Discord Asset Setup

Most users can skip this section. MusicCord already includes a default Discord application and fallback asset key.

Only do this if you want to use your own Discord application. Dynamic artwork usually gives the best result, but a fallback asset makes the presence stable when Discord rejects a remote image or the artwork lookup misses.

1. Open your app in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Select `Rich Presence`.
3. Upload an Apple Music logo image under app assets.
4. Set the asset key to `apple-music-svgrepo-com`, or match the value in `DISCORD_APPLE_MUSIC_ASSET_KEY`. MusicCord uses this as the small logo when album artwork is available.
5. Keep `ENABLE_DYNAMIC_ARTWORK=true` if you want MusicCord to try iTunes artwork first.

## How It Works

```text
Apple Music
  -> AppleScript reads playback state, track metadata, duration, and position
  -> MusicCord validates environment config and normalizes track data
  -> iTunes Search API resolves album artwork when enabled
  -> Discord RPC publishes Rich Presence over local IPC
```

Playback states:

| Apple Music state | Discord behavior |
| --- | --- |
| Playing | Presence shows metadata, artwork, and a moving progress bar. |
| Paused | Presence keeps metadata, artwork, and progress at the paused position. |
| Stopped or Music closed | Presence is cleared. |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run from TypeScript source with `tsx`. |
| `npm run build` | Compile TypeScript into `dist/`. |
| `npm start` | Run the compiled app from `dist/index.js`. |
| `npm test` | Run the Vitest test suite. |
| `npm run lint` | Lint TypeScript with ESLint. |

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `Discord IPC connect failed` | Make sure Discord desktop is open and logged in. |
| Presence does not appear | Make sure Discord desktop is open, then restart with `brew services restart musiccord`. If you use a custom `.env`, verify `DISCORD_CLIENT_ID`. |
| Apple Music data is missing | Start playback in Music and grant automation permission in macOS Privacy settings if prompted. |
| Artwork is missing | Confirm network access to `itunes.apple.com`, then verify `DISCORD_APPLE_MUSIC_ASSET_KEY`. |
| Progress looks stale | Lower `POLL_INTERVAL_MS` for faster updates, or wait for the next poll cycle. |

## Project Structure

```text
src/
  app/             # application lifecycle and shutdown
  config/          # environment loading and validation
  domain/          # shared music types
  integrations/    # Apple Music, Discord RPC, and iTunes adapters
  services/        # presence synchronization loop
test/              # Vitest coverage for integrations
assets/            # README and Rich Presence visual assets
```
