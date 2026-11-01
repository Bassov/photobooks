import fc from 'fast-check'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ScannedEntry } from '../../assets'
import type { SessionIdb } from './idb'
import {
  getSourceRootEntryIndex,
  patchManifestDimensions,
  persistScannedEntryIndex,
  type FolderManifestEntry,
} from './sourceRootEntryIndex'

/** Memory IDB whose get/set settle on a later macrotask, like real IDB. */
function countingIdb(): SessionIdb & {
  store: Map<string, unknown>
  writes: () => number
} {
  const store = new Map<string, unknown>()
  let writes = 0
  const later = () =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
  return {
    store,
    writes: () => writes,
    async get(key) {
      await later()
      if (!store.has(key)) {
        return { present: false as const }
      }
      return { present: true as const, value: structuredClone(store.get(key)) }
    },
    async set(key, value) {
      await later()
      writes += 1
      store.set(key, structuredClone(value))
    },
    async del(key) {
      await later()
      store.delete(key)
    },
    keys() {
      return Promise.resolve([...store.keys()])
    },
    runReadwrite() {
      return Promise.resolve()
    },
  }
}

function scannedAt(i: number): ScannedEntry {
  return {
    relativePath: `p-${String(i)}.jpg`,
    byteSize: i + 1,
    mtimeMs: 1_000 + i,
  }
}

function scannedPaths(count: number): ScannedEntry[] {
  return Array.from({ length: count }, (_, i) => scannedAt(i))
}

function dimsOf(entry: FolderManifestEntry | undefined) {
  return entry === undefined
    ? undefined
    : {
        width: entry.width,
        height: entry.height,
        orientation: entry.orientation,
      }
}

/** Let idle/timeout-scheduled flushes and their IDB round trips finish. */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('patchManifestDimensions coalescing', () => {
  it('keeps all 200 dims from concurrent patches in ≤ ceil(n/64)+2 flushes', async () => {
    const idb = countingIdb()
    const scanned = scannedPaths(200)
    await persistScannedEntryIndex('root-burst', scanned, {
      entryIndexIdb: idb,
    })
    const writesBefore = idb.writes()

    const results = await Promise.all(
      scanned.map((entry, i) =>
        patchManifestDimensions(
          'root-burst',
          { ...entry, width: 100 + i, height: 50 + i, orientation: 1 },
          { entryIndexIdb: idb },
        ),
      ),
    )
    await settle()

    expect(results.every((result) => result.ok)).toBe(true)
    const got = await getSourceRootEntryIndex('root-burst', {
      entryIndexIdb: idb,
    })
    expect(got.ok).toBe(true)
    const entries = got.ok ? got.value.entries : {}
    const withDims = scanned.filter(
      (entry) => entries[entry.relativePath]?.width !== undefined,
    )
    expect.soft(withDims).toHaveLength(200)
    expect.soft(entries['p-0.jpg']).toEqual({
      byteSize: 1,
      mtimeMs: 1_000,
      width: 100,
      height: 50,
      orientation: 1,
    })
    expect
      .soft(idb.writes() - writesBefore)
      .toBeLessThanOrEqual(Math.ceil(200 / 64) + 2)
  })

  it('flushes every 64 patches while earlier patches wait for idle', async () => {
    const idle: (() => void)[] = []
    const timeouts: (number | undefined)[] = []
    vi.stubGlobal(
      'requestIdleCallback',
      (cb: () => void, opts?: { timeout?: number }) => {
        timeouts.push(opts?.timeout)
        idle.push(cb)
        return idle.length
      },
    )
    vi.stubGlobal('cancelIdleCallback', () => undefined)
    const idb = countingIdb()
    const scanned = scannedPaths(70)
    await persistScannedEntryIndex('root-cap', scanned, { entryIndexIdb: idb })
    const writesBefore = idb.writes()

    for (const [i, entry] of scanned.slice(0, 63).entries()) {
      void patchManifestDimensions(
        'root-cap',
        { ...entry, width: 10 + i, height: 10, orientation: 1 },
        { entryIndexIdb: idb },
      )
    }
    await settle()
    // 63 pending: below the cap, so nothing is written until idle.
    expect(idb.writes() - writesBefore).toBe(0)
    expect(idle).toHaveLength(1)

    const capped = patchManifestDimensions(
      'root-cap',
      { ...scannedAt(63), width: 99, height: 99, orientation: 1 },
      { entryIndexIdb: idb },
    )
    await expect(capped).resolves.toEqual({ ok: true, value: undefined })
    expect(idb.writes() - writesBefore).toBe(1)

    const late = patchManifestDimensions(
      'root-cap',
      { ...scannedAt(64), width: 7, height: 8, orientation: 6 },
      { entryIndexIdb: idb },
    )
    await settle()
    expect(idb.writes() - writesBefore).toBe(1)
    expect(idle).toHaveLength(2)
    // `late` only resolves once this idle callback runs the flush.
    idle[1]?.()
    await expect(late).resolves.toEqual({ ok: true, value: undefined })
    expect(idb.writes() - writesBefore).toBe(2)
    expect(timeouts).toEqual([500, 500])

    const got = await getSourceRootEntryIndex('root-cap', {
      entryIndexIdb: idb,
    })
    const entries = got.ok ? got.value.entries : {}
    expect(dimsOf(entries['p-0.jpg'])).toEqual({
      width: 10,
      height: 10,
      orientation: 1,
    })
    expect(dimsOf(entries['p-63.jpg'])).toEqual({
      width: 99,
      height: 99,
      orientation: 1,
    })
    expect(dimsOf(entries['p-64.jpg'])).toEqual({
      width: 7,
      height: 8,
      orientation: 6,
    })
  })

  it('a walk persisted while patches are pending keeps their dims', async () => {
    const idb = countingIdb()
    const scanned = scannedPaths(3)
    await persistScannedEntryIndex('root-walk', scanned, {
      entryIndexIdb: idb,
    })
    const patched = patchManifestDimensions(
      'root-walk',
      { ...scannedAt(1), width: 30, height: 20, orientation: 8 },
      { entryIndexIdb: idb },
    )
    const writesBefore = idb.writes()
    const walked = await persistScannedEntryIndex('root-walk', scanned, {
      entryIndexIdb: idb,
    })
    await expect(patched).resolves.toEqual({ ok: true, value: undefined })
    await settle()

    expect(walked.ok).toBe(true)
    // The walk absorbed the pending patch: one write, no extra flush.
    expect(idb.writes() - writesBefore).toBe(1)
    const got = await getSourceRootEntryIndex('root-walk', {
      entryIndexIdb: idb,
    })
    expect(got.ok && got.value.entries['p-1.jpg']).toEqual({
      byteSize: 2,
      mtimeMs: 1_001,
      width: 30,
      height: 20,
      orientation: 8,
    })
  })

  it('PBT: interleaved patch / persist keep every latest matching patch', async () => {
    const pathCount = 5
    const op = fc.oneof(
      fc.record({
        kind: fc.constant('patch' as const),
        path: fc.nat({ max: pathCount - 1 }),
        stale: fc.boolean(),
        width: fc.integer({ min: 1, max: 5_000 }),
        orientation: fc.integer({ min: 1, max: 8 }),
        gap: fc.constantFrom('none', 'micro', 'macro'),
      }),
      fc.record({
        kind: fc.constant('persist' as const),
        gap: fc.constantFrom('none', 'micro', 'macro'),
      }),
    )
    let run = 0
    await fc.assert(
      fc.asyncProperty(fc.array(op, { maxLength: 40 }), async (ops) => {
        run += 1
        const root = `root-pbt-${String(run)}`
        const idb = countingIdb()
        const scanned = scannedPaths(pathCount)
        await persistScannedEntryIndex(root, scanned, { entryIndexIdb: idb })
        const expected = new Map<string, ReturnType<typeof dimsOf>>()
        const pending: Promise<unknown>[] = []
        for (const next of ops) {
          if (next.gap === 'micro') {
            await Promise.resolve()
          } else if (next.gap === 'macro') {
            await new Promise<void>((resolve) => {
              setTimeout(resolve, 0)
            })
          }
          if (next.kind === 'persist') {
            pending.push(
              persistScannedEntryIndex(root, scanned, { entryIndexIdb: idb }),
            )
            continue
          }
          const entry = scannedAt(next.path)
          const dims = {
            width: next.width,
            height: next.width + 1,
            orientation: next.orientation,
          }
          pending.push(
            patchManifestDimensions(
              root,
              {
                ...entry,
                byteSize: next.stale ? entry.byteSize + 1 : entry.byteSize,
                ...dims,
              },
              { entryIndexIdb: idb },
            ),
          )
          if (!next.stale) {
            expected.set(entry.relativePath, dims)
          }
        }
        await Promise.all(pending)
        await settle()

        const got = await getSourceRootEntryIndex(root, { entryIndexIdb: idb })
        expect(got.ok).toBe(true)
        const entries = got.ok ? got.value.entries : {}
        for (const entry of scanned) {
          const actual = entries[entry.relativePath]
          expect(actual?.byteSize).toBe(entry.byteSize)
          expect(actual?.mtimeMs).toBe(entry.mtimeMs)
          const want = expected.get(entry.relativePath)
          expect(dimsOf(actual)).toEqual(
            want ?? {
              width: undefined,
              height: undefined,
              orientation: undefined,
            },
          )
        }
      }),
      { numRuns: 60 },
    )
  })
})
