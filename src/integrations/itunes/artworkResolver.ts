import type { TrackInfo } from '../../domain/music/types.js';

type ITunesTrack = Readonly<{
  artworkUrl100?: string;
}>;

type ITunesSearchResponse = Readonly<{
  resultCount: number;
  results: ITunesTrack[];
}>;

type CacheEntry =
  | Readonly<{
      kind: 'hit';
      url: string;
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

export const findArtworkUrl = async (track: TrackInfo): Promise<string | null> => {
  const trackLabel = `${track.title} - ${track.artist}`;
  const cacheKey = buildCacheKey(track);
  const cached = getCacheEntry(cacheKey);
  if (cached?.kind === 'hit') {
    console.log(`[artwork][success] Cache hit for ${trackLabel}: ${cached.url}`);
    return cached.url;
  }
  if (cached?.kind === 'miss') {
    const retryAt = new Date(cached.expiresAt).toISOString();
    console.log(`[artwork][skip] Cache miss TTL active for ${trackLabel}, retry after ${retryAt}`);
    return null;
  }

  const term = encodeURIComponent(`${track.title} ${track.artist}`);
  const endpoint = `https://itunes.apple.com/search?media=music&entity=song&limit=1&term=${term}`;
  console.log(`[artwork][lookup] Querying iTunes for ${trackLabel}: ${endpoint}`);

  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      console.warn(
        `[artwork][error] iTunes lookup failed (${response.status}) for ${trackLabel}`
      );
      setMissCache(cacheKey);
      return null;
    }

    const json = (await response.json()) as ITunesSearchResponse;
    const first = json.results[0];
    if (!first?.artworkUrl100) {
      console.warn(`[artwork][error] No artworkUrl100 in iTunes result for ${trackLabel}`);
      setMissCache(cacheKey);
      return null;
    }

    const artworkUrl = toHighResArtworkUrl(first.artworkUrl100);
    cache.set(
      cacheKey,
      Object.freeze({
        kind: 'hit',
        url: artworkUrl
      })
    );
    console.log(`[artwork][success] Resolved dynamic artwork for ${trackLabel}: ${artworkUrl}`);
    return artworkUrl;
  } catch (error) {
    console.warn(`[artwork][error] iTunes lookup exception for ${trackLabel}`, error);
    setMissCache(cacheKey);
    return null;
  }
};

export const __testables__ = {
  cache,
  getCacheEntry,
  MISS_TTL_MS
};
