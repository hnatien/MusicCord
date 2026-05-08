# Repository Guidelines

## Project Structure & Module Organization

MusicCord is a TypeScript Node.js app that bridges Apple Music playback to Discord Rich Presence. Source lives in `src/`:

- `src/index.ts` is the CLI entrypoint.
- `src/app/` handles lifecycle and shutdown.
- `src/config/` loads and validates environment settings.
- `src/domain/` contains shared music types.
- `src/integrations/` contains Apple Music, Discord RPC, and iTunes adapters.
- `src/services/` contains the presence synchronization loop.
- `src/utils/` contains shared utilities such as logging.

Tests live in `test/` and mirror source domains where practical, for example `test/integrations/itunes/artworkResolver.test.ts`. Assets are in `assets/`, compiled output goes to `dist/`, and the Homebrew formula is in `Formula/musiccord.rb`.

## Build, Test, and Development Commands

- `npm install` installs dependencies from `package-lock.json`.
- `npm run dev` runs `src/index.ts` directly with `tsx`.
- `npm run build` compiles TypeScript to `dist/` using `tsconfig.json`.
- `npm start` runs the compiled app from `dist/index.js`.
- `npm test` runs the Vitest test suite once.
- `npm run lint` runs ESLint for TypeScript files.

Use Node.js 20 or newer.

## Coding Style & Naming Conventions

Write strict TypeScript using ES modules. Prefer small files organized by feature or integration. Use `camelCase` for variables and functions, `PascalCase` for types/classes, and descriptive filenames such as `discordPresenceClient.ts`.

ESLint enforces type-only imports with `@typescript-eslint/consistent-type-imports` and rejects unhandled promises with `@typescript-eslint/no-floating-promises`. Keep async calls awaited or explicitly handled. Use two-space indentation.

## Testing Guidelines

Vitest is the test framework. Place tests under `test/` with the `*.test.ts` suffix. Cover config parsing, integration adapters, and service behavior when changing those areas. Prefer deterministic tests with mocked external dependencies; do not require Discord, Apple Music, or network access.

Run `npm test` before submitting changes. Run `npm run build` and `npm run lint` when touching TypeScript types, imports, or async control flow.

## Commit & Pull Request Guidelines

Git history uses concise messages, usually conventional commits such as `feat: ...` and `fix: ...`; docs commits may use direct messages like `update README.md`. Prefer `<type>: <short imperative summary>` where `type` is `feat`, `fix`, `test`, `docs`, `refactor`, `chore`, or `ci`.

Pull requests should include a short behavior summary, test results, linked issues when applicable, and screenshots or Discord presence examples for visible Rich Presence changes.

## Security & Configuration Tips

Do not hardcode secrets. Runtime configuration belongs in environment variables or a local `.env`; defaults are documented in `README.md`. Validate new configuration through `src/config/env.ts` and avoid logging sensitive values.
