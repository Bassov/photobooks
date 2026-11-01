import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./scanWalk', () => ({
  walkAssetDirectory: vi.fn(),
  finalizeMemoryScanEntries: vi.fn(),
}))

import { createMemoryAssetDirectory } from './fsa/memoryDirectory'
import { finalizeMemoryScanEntries, walkAssetDirectory } from './scanWalk'

describe('scan.worker shell', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    Reflect.deleteProperty(globalThis, 'onmessage')
  })

  it('posts directory walk entries on success', async () => {
    const entries = [
      {
        relativePath: 'a.jpg',
        byteSize: 1,
        mtimeMs: 1,
        file: new File([new Uint8Array(1)], 'a.jpg'),
      },
    ]
    vi.mocked(walkAssetDirectory).mockResolvedValue(entries)

    const postMessage = vi.fn()
    Object.defineProperty(globalThis, 'postMessage', {
      configurable: true,
      value: postMessage,
    })

    await import('./scan.worker')
    const handler = (
      globalThis as typeof globalThis & {
        onmessage: ((event: MessageEvent) => void) | null
      }
    ).onmessage
    expect(handler).toBeTypeOf('function')

    const tree = createMemoryAssetDirectory()
    handler?.({
      data: { id: 'd1', kind: 'directory', directory: tree.root },
    } as MessageEvent)

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledOnce()
    })
    expect(postMessage).toHaveBeenCalledWith({
      id: 'd1',
      ok: true,
      entries,
    })
  })

  it('posts memory-file finalize entries on success', async () => {
    const files = [
      { relativePath: 'b.jpg', byteSize: 2, mtimeMs: 2 },
      { relativePath: 'a.jpg', byteSize: 1, mtimeMs: 1 },
    ]
    const sorted = [
      { relativePath: 'a.jpg', byteSize: 1, mtimeMs: 1 },
      { relativePath: 'b.jpg', byteSize: 2, mtimeMs: 2 },
    ]
    vi.mocked(finalizeMemoryScanEntries).mockReturnValue(sorted)

    const postMessage = vi.fn()
    Object.defineProperty(globalThis, 'postMessage', {
      configurable: true,
      value: postMessage,
    })

    await import('./scan.worker')
    const handler = (
      globalThis as typeof globalThis & {
        onmessage: ((event: MessageEvent) => void) | null
      }
    ).onmessage

    handler?.({
      data: { id: 'm1', kind: 'memory-files', files },
    } as MessageEvent)

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledOnce()
    })
    expect(finalizeMemoryScanEntries).toHaveBeenCalledWith(files)
    expect(postMessage).toHaveBeenCalledWith({
      id: 'm1',
      ok: true,
      entries: sorted,
    })
  })

  it('posts Error message when walk throws', async () => {
    vi.mocked(walkAssetDirectory).mockRejectedValue(new Error('walk failed'))

    const postMessage = vi.fn()
    Object.defineProperty(globalThis, 'postMessage', {
      configurable: true,
      value: postMessage,
    })

    await import('./scan.worker')
    const handler = (
      globalThis as typeof globalThis & {
        onmessage: ((event: MessageEvent) => void) | null
      }
    ).onmessage

    const tree = createMemoryAssetDirectory()
    handler?.({
      data: { id: 'e1', kind: 'directory', directory: tree.root },
    } as MessageEvent)

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledOnce()
    })
    expect(postMessage).toHaveBeenCalledWith({
      id: 'e1',
      ok: false,
      error: 'walk failed',
    })
  })

  it('posts fallback message when walk throws a non-Error', async () => {
    vi.mocked(walkAssetDirectory).mockRejectedValue('boom')

    const postMessage = vi.fn()
    Object.defineProperty(globalThis, 'postMessage', {
      configurable: true,
      value: postMessage,
    })

    await import('./scan.worker')
    const handler = (
      globalThis as typeof globalThis & {
        onmessage: ((event: MessageEvent) => void) | null
      }
    ).onmessage

    const tree = createMemoryAssetDirectory()
    handler?.({
      data: { id: 'e2', kind: 'directory', directory: tree.root },
    } as MessageEvent)

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledOnce()
    })
    expect(postMessage).toHaveBeenCalledWith({
      id: 'e2',
      ok: false,
      error: 'Scan worker failed',
    })
  })
})
