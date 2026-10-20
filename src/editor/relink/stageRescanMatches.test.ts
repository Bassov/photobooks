import { describe, expect, it } from 'vitest'
import { fc, test } from '@fast-check/vitest'

import type { MatchAssetsResult, ScannedEntry } from '../../assets'
import {
  appendScannedEntry,
  emptyRescanResult,
  locateDecision,
  progressDone,
  progressStart,
  progressTick,
  resolvePendingCount,
  scanTotal,
  stageRescanMatches,
} from './stageRescanMatches'

const HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

describe('stageRescanMatches', () => {
  it('pairs matched entries to files and skips missing files', () => {
    const entry: ScannedEntry = {
      relativePath: 'a.jpg',
      byteSize: 1,
      mtimeMs: 1,
      contentHash: HASH,
    }
    const file = new File([new Uint8Array([1])], 'a.jpg')
    const match: MatchAssetsResult = {
      matched: new Map([
        ['ok', entry],
        ['missing-file', { ...entry, relativePath: 'gone.jpg' }],
      ]),
      unmatchedAssetIds: [],
      unmatchedEntries: [],
      statuses: new Map([
        ['ok', 'ok'],
        ['missing-file', 'ok'],
      ]),
    }

    const staged = stageRescanMatches(
      match,
      new Map([['a.jpg', file]]),
      [entry],
      {},
    )

    expect(staged.matched).toEqual([{ assetId: 'ok', entry, file }])
    expect(staged.byAssetId.has('ok')).toBe(true)
    expect(staged.byAssetId.has('missing-file')).toBe(false)
  })

  it('indexes modified path hits when not already matched', () => {
    const entry: ScannedEntry = {
      relativePath: 'a.jpg',
      byteSize: 9,
      mtimeMs: 9,
      contentHash: 'ab'.repeat(32),
    }
    const file = new File([new Uint8Array(9)], 'a.jpg')
    const match: MatchAssetsResult = {
      matched: new Map(),
      unmatchedAssetIds: ['mod'],
      unmatchedEntries: [entry],
      statuses: new Map([['mod', 'modified']]),
    }

    const staged = stageRescanMatches(
      match,
      new Map([['a.jpg', file]]),
      [entry],
      { mod: { relativePath: 'a.jpg' } },
    )

    expect(staged.byAssetId.get('mod')).toEqual({ entry, file })
  })

  it('does not overwrite an existing match with a modified index', () => {
    const entry: ScannedEntry = {
      relativePath: 'a.jpg',
      byteSize: 1,
      mtimeMs: 1,
      contentHash: HASH,
    }
    const matchedFile = new File([new Uint8Array([1])], 'a.jpg')
    const other = new File([new Uint8Array([2])], 'a.jpg')
    const match: MatchAssetsResult = {
      matched: new Map([['a', entry]]),
      unmatchedAssetIds: [],
      unmatchedEntries: [],
      statuses: new Map([['a', 'modified']]),
    }
    const staged = stageRescanMatches(
      match,
      new Map([['a.jpg', matchedFile]]),
      [entry],
      { a: { relativePath: 'a.jpg' } },
    )
    expect(staged.byAssetId.get('a')?.file).toBe(matchedFile)
    expect(staged.byAssetId.get('a')?.file).not.toBe(other)
  })

  it('skips modified index when path, file, or entry is absent', () => {
    const entry: ScannedEntry = {
      relativePath: 'only-entry.jpg',
      byteSize: 1,
      mtimeMs: 1,
    }
    const fileOnly = new File([new Uint8Array([1])], 'only-file.jpg')
    const match: MatchAssetsResult = {
      matched: new Map(),
      unmatchedAssetIds: ['a', 'b', 'c', 'd', 'e'],
      unmatchedEntries: [entry],
      statuses: new Map([
        ['a', 'modified'],
        ['b', 'modified'],
        ['c', 'ok'],
        ['d', 'modified'],
        ['e', 'modified'],
      ]),
    }
    const staged = stageRescanMatches(
      match,
      new Map([['only-file.jpg', fileOnly]]),
      [entry],
      {
        a: {},
        b: { relativePath: 'missing.jpg' },
        c: { relativePath: 'c.jpg' },
        d: { relativePath: 'only-file.jpg' },
        e: { relativePath: 'only-entry.jpg' },
      },
    )
    expect(staged.byAssetId.size).toBe(0)
  })

  it('progress and empty helpers', () => {
    expect(progressStart(0)).toEqual({
      total: 1,
      completed: 0,
      running: true,
    })
    expect(progressStart(3).total).toBe(3)
    expect(progressTick(4, 2)).toEqual({
      total: 4,
      completed: 2,
      running: true,
    })
    expect(progressDone(4)).toEqual({
      total: 4,
      completed: 4,
      running: false,
    })
    expect(scanTotal(0)).toBe(1)
    expect(scanTotal(5)).toBe(5)
    expect(emptyRescanResult('r').matched).toEqual([])
  })

  it('resolvePendingCount and locateDecision', () => {
    expect(resolvePendingCount(null)).toBe(0)
    expect(resolvePendingCount({ matched: [] })).toBe(0)
    expect(resolvePendingCount({ matched: [1, 2] })).toBe(2)
    expect(locateDecision(undefined, HASH)).toBe('no-hash')
    expect(locateDecision(HASH, 'ab'.repeat(32))).toBe('hash-mismatch')
    expect(locateDecision(HASH, HASH)).toBe('ok')
  })

  it('appendScannedEntry keeps raw entry when hash is missing', () => {
    const entries: ScannedEntry[] = []
    const entry = {
      relativePath: 'a.jpg',
      byteSize: 1,
      mtimeMs: 1,
    }
    appendScannedEntry(entries, entry, undefined)
    expect(entries).toEqual([entry])
    appendScannedEntry(entries, entry, HASH)
    expect(entries[1]).toEqual({ ...entry, contentHash: HASH })
  })

  test.prop([fc.nat(20)])('scanTotal is at least 1', (n) => {
    expect(scanTotal(n)).toBeGreaterThanOrEqual(1)
  })
})
