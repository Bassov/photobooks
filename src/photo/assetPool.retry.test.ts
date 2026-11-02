import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DECODE_POOL_CAP,
  getDeferredLazyAssetIds,
  getPendingRetryAssetIdsForTests,
  getQueuedDecodeAssetIds,
  processAsset,
  resetAssetPool,
  runImportBatch,
  setVisibleAssetIds,
  warmAssetPool,
  type AssetProcessResult,
} from './assetPool'
import { mockWorkerSuccess } from './photo.test-helpers'
import { PREVIEW_MAX_EDGE } from './photoEdges'

function pngFile(name: string): File {
  return new File([new Uint8Array([1])], name, { type: 'image/png' })
}

function mockDecodeSuccess(): void {
  mockWorkerSuccess({
    ok: true,
    name: 'x.png',
    mimeType: 'image/png',
    byteLength: 1,
    width: 4,
    height: 3,
    correctedWidth: 4,
    correctedHeight: 3,
    orientation: 1,
    previewBuffer: new Uint8Array([1]).buffer,
    previewMimeType: 'image/png',
  })
}

const holders = Array.from(
  { length: DECODE_POOL_CAP },
  (_, i) => `hold-${String(i)}`,
)

/** Fill every decode slot so the next now job stays queued. */
function holdAllSlots(): Promise<AssetProcessResult>[] {
  return holders.map((assetId) =>
    processAsset({ assetId, file: pngFile(assetId), priority: 'visible' }),
  )
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('assetPool retry ownership (filmstrip-stuck-thumbs)', () => {
  afterEach(() => {
    resetAssetPool()
    vi.unstubAllGlobals()
  })

  it('a queued job dropped on leave-now delivers its retry result to its owner on re-entry', async () => {
    mockDecodeSuccess()
    warmAssetPool()
    setVisibleAssetIds([...holders, 'tile'])
    const held = holdAllSlots()
    const owner = vi.fn()
    const first = processAsset({
      assetId: 'tile',
      file: pngFile('tile.png'),
      priority: 'visible',
      onRetryResult: owner,
    })
    expect(getQueuedDecodeAssetIds()).toContain('tile')

    setVisibleAssetIds(holders)
    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    await Promise.all(held)
    expect(owner).not.toHaveBeenCalled()

    setVisibleAssetIds([...holders, 'tile'])
    await vi.waitFor(() => {
      expect(owner).toHaveBeenCalledTimes(1)
    })
    expect(owner).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: 'tile', correctedWidth: 4 }),
    )
    expect(getPendingRetryAssetIdsForTests()).toEqual([])
  })

  it('a call rejected for an already-aborted signal retries without that signal', async () => {
    mockDecodeSuccess()
    warmAssetPool()
    const controller = new AbortController()
    controller.abort()
    const owner = vi.fn()
    await expect(
      processAsset({
        assetId: 'late',
        file: pngFile('late.png'),
        signal: controller.signal,
        onRetryResult: owner,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(getPendingRetryAssetIdsForTests()).toEqual(['late'])

    setVisibleAssetIds(['late'])
    await vi.waitFor(() => {
      expect(owner).toHaveBeenCalledWith(
        expect.objectContaining({ assetId: 'late' }),
      )
    })
    expect(getPendingRetryAssetIdsForTests()).toEqual([])
  })

  it('a stale aborted signal on an asset already in now retries at once', async () => {
    mockDecodeSuccess()
    warmAssetPool()
    setVisibleAssetIds(['shown'])
    const controller = new AbortController()
    controller.abort()
    const owner = vi.fn()
    await expect(
      processAsset({
        assetId: 'shown',
        file: pngFile('shown.png'),
        signal: controller.signal,
        onRetryResult: owner,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })

    await vi.waitFor(() => {
      expect(owner).toHaveBeenCalledWith(
        expect.objectContaining({ assetId: 'shown' }),
      )
    })
    expect(getPendingRetryAssetIdsForTests()).toEqual([])
  })

  it('a deferred JPEG whose signal aborted before it enters now still decodes for its owner', async () => {
    mockDecodeSuccess()
    warmAssetPool()
    const controller = new AbortController()
    const owner = vi.fn()
    const deferred = processAsset({
      assetId: 'lazy',
      file: new File([new Uint8Array([1])], 'lazy.jpg', {
        type: 'image/jpeg',
      }),
      signal: controller.signal,
      onRetryResult: owner,
    })
    expect(getDeferredLazyAssetIds()).toEqual(['lazy'])
    controller.abort()

    setVisibleAssetIds(['lazy'])
    await expect(deferred).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => {
      expect(owner).toHaveBeenCalledWith(
        expect.objectContaining({ assetId: 'lazy' }),
      )
    })
  })

  it('a working-preview decode keeps a parked thumb retry; a thumb decode clears it', async () => {
    mockDecodeSuccess()
    warmAssetPool()
    const controller = new AbortController()
    controller.abort()
    await expect(
      processAsset({
        assetId: 'tier',
        file: pngFile('tier.png'),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })

    await processAsset({
      assetId: 'tier',
      file: pngFile('tier.png'),
      priority: 'zoom',
      maxEdge: PREVIEW_MAX_EDGE,
    })
    expect(getPendingRetryAssetIdsForTests()).toEqual(['tier'])

    await processAsset({
      assetId: 'tier',
      file: pngFile('tier.png'),
      priority: 'visible',
    })
    expect(getPendingRetryAssetIdsForTests()).toEqual([])
  })

  it('an import thumb dropped on leave-now reaches onResult once its tile re-enters', async () => {
    mockDecodeSuccess()
    warmAssetPool()
    setVisibleAssetIds([...holders, 'imported'])
    const held = holdAllSlots()
    const onResult = vi.fn()
    const batch = runImportBatch(
      [{ assetId: 'imported', file: pngFile('imported.png') }],
      { onResult, priority: 'visible' },
    )
    expect(getQueuedDecodeAssetIds()).toContain('imported')

    setVisibleAssetIds(holders)
    await expect(batch).resolves.toEqual({ results: [], errors: [] })
    await Promise.all(held)
    await settle()
    expect(onResult).not.toHaveBeenCalled()

    setVisibleAssetIds([...holders, 'imported'])
    await vi.waitFor(() => {
      expect(onResult).toHaveBeenCalledWith(
        expect.objectContaining({ assetId: 'imported' }),
      )
    })
  })
})
