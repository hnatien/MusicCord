import type { TrackInfo } from '../../domain/music/types.js';
import { logger } from '../../utils/logger.js';

type ITunesTrack = Readonly<{
  artworkUrl100?: string;
  trackViewUrl?: string;
}>;

type ITunesSearchResponse = Readonly<{
  resultCount: number;
  results: ITunesTrack[];
}>;

type CacheEntry =
  | Readonly<{
      kind: 'hit';
      metadata: TrackMetadata;
      expiresAt: number;
    }>
  | Readonly<{
      kind: 'miss';
      expiresAt: number;
    }>;

const MISS_TTL_MS = 60 * 1000;
const HIT_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;
const cache = new Map<string, CacheEntry>();

const buildCacheKey = (track: TrackInfo): string =>
  `${track.title.toLowerCase()}|${track.artist.toLowerCase()}`;

const getCacheEntry = (cacheKey: string): CacheEntry | undefined => {
  const entry = cache.get(cacheKey);
  if (!entry) {
    return undefined;
  }

  if (Date.now() >= entry.expiresAt) {
    cache.delete(cacheKey);
    return undefined;
  }

  return entry;
};

const setMissCache = (cacheKey: string): void => {
  cache.set(
    cacheKey,
    Object.freeze({
      kind: 'miss',
      expiresAt: Date.now() + MISS_TTL_MS
    })
  );
};

export const toHighResArtworkUrl = (url: string): string =>
  url
    .replace('/100x100bb.', '/512x512bb.')
    .replace('/100x100.', '/512x512.');

export type TrackMetadata = Readonly<{
  artworkUrl: string | null;
  appleMusicUrl: string | null;
}>;

const toTrackMetadata = (track: ITunesTrack): TrackMetadata | null => {
  const artworkUrl = track.artworkUrl100 ? toHighResArtworkUrl(track.artworkUrl100) : null;
  const appleMusicUrl = track.trackViewUrl ?? null;

  if (!artworkUrl && !appleMusicUrl) {
    return null;
  }

  return Object.freeze({
    artworkUrl,
    appleMusicUrl
  });
};

const EMPTY_METADATA: TrackMetadata = Object.freeze({ artworkUrl: null, appleMusicUrl: null });

type FindOptions = Readonly<{ bypassCache?: boolean }>;

export const findTrackMetadata = async (
  track: TrackInfo,
  options: FindOptions = {}
): Promise<TrackMetadata> => {
  const trackLabel = `${track.title} - ${track.artist}`;
  const cacheKey = buildCacheKey(track);

  if (!options.bypassCache) {
    const cached = getCacheEntry(cacheKey);
    if (cached?.kind === 'hit') {
      return cached.metadata;
    }
    if (cached?.kind === 'miss') {
      return EMPTY_METADATA;
    }
  }

  const term = encodeURIComponent(`${track.title} ${track.artist}`);
  const endpoint = `https://itunes.apple.com/search?media=music&entity=song&limit=1&term=${term}`;

  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) {
      logger.warn('artwork', `Lookup failed (${response.status}): ${trackLabel}`);
      setMissCache(cacheKey);
      return EMPTY_METADATA;
    }

    const json = (await response.json()) as ITunesSearchResponse;
    const metadata = json.results[0] ? toTrackMetadata(json.results[0]) : null;
    if (!metadata) {
      logger.warn('artwork', `No track metadata in result: ${trackLabel}`);
      setMissCache(cacheKey);
      return EMPTY_METADATA;
    }

    cache.set(
      cacheKey,
      Object.freeze({
        kind: 'hit',
        metadata,
        expiresAt: Date.now() + HIT_TTL_MS
      })
    );
    return metadata;
  } catch (error) {
    logger.warn('artwork', `Lookup exception: ${trackLabel}`, error);
    setMissCache(cacheKey);
    return EMPTY_METADATA;
  }
};

export const findArtworkUrl = async (track: TrackInfo): Promise<string | null> => {
  const metadata = await findTrackMetadata(track);
  return metadata.artworkUrl;
};

export const __testables__ = {
  cache,
  getCacheEntry,
  MISS_TTL_MS,
  HIT_TTL_MS
};
