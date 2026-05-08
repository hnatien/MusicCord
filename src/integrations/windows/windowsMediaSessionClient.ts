import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createInterface, type Interface } from 'node:readline';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PlaybackStatus, TrackInfo } from '../../domain/music/types.js';
import type { MusicPlaybackClient } from '../musicPlaybackClient.js';

type WindowsHelperTrackResponse = Readonly<{
  kind: 'track';
  title: string;
  artist: string;
  album: string;
  status: PlaybackStatus;
  durationSeconds: number;
  positionSeconds: number;
  sourceAppUserModelId?: string;
}>;

type WindowsHelperResponse =
  | Readonly<{ kind: 'none' }>
  | WindowsHelperTrackResponse
  | Readonly<{ kind: 'error'; message: string }>;

type PendingRequest = Readonly<{
  resolve: (response: WindowsHelperResponse) => void;
  reject: (error: unknown) => void;
}>;

type HelperCommand = Readonly<{
  command: string;
  args: string[];
  cwd: string;
}>;

const APPLE_MUSIC_SOURCE_PATTERNS = ['applemusic', 'appleinc.applemusic', 'itunes'];
const HELPER_PROJECT_RELATIVE_PATH =
  '../../../assets/windows-media-helper/MusicCord.WindowsMedia/MusicCord.WindowsMedia.csproj';
const PUBLISHED_HELPER_DLL_ASSET_PATH =
  'assets/windows-media-helper/publish/MusicCord.WindowsMedia.dll';
const PUBLISHED_HELPER_EXE_ASSET_PATH =
  'assets/windows-media-helper/publish/MusicCord.WindowsMedia.exe';

export const isAppleMusicSourceAppId = (sourceAppUserModelId?: string | null): boolean => {
  const normalized = sourceAppUserModelId?.toLowerCase() ?? '';
  return APPLE_MUSIC_SOURCE_PATTERNS.some((pattern) => normalized.includes(pattern));
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type NormalizedWindowsMetadata = Readonly<{
  artist: string;
  album: string;
}>;

const splitArtistAlbum = (value: string): NormalizedWindowsMetadata | null => {
  const match = /^(?<artist>.+?)\s*(?:-|\u2013|\u2014)\s*(?<album>[^-\u2013\u2014]+)$/u.exec(value);
  const artist = match?.groups?.artist?.trim();
  const album = match?.groups?.album?.trim();

  if (!artist || !album) {
    return null;
  }

  return Object.freeze({ artist, album });
};

const normalizeWindowsMetadata = (
  artist: string,
  album: string,
  sourceAppUserModelId?: string | null
): NormalizedWindowsMetadata => {
  const normalizedArtist = artist.trim();
  const normalizedAlbum = album.trim();

  if (!normalizedArtist) {
    return Object.freeze({
      artist: 'Unknown Artist',
      album: normalizedAlbum
    });
  }

  if (!normalizedAlbum) {
    const splitMetadata = isAppleMusicSourceAppId(sourceAppUserModelId)
      ? splitArtistAlbum(normalizedArtist)
      : null;

    return (
      splitMetadata ??
      Object.freeze({
        artist: normalizedArtist,
        album: normalizedAlbum
      })
    );
  }

  const albumSuffixPattern = new RegExp(
    `\\s*(?:-|\\u2013|\\u2014)\\s*${escapeRegExp(normalizedAlbum)}$`,
    'iu'
  );
  return Object.freeze({
    artist: normalizedArtist.replace(albumSuffixPattern, '').trim() || normalizedArtist,
    album: normalizedAlbum
  });
};

export const normalizeHelperTrack = (response: WindowsHelperTrackResponse): TrackInfo | null => {
  if (response.status !== 'playing' && response.status !== 'paused') {
    return null;
  }

  const title = response.title.trim();
  if (!title) {
    return null;
  }

  const metadata = normalizeWindowsMetadata(
    response.artist,
    response.album,
    response.sourceAppUserModelId
  );

  return Object.freeze({
    title,
    artist: metadata.artist,
    album: metadata.album,
    status: response.status,
    durationSeconds:
      Number.isFinite(response.durationSeconds) && response.durationSeconds > 0
        ? response.durationSeconds
        : 0,
    positionSeconds:
      Number.isFinite(response.positionSeconds) && response.positionSeconds >= 0
        ? response.positionSeconds
        : 0
  });
};

export const parseHelperResponse = (raw: string): WindowsHelperResponse => {
  const parsed = JSON.parse(raw) as Partial<WindowsHelperResponse>;

  if (parsed.kind === 'none') {
    return Object.freeze({ kind: 'none' });
  }

  if (parsed.kind === 'error') {
    return Object.freeze({
      kind: 'error',
      message: typeof parsed.message === 'string' ? parsed.message : 'Windows media helper failed'
    });
  }

  if (parsed.kind === 'track') {
    return Object.freeze({
      kind: 'track',
      title: typeof parsed.title === 'string' ? parsed.title : '',
      artist: typeof parsed.artist === 'string' ? parsed.artist : '',
      album: typeof parsed.album === 'string' ? parsed.album : '',
      status: parsed.status === 'paused' ? 'paused' : parsed.status === 'playing' ? 'playing' : 'stopped',
      durationSeconds:
        typeof parsed.durationSeconds === 'number' ? parsed.durationSeconds : Number.NaN,
      positionSeconds:
        typeof parsed.positionSeconds === 'number' ? parsed.positionSeconds : Number.NaN,
      sourceAppUserModelId:
        typeof parsed.sourceAppUserModelId === 'string' ? parsed.sourceAppUserModelId : undefined
    });
  }

  throw new Error('Unexpected Windows media helper response');
};

const getHelperProjectPath = (): string =>
  fileURLToPath(new URL(HELPER_PROJECT_RELATIVE_PATH, import.meta.url));

const getPackagedResourcePath = (assetPath: string): string | null => {
  const electronProcess = process as NodeJS.Process & { resourcesPath?: string };
  if (!electronProcess.resourcesPath) {
    return null;
  }

  const unpackedPath = join(electronProcess.resourcesPath, 'app.asar.unpacked', assetPath);
  if (existsSync(unpackedPath)) {
    return unpackedPath;
  }

  const resourcePath = join(electronProcess.resourcesPath, assetPath);
  return existsSync(resourcePath) ? resourcePath : null;
};

const getAssetPath = (assetPath: string): string =>
  getPackagedResourcePath(assetPath) ??
  fileURLToPath(new URL(`../../../${assetPath}`, import.meta.url));

const getPublishedHelperDllPath = (): string => getAssetPath(PUBLISHED_HELPER_DLL_ASSET_PATH);

const getPublishedHelperExePath = (): string => getAssetPath(PUBLISHED_HELPER_EXE_ASSET_PATH);

const resolveHelperCommand = (): HelperCommand => {
  const configuredHelper = process.env.MUSICCORD_WINDOWS_HELPER?.trim();
  if (configuredHelper) {
    const helperPath = resolve(configuredHelper);
    return extname(helperPath).toLowerCase() === '.dll'
      ? { command: 'dotnet', args: [helperPath], cwd: dirname(helperPath) }
      : { command: helperPath, args: [], cwd: dirname(helperPath) };
  }

  const publishedHelperExePath = getPublishedHelperExePath();
  if (existsSync(publishedHelperExePath)) {
    return { command: publishedHelperExePath, args: [], cwd: dirname(publishedHelperExePath) };
  }

  const publishedHelperDllPath = getPublishedHelperDllPath();
  if (existsSync(publishedHelperDllPath)) {
    return { command: 'dotnet', args: [publishedHelperDllPath], cwd: dirname(publishedHelperDllPath) };
  }

  const helperProjectPath = getHelperProjectPath();
  return {
    command: 'dotnet',
    args: ['run', '--project', helperProjectPath, '--'],
    cwd: dirname(helperProjectPath)
  };
};

class WindowsMediaHelperProcess {
  private child: ChildProcessWithoutNullStreams | null = null;
  private lines: Interface | null = null;
  private pending: PendingRequest | null = null;
  private stderr = '';

  public async request(): Promise<WindowsHelperResponse> {
    if (this.pending) {
      throw new Error('Windows media helper already has a pending request');
    }

    const child = this.ensureStarted();
    return new Promise((resolve, reject) => {
      this.pending = Object.freeze({ resolve, reject });
      child.stdin.write('get\n', (error) => {
        if (!error) {
          return;
        }

        this.rejectPending(error);
      });
    });
  }

  private ensureStarted(): ChildProcessWithoutNullStreams {
    if (this.child) {
      return this.child;
    }

    const helperCommand = resolveHelperCommand();
    const child = spawn(helperCommand.command, helperCommand.args, {
      cwd: helperCommand.cwd,
      windowsHide: true
    });

    this.child = child;
    this.stderr = '';
    this.lines = createInterface({ input: child.stdout });

    this.lines.on('line', (line) => {
      try {
        this.resolvePending(parseHelperResponse(line));
      } catch (error) {
        this.rejectPending(error);
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      this.stderr += chunk.toString();
    });

    child.once('error', (error) => {
      this.rejectPending(error);
      this.stop();
    });

    child.once('exit', (code, signal) => {
      const detail = this.stderr.trim() || `exit code ${code ?? 'none'}, signal ${signal ?? 'none'}`;
      this.rejectPending(new Error(`Windows media helper exited: ${detail}`));
      this.stop();
    });

    return child;
  }

  private resolvePending(response: WindowsHelperResponse): void {
    const pending = this.pending;
    this.pending = null;
    pending?.resolve(response);
  }

  private rejectPending(error: unknown): void {
    const pending = this.pending;
    this.pending = null;
    pending?.reject(error);
  }

  public stop(): void {
    this.lines?.close();
    this.lines = null;

    if (this.child) {
      this.child.kill();
      this.child = null;
    }
  }
}

export const createWindowsMediaSessionClient = (): MusicPlaybackClient => {
  const helper = new WindowsMediaHelperProcess();
  let inFlight: Promise<TrackInfo | null> | null = null;

  const getCurrentTrack = async (): Promise<TrackInfo | null> => {
    inFlight ??= helper
      .request()
      .then((response) => {
        if (response.kind === 'none') {
          return null;
        }

        if (response.kind === 'error') {
          throw new Error(response.message);
        }

        if (
          response.sourceAppUserModelId &&
          !isAppleMusicSourceAppId(response.sourceAppUserModelId)
        ) {
          return null;
        }

        return normalizeHelperTrack(response);
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  };

  return Object.freeze({
    getCurrentTrack
  });
};
