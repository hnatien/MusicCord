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
    }>
  | Readonly<{
      kind: 'miss';
      expiresAt: number;
    }>;

const MISS_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

const buildCacheKey = (track: TrackInfo): string =>
  `${track.title.toLowerCase()}|${track.artist.toLowerCase()}`;

const getCacheEntry = (cacheKey: string): CacheEntry | undefined => {
  const entry = cache.get(cacheKey);
  if (!entry) {
    return undefined;
  }

  if (entry.kind === 'miss' && Date.now() >= entry.expiresAt) {
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

export const findTrackMetadata = async (track: TrackInfo): Promise<TrackMetadata> => {
  const trackLabel = `${track.title} - ${track.artist}`;
  const cacheKey = buildCacheKey(track);
  const cached = getCacheEntry(cacheKey);
  if (cached?.kind === 'hit') {
    return cached.metadata;
  }
  if (cached?.kind === 'miss') {
    return Object.freeze({ artworkUrl: null, appleMusicUrl: null });
  }

  const term = encodeURIComponent(`${track.title} ${track.artist}`);
  const endpoint = `https://itunes.apple.com/search?media=music&entity=song&limit=1&term=${term}`;

  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      logger.warn('artwork', `Lookup failed (${response.status}): ${trackLabel}`);
      setMissCache(cacheKey);
      return Object.freeze({ artworkUrl: null, appleMusicUrl: null });
    }

    const json = (await response.json()) as ITunesSearchResponse;
    const metadata = json.results[0] ? toTrackMetadata(json.results[0]) : null;
    if (!metadata) {
      logger.warn('artwork', `No track metadata in result: ${trackLabel}`);
      setMissCache(cacheKey);
      return Object.freeze({ artworkUrl: null, appleMusicUrl: null });
    }

    cache.set(
      cacheKey,
      Object.freeze({
        kind: 'hit',
        metadata
      })
    );
    return metadata;
  } catch (error) {
    logger.warn('artwork', `Lookup exception: ${trackLabel}`, error);
    setMissCache(cacheKey);
    return Object.freeze({ artworkUrl: null, appleMusicUrl: null });
  }
};

export const findArtworkUrl = async (track: TrackInfo): Promise<string | null> => {
  const metadata = await findTrackMetadata(track);
  return metadata.artworkUrl;
};

export const __testables__ = {
  cache,
  getCacheEntry,
  MISS_TTL_MS
};
