import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSiteExportWorker } from './createSiteExportWorker'

describe('createSiteExportWorker', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('constructs a module Worker for site-export.worker.ts', () => {
    const calls: unknown[][] = []
    class CapturingWorker {
      constructor(...args: unknown[]) {
        calls.push(args)
      }

      terminate(): void {
        // no-op
      }
    }
    vi.stubGlobal('Worker', CapturingWorker)

    const worker = createSiteExportWorker()

    expect(worker).toBeInstanceOf(CapturingWorker)
    expect(calls).toHaveLength(1)
    const [url, options] = calls[0] ?? []
    expect(String(url)).toMatch(/site-export\.worker\.ts(?:\?|$)/)
    expect(options).toEqual({ type: 'module' })
  })
})
