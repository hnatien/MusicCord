import { describe, expect, it } from 'vitest';
import {
  isStaleAppleMusicStateError,
  parseMusicOutput
} from '../../../src/integrations/apple-music/appleMusicClient.js';

describe('parseMusicOutput', () => {
  it('parses playing output', () => {
    const parsed = parseMusicOutput('playing||Song||Artist||Album||207||77');
    expect(parsed).toEqual({
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      status: 'playing',
      durationSeconds: 207,
      positionSeconds: 77
    });
  });

  it('returns null for stopped output', () => {
    expect(parseMusicOutput('stopped||||||||||')).toBeNull();
  });

  it('returns null for malformed output', () => {
    expect(parseMusicOutput('unknown||a||b||c||100||10')).toBeNull();
  });

  it('uses fallback when duration is invalid', () => {
    expect(parseMusicOutput('playing||Song||Artist||Album||NaN||10')).toEqual({
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      status: 'playing',
      durationSeconds: 0,
      positionSeconds: 10
    });
  });

  it('uses fallback artist when artist is empty', () => {
    expect(parseMusicOutput('playing||Song||||Album||207||10')).toEqual({
      title: 'Song',
      artist: 'Unknown Artist',
      album: 'Album',
      status: 'playing',
      durationSeconds: 207,
      positionSeconds: 10
    });
  });

  it('parses locale decimal numbers', () => {
    expect(parseMusicOutput('playing||Song||Artist||Album||207,5||10,25')).toEqual({
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      status: 'playing',
      durationSeconds: 207.5,
      positionSeconds: 10.25
    });
  });

  it('returns null for non-normalized localized state', () => {
    expect(parseMusicOutput('dang phat||Song||Artist||Album||207||10')).toBeNull();
  });
});

describe('isStaleAppleMusicStateError', () => {
  it('detects stale current track AppleScript errors', () => {
    const error = Object.assign(new Error('Command failed: osascript'), {
      stderr: "299:303: execution error: Music got an error: Can't get name of current track. (-1728)\n"
    });

    expect(isStaleAppleMusicStateError(error)).toBe(true);
  });

  it('ignores unrelated AppleScript errors', () => {
    const error = Object.assign(new Error('Command failed: osascript'), {
      stderr: 'execution error: Not authorized to send Apple events. (-1743)\n'
    });

    expect(isStaleAppleMusicStateError(error)).toBe(false);
  });
});
