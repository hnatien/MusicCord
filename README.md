# MusicCord

Simple macOS app that syncs Apple Music now-playing info to Discord Rich Presence.

## Stack

- Node.js + TypeScript
- `discord-rpc` for local Discord IPC transport
- `zod` + `dotenv` for config validation
- `vitest` for tests

## Prerequisites

- macOS with Apple Music app
- Discord desktop app running
- A Discord application Client ID from the Developer Portal

## Setup

```bash
cp .env.example .env
# edit .env with your DISCORD_CLIENT_ID
npm install
npm run build
npm start
```

Or run directly in dev mode:

```bash
npm run dev
```

## Notes

- This app uses AppleScript (`osascript`) to read Apple Music playback state.
- It reads title/artist/album plus playback position and duration from Apple Music.
- Album artwork is resolved per track from iTunes Search API and used in Rich Presence when available.
- Rich Presence updates only when track/status changes.
- If dynamic artwork fails or is disabled, it falls back to `DISCORD_APPLE_MUSIC_ASSET_KEY`.
- Discord RPC sessions from custom apps are rendered as `Playing` activity; native `Listening to Spotify` style is not available via this RPC library.
- To show the Apple Music logo:
  - Open your Discord application in Developer Portal.
  - Go to **Rich Presence** → **Art Assets**.
  - Upload your Apple Music logo image (PNG/JPG).
  - Set the asset key to `apple_music` (or change `DISCORD_APPLE_MUSIC_ASSET_KEY` in `.env`).
  - If you prefer to hide the large image instead of showing `?`, set `DISCORD_APPLE_MUSIC_ASSET_KEY=` (empty).
