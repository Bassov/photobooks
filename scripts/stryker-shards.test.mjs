import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import config from '../stryker.config.mjs'
import {
  SHARDS,
  parseShardIndex,
  selectFiles,
  shardMutate,
} from './stryker-shards.mjs'

/** @param {string} file @param {string} glob */
const matches = (file, glob) => path.matchesGlob(file, glob)

const sources = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)

describe('parseShardIndex', () => {
  it('is null when STRYKER_SHARD is unset or empty', () => {
    expect(parseShardIndex(undefined)).toBeNull()
    expect(parseShardIndex('')).toBeNull()
  })

  it('reads 0 and the last index', () => {
    expect(parseShardIndex('0')).toBe(0)
    expect(parseShardIndex(String(SHARDS.length - 1))).toBe(SHARDS.length - 1)
  })

  it.each(['-1', String(SHARDS.length), '1.5', 'core'])(
    'rejects "%s"',
    (raw) => {
      expect(() => parseShardIndex(raw)).toThrow(/STRYKER_SHARD must be/)
    },
  )
})

describe('shardMutate', () => {
  it('keeps every base exclude after the shard includes', () => {
    const bangs = config.mutate.filter((p) => p.startsWith('!'))
    for (let i = 0; i < SHARDS.length; i += 1) {
      expect(shardMutate(config.mutate, i).slice(-bangs.length)).toEqual(bangs)
    }
  })

  it('makes the catch-all the base includes minus every other shard', () => {
    const last = shardMutate(
      ['src/**/*.ts', '!src/x.test.ts'],
      SHARDS.length - 1,
    )
    expect(last[0]).toBe('src/**/*.ts')
    expect(last).toContain('!src/core/**/*.{ts,tsx}')
    expect(last).toContain('!src/editor/[q-z]*.{ts,tsx}')
    expect(last.at(-1)).toBe('!src/x.test.ts')
  })
})

describe('selectFiles', () => {
  it('applies patterns in order, a bang removes', () => {
    expect(
      selectFiles(
        ['src/a.ts', 'src/b.ts', 'src/b.test.ts'],
        ['src/*.ts', '!src/*.test.ts', '!src/b.ts'],
        matches,
      ),
    ).toEqual(['src/a.ts'])
  })

  it('lets a later include bring a removed file back', () => {
    expect(
      selectFiles(['src/a.ts'], ['src/*.ts', '!src/a.ts', 'src/a.ts'], matches),
    ).toEqual(['src/a.ts'])
  })
})

describe('shards over the repo', () => {
  const full = selectFiles(sources, config.mutate, matches)
  const perShard = SHARDS.map((_, i) =>
    selectFiles(sources, shardMutate(config.mutate, i), matches),
  )

  it('cover the full mutate set exactly once', () => {
    const flat = perShard.flat()
    expect(new Set(flat).size).toBe(flat.length)
    expect([...flat].sort()).toEqual([...full].sort())
  })

  it('leave no shard empty', () => {
    expect(perShard.map((files) => files.length > 0)).toEqual(
      SHARDS.map(() => true),
    )
  })
})
