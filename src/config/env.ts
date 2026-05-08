import 'dotenv/config';
import { z } from 'zod';

export const DEFAULT_DISCORD_CLIENT_ID = '1501873458127048745';
export const DEFAULT_DISCORD_APPLE_MUSIC_ASSET_KEY = 'apple-music-svgrepo-com';

const booleanFromEnv = z
  .enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'])
  .default('true')
  .transform((value) => ['true', '1', 'yes', 'on'].includes(value));

const schema = z.object({
  DISCORD_CLIENT_ID: z.string().min(1).default(DEFAULT_DISCORD_CLIENT_ID),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
  DISCORD_APPLE_MUSIC_ASSET_KEY: z
    .string()
    .trim()
    .default(DEFAULT_DISCORD_APPLE_MUSIC_ASSET_KEY),
  ENABLE_DYNAMIC_ARTWORK: booleanFromEnv
});

export type AppConfig = Readonly<z.infer<typeof schema>>;

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => schema.parse(env);
