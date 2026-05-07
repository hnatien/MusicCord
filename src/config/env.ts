import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DISCORD_CLIENT_ID: z.string().min(1),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
  DISCORD_APPLE_MUSIC_ASSET_KEY: z.string().trim().default('apple_music'),
  ENABLE_DYNAMIC_ARTWORK: z.coerce.boolean().default(true)
});

export type AppConfig = Readonly<z.infer<typeof schema>>;

export const loadConfig = (): AppConfig => schema.parse(process.env);
