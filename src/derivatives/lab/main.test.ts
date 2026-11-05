import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LabRequest } from './runLab'

/** Worker double: answers every fixture with one 8×8 WebP variant. */
function stubWorker() {
  const constructed: [URL, WorkerOptions | undefined][] = []
  class FakeWorker {
    onmessage: ((event: MessageEvent) => void) | null = null
    constructor(url: URL, options?: WorkerOptions) {
      constructed.push([url, options])
    }
    postMessage({ fixture }: LabRequest) {
      queueMicrotask(() => {
        this.onmessage?.(
          new MessageEvent('message', {
            data: {
              fixture,
              ok: true,
              variants: [
                {
                  fixture,
                  preset: {
                    id: '8-webp-q80',
                    maxEdge: 8,
                    mimeType: 'image/webp',
                    quality: 0.8,
                  },
                  width: 8,
                  height: 8,
                  byteLength: 4,
                  ssim: 1,
                  bandStep: 0,
                  bytes: new ArrayBuffer(4),
                  mimeType: 'image/webp',
                },
              ],
            },
          }),
        )
      })
    }
  }
  vi.stubGlobal('Worker', FakeWorker)
  const createObjectURL = vi.fn(() => 'blob:lab')
  vi.spyOn(URL, 'createObjectURL').mockImplementation(createObjectURL)
  return { constructed, createObjectURL }
}

afterEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('derivative lab entry', () => {
  it('starts the lab worker as a module and renders into #lab', async () => {
    document.body.innerHTML = '<main id="lab"></main>'
    const { constructed, createObjectURL } = stubWorker()

    await import('./main')

    const root = document.getElementById('lab')
    await vi.waitFor(() => {
      expect(root?.dataset.labState).toBe('done')
    })
    expect(constructed).toHaveLength(1)
    expect(constructed[0]?.[0].pathname).toBe(
      '/src/derivatives/lab/lab.worker.ts',
    )
    expect(constructed[0]?.[1]).toEqual({ type: 'module' })
    expect(createObjectURL).toHaveBeenCalledTimes(3)
    expect(root?.querySelector('img')?.getAttribute('src')).toBe('blob:lab')
  })

  it('does nothing on a page without #lab', async () => {
    const { constructed } = stubWorker()

    await import('./main')

    expect(constructed).toEqual([])
  })
})
