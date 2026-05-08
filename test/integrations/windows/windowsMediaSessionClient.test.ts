import { describe, expect, it } from 'vitest';
import {
  isAppleMusicSourceAppId,
  normalizeHelperTrack,
  parseHelperResponse
} from '../../../src/integrations/windows/windowsMediaSessionClient.js';

describe('isAppleMusicSourceAppId', () => {
  it('detects Apple Music source app identifiers', () => {
    expect(isAppleMusicSourceAppId('AppleInc.AppleMusicWin_nzyj5cx40ttqa!AppleMusic')).toBe(true);
  });

  it('detects legacy iTunes identifiers', () => {
    expect(isAppleMusicSourceAppId('iTunes.exe')).toBe(true);
  });

  it('ignores unrelated media sessions', () => {
    expect(isAppleMusicSourceAppId('Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic')).toBe(
      false
    );
  });
});

describe('parseHelperResponse', () => {
  it('parses none responses', () => {
    expect(parseHelperResponse('{"kind":"none"}')).toEqual({ kind: 'none' });
  });

  it('parses error responses with a fallback message', () => {
    expect(parseHelperResponse('{"kind":"error"}')).toEqual({
      kind: 'error',
      message: 'Windows media helper failed'
    });
  });

  it('parses track responses', () => {
    expect(
      parseHelperResponse(
        JSON.stringify({
          kind: 'track',
          title: 'Song',
          artist: 'Artist',
          album: 'Album',
          status: 'playing',
          durationSeconds: 180,
          positionSeconds: 30,
          sourceAppUserModelId: 'AppleInc.AppleMusicWin_nzyj5cx40ttqa!AppleMusic'
        })
      )
    ).toEqual({
      kind: 'track',
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      status: 'playing',
      durationSeconds: 180,
      positionSeconds: 30,
      sourceAppUserModelId: 'AppleInc.AppleMusicWin_nzyj5cx40ttqa!AppleMusic'
    });
  });

  it('rejects unexpected response shapes', () => {
    expect(() => parseHelperResponse('{"kind":"unknown"}')).toThrow(
      'Unexpected Windows media helper response'
    );
  });
});

describe('normalizeHelperTrack', () => {
  it('maps a helper track to TrackInfo', () => {
    expect(
      normalizeHelperTrack({
        kind: 'track',
        title: ' Song ',
        artist: ' Artist ',
        album: ' Album ',
        status: 'playing',
        durationSeconds: 180,
        positionSeconds: 30
      })
    ).toEqual({
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      status: 'playing',
      durationSeconds: 180,
      positionSeconds: 30
    });
  });

  it('falls back for missing artist and invalid timing', () => {
    expect(
      normalizeHelperTrack({
        kind: 'track',
        title: 'Song',
        artist: '',
        album: '',
        status: 'paused',
        durationSeconds: Number.NaN,
        positionSeconds: -1
      })
    ).toEqual({
      title: 'Song',
      artist: 'Unknown Artist',
      album: '',
      status: 'paused',
      durationSeconds: 0,
      positionSeconds: 0
    });
  });

  it('removes a duplicated album suffix from Apple Music for Windows artist metadata', () => {
    expect(
      normalizeHelperTrack({
        kind: 'track',
        title: 'IF YOU',
        artist: 'BIGBANG \u2014 MADE',
        album: 'MADE',
        status: 'playing',
        durationSeconds: 264,
        positionSeconds: 160
      })
    ).toEqual({
      title: 'IF YOU',
      artist: 'BIGBANG',
      album: 'MADE',
      status: 'playing',
      durationSeconds: 264,
      positionSeconds: 160
    });
  });

  it('splits Apple Music for Windows artist metadata when the album field is empty', () => {
    expect(
      normalizeHelperTrack({
        kind: 'track',
        title: 'IF YOU',
        artist: 'BIGBANG \u2014 MADE',
        album: '',
        status: 'playing',
        durationSeconds: 264,
        positionSeconds: 160,
        sourceAppUserModelId: 'AppleInc.AppleMusicWin_nzyj5cx40ttqa!AppleMusic'
      })
    ).toEqual({
      title: 'IF YOU',
      artist: 'BIGBANG',
      album: 'MADE',
      status: 'playing',
      durationSeconds: 264,
      positionSeconds: 160
    });
  });

  it('splits Apple Music for Windows compact artist-album separators', () => {
    expect(
      normalizeHelperTrack({
        kind: 'track',
        title: 'IF YOU',
        artist: 'BIGBANG-MADE',
        album: '',
        status: 'playing',
        durationSeconds: 264,
        positionSeconds: 160,
        sourceAppUserModelId: 'iTunes.exe'
      })
    ).toEqual({
      title: 'IF YOU',
      artist: 'BIGBANG',
      album: 'MADE',
      status: 'playing',
      durationSeconds: 264,
      positionSeconds: 160
    });
  });

  it('keeps artist separators that do not duplicate the album', () => {
    expect(
      normalizeHelperTrack({
        kind: 'track',
        title: 'Song',
        artist: 'Artist \u2014 Featured Artist',
        album: 'Album',
        status: 'playing',
        durationSeconds: 180,
        positionSeconds: 30
      })?.artist
    ).toBe('Artist \u2014 Featured Artist');
  });

  it('does not split empty-album metadata from unrelated media sessions', () => {
    expect(
      normalizeHelperTrack({
        kind: 'track',
        title: 'Song',
        artist: 'Artist \u2014 Featured Artist',
        album: '',
        status: 'playing',
        durationSeconds: 180,
        positionSeconds: 30,
        sourceAppUserModelId: 'Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic'
      })
    ).toEqual({
      title: 'Song',
      artist: 'Artist \u2014 Featured Artist',
      album: '',
      status: 'playing',
      durationSeconds: 180,
      positionSeconds: 30
    });
  });

  it('returns null for stopped playback', () => {
    expect(
      normalizeHelperTrack({
        kind: 'track',
        title: 'Song',
        artist: 'Artist',
        album: 'Album',
        status: 'stopped',
        durationSeconds: 180,
        positionSeconds: 30
      })
    ).toBeNull();
  });

  it('returns null when title is missing', () => {
    expect(
      normalizeHelperTrack({
        kind: 'track',
        title: '',
        artist: 'Artist',
        album: 'Album',
        status: 'playing',
        durationSeconds: 180,
        positionSeconds: 30
      })
    ).toBeNull();
  });
});
