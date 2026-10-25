import { describe, expect, it } from 'vitest'

import type { AssetSource } from './types'

export interface AssetSourceContractHarness {
  source: AssetSource
  rootId: string
  relativePath: string
  fileBytes: ArrayBuffer
  mtimeMs: number
  setPermissionRequired: (required: boolean) => void
  seedCorrupted: (rootId: string, relativePath: string) => void | Promise<void>
}

export function runAssetSourceContract(
  createHarness: () => AssetSourceContractHarness,
): void {
  describe('AssetSource contract', () => {
    it('scans a registered root and lists domain entries', async () => {
      const harness = createHarness()

      const scanned = await harness.source.scanRoot(harness.rootId)

      expect(scanned).toEqual({
        ok: true,
        value: [
          {
            relativePath: harness.relativePath,
            byteSize: harness.fileBytes.byteLength,
            mtimeMs: harness.mtimeMs,
          },
        ],
      })
    })

    it('reads bytes for hashing without exposing handles', async () => {
      const harness = createHarness()

      const read = await harness.source.readForHash(
        harness.rootId,
        harness.relativePath,
      )

      expect(read.ok).toBe(true)
      if (read.ok) {
        expect(new Uint8Array(read.value)).toEqual(
          new Uint8Array(harness.fileBytes),
        )
      }
    })

    it('resolves a File without requiring a body read by the caller', async () => {
      const harness = createHarness()

      const resolved = await harness.source.resolveFile(
        harness.rootId,
        harness.relativePath,
      )

      expect(resolved.ok).toBe(true)
      if (resolved.ok) {
        const slash = harness.relativePath.lastIndexOf('/')
        const basename =
          slash >= 0
            ? harness.relativePath.slice(slash + 1)
            : harness.relativePath
        expect(resolved.value.name).toBe(basename)
        expect(resolved.value.size).toBe(harness.fileBytes.byteLength)
        expect(resolved.value.lastModified).toBe(harness.mtimeMs)
      }
    })

    it('returns not-found for an unknown root on scan and read', async () => {
      const harness = createHarness()

      expect(await harness.source.scanRoot('missing-root')).toEqual({
        ok: false,
        code: 'not-found',
      })
      expect(
        await harness.source.readForHash('missing-root', harness.relativePath),
      ).toEqual({ ok: false, code: 'not-found' })
      expect(
        await harness.source.resolveFile('missing-root', harness.relativePath),
      ).toEqual({ ok: false, code: 'not-found' })
    })

    it('returns not-found when reading a missing relative path', async () => {
      const harness = createHarness()

      expect(
        await harness.source.readForHash(harness.rootId, 'missing/file.jpg'),
      ).toEqual({ ok: false, code: 'not-found' })
      expect(
        await harness.source.resolveFile(harness.rootId, 'missing/file.jpg'),
      ).toEqual({ ok: false, code: 'not-found' })
    })

    it('returns permission-required when permission is required', async () => {
      const harness = createHarness()
      harness.setPermissionRequired(true)

      expect(await harness.source.scanRoot(harness.rootId)).toEqual({
        ok: false,
        code: 'permission-required',
      })
      expect(
        await harness.source.readForHash(harness.rootId, harness.relativePath),
      ).toEqual({ ok: false, code: 'permission-required' })
      expect(
        await harness.source.resolveFile(harness.rootId, harness.relativePath),
      ).toEqual({ ok: false, code: 'permission-required' })
    })

    it('returns corrupted when reading a corrupted entry', async () => {
      const harness = createHarness()
      await harness.seedCorrupted(harness.rootId, 'broken.bin')

      expect(
        await harness.source.readForHash(harness.rootId, 'broken.bin'),
      ).toEqual({ ok: false, code: 'corrupted' })
      expect(
        await harness.source.resolveFile(harness.rootId, 'broken.bin'),
      ).toEqual({ ok: false, code: 'corrupted' })
    })
  })
}
