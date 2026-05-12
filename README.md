<div align="center">

![MusicCord Pixel Banner](./assets/musiccord-pixel-banner.svg)

<br />

<h1>MusicCord</h1>

<p>
  <b>Apple Music &rarr; Discord Rich Presence.</b><br />
  A tiny, native bridge that brings your now-playing track to Discord &mdash;<br />
  with album artwork, live progress, and zero configuration.
</p>

<p>
  <a href="#quick-start"><img alt="Node.js 20+" src="https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white"></a>
  <a href="#quick-start"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white"></a>
  <a href="#requirements"><img alt="macOS and Windows" src="https://img.shields.io/badge/macOS%20%2B%20Windows-Apple%20Music-FA243C?style=for-the-badge&logo=applemusic&logoColor=white"></a>
  <a href="https://discord.com/developers/docs/rich-presence/overview"><img alt="Discord RPC" src="https://img.shields.io/badge/Discord-Rich%20Presence-5865F2?style=for-the-badge&logo=discord&logoColor=white"></a>
</p>

<p>
  <img alt="Tests" src="https://img.shields.io/badge/tests-vitest-6E9F18?logo=vitest&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/license-ISC-blue">
  <img alt="Platform" src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey">
  <img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen">
</p>

<br />

<img width="860" alt="MusicCord Rich Presence preview in Discord" src="https://github.com/user-attachments/assets/75c26d74-e736-482b-9070-a2c4b4e3ab00" />

<br /><br />

<p>
  <a href="#quick-start"><b>Quick Start</b></a>
  &nbsp;&middot;&nbsp;
  <a href="#configuration"><b>Configuration</b></a>
  &nbsp;&middot;&nbsp;
  <a href="#how-it-works"><b>How It Works</b></a>
  &nbsp;&middot;&nbsp;
  <a href="#troubleshooting"><b>Troubleshooting</b></a>
  &nbsp;&middot;&nbsp;
  <a href="#contributing"><b>Contributing</b></a>
</p>

</div>

<br />

## Features

- **Native on both platforms.** AppleScript on macOS, Windows media controls on Windows.
- **Dynamic album artwork.** Resolved live through the iTunes Search API.
- **Graceful fallback.** Static Rich Presence asset takes over when remote artwork is unavailable.
- **Accurate progress.** Live progress bar for playing tracks, frozen position for paused ones.
- **Self-healing loop.** Retries Discord IPC and artwork lookups without taking the sync loop down.
- **Zero config.** Ships with a default Discord application &mdash; install and run.
- **Tray app.** Optional Electron tray for quick start/stop and status.

## Requirements

- **macOS** with the Music app, **or** **Windows 10 1809+ / Windows 11** with Apple Music for Windows.
- **Discord desktop** running and signed in.
- **Homebrew** (macOS, recommended) **or** **Node.js 20+** for local development.
- Automation permission for the terminal to control Music, if macOS prompts.

## Quick Start

### macOS &mdash; Homebrew (recommended)

```bash
brew tap hnatien/musiccord
brew install --HEAD musiccord
brew services start musiccord
```

Keep Discord open, hit play in Apple Music, and accept the macOS Automation permission if prompted. That's it.

```bash
brew services stop musiccord       # stop the background service
musiccord                          # run in the foreground
```

<details>
<summary><b>More Homebrew commands</b></summary>

<br />

| Command | Purpose |
| --- | --- |
| `brew services start musiccord` | Start MusicCord in the background. |
| `brew services stop musiccord` | Stop the background service. |
| `brew services restart musiccord` | Restart after updating. |
| `tail -f "$(brew --prefix)/var/log/musiccord.log"` | View service logs. |
| `brew upgrade --fetch-HEAD musiccord` | Update to the latest commit. |

The tap lives in `hnatien/homebrew-musiccord` and resolves from `hnatien/musiccord`. You can also install with the fully qualified name:

```bash
brew install --HEAD hnatien/musiccord/musiccord
```

</details>

### Windows &mdash; from source

```powershell
git clone https://github.com/hnatien/MusicCord.git
cd MusicCord
npm install
npm run build:windows-helper   # optional, faster startup
npm run dev
```

Run the tray app instead of the headless loop:

```powershell
npm run tray
```

Or package a portable executable (output: `release-tray/MusicCord.exe`):

```powershell
npm run package:win:tray
```

> Requires Node.js 20+ and the .NET SDK on `PATH`. If you skip `build:windows-helper`, the helper runs from source via `dotnet run`.

## Configuration

MusicCord ships with sensible defaults &mdash; **most users do not need a `.env` file**. Override only when you want your own Discord application or a different polling cadence.

```env
DISCORD_CLIENT_ID=1501873458127048745
POLL_INTERVAL_MS=1000
DISCORD_APPLE_MUSIC_ASSET_KEY=apple-music-svgrepo-com
ENABLE_DYNAMIC_ARTWORK=true
```

| Variable | Default | Description |
| --- | --- | --- |
| `DISCORD_CLIENT_ID` | `1501873458127048745` | Discord application Client ID used for Rich Presence. Override only for a custom Discord app. |
| `POLL_INTERVAL_MS` | `1000` | Apple Music polling interval, in milliseconds. Discord updates are independently throttled to once every 15 s. |
| `DISCORD_APPLE_MUSIC_ASSET_KEY` | `apple-music-svgrepo-com` | Fallback asset key from your Discord app. Empty value disables the static asset. |
| `ENABLE_DYNAMIC_ARTWORK` | `true` | Look up album artwork via the iTunes Search API before falling back to the static asset. |

<details>
<summary><b>Bring-your-own Discord application</b></summary>

<br />

Most users can skip this. Only follow these steps if you want to use your own Discord application instead of the bundled one.

1. Open your app in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Select **Rich Presence**.
3. Upload an Apple Music logo image under **App Assets**.
4. Set the asset key to `apple-music-svgrepo-com`, or match the value of `DISCORD_APPLE_MUSIC_ASSET_KEY`.
5. Keep `ENABLE_DYNAMIC_ARTWORK=true` to try iTunes artwork first.

</details>

## How It Works

```text
 Apple Music                 MusicCord                    Discord
 ───────────                 ─────────                    ───────
 AppleScript (macOS)   ──►   normalize track   ──►   Rich Presence
 Windows Media (Win)         resolve artwork           over local IPC
                             via iTunes API
```

Playback state mapping:

| Apple Music | Discord Rich Presence |
| --- | --- |
| **Playing** | Metadata, artwork, and a live progress bar. |
| **Paused** | Metadata and artwork held at the paused position. |
| **Stopped** / closed | Presence cleared. |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run from TypeScript source with `tsx`. |
| `npm run tray` | Run the Electron tray app. |
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm start` | Run the compiled app from `dist/index.js`. |
| `npm run package:win:tray` | Build the portable Windows tray executable. |
| `npm run build:windows-helper` | Pre-build the .NET Windows media helper. |
| `npm test` | Run the Vitest test suite. |
| `npm run lint` | Lint TypeScript with ESLint. |

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `Discord IPC connect failed` | Discord desktop must be open and logged in. |
| Presence does not appear | Restart with `brew services restart musiccord`. If using a custom `.env`, verify `DISCORD_CLIENT_ID`. |
| No data on macOS | Start playback in Music and grant automation permission in **System Settings &rarr; Privacy &amp; Security &rarr; Automation**. |
| No data on Windows | Start playback in Apple Music for Windows, confirm `dotnet --info` works, then run `npm run build:windows-helper`. |
| Artwork is missing | Confirm network access to `itunes.apple.com` and verify `DISCORD_APPLE_MUSIC_ASSET_KEY`. |
| Progress looks stale | Lower `POLL_INTERVAL_MS`, or wait for the next poll. |

## Project Structure

```text
src/
  app/            # application lifecycle and shutdown
  config/         # environment loading and validation
  domain/         # shared music types
  integrations/   # Apple Music, Discord RPC, iTunes adapters
  services/       # presence synchronization loop
  tray/           # Electron tray app
test/             # Vitest coverage for integrations
assets/           # banner, tray icons, Windows media helper
scripts/          # packaging helpers
```

## Tech Stack

<p>
  <img alt="TypeScript" src="https://img.shields.io/badge/-TypeScript-3178C6?logo=typescript&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white">
  <img alt="Electron" src="https://img.shields.io/badge/-Electron-47848F?logo=electron&logoColor=white">
  <img alt="Vitest" src="https://img.shields.io/badge/-Vitest-6E9F18?logo=vitest&logoColor=white">
  <img alt="Zod" src="https://img.shields.io/badge/-Zod-3E67B1">
  <img alt=".NET" src="https://img.shields.io/badge/-.NET-512BD4?logo=dotnet&logoColor=white">
  <img alt="AppleScript" src="https://img.shields.io/badge/-AppleScript-000000?logo=apple&logoColor=white">
</p>

## Contributing

Issues and pull requests are welcome. If you're adding a feature, please include Vitest coverage for the integration layer it touches.

```bash
npm install
npm test
npm run lint
```

## License

[ISC](./LICENSE) &mdash; Apple Music, Discord, and their respective marks are trademarks of their owners. MusicCord is an independent project and is not affiliated with Apple or Discord.

<br />

<div align="center">
  <sub>Made with care for everyone who lives in Discord and listens on Apple Music.</sub>
</div>
