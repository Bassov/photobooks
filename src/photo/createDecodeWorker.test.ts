import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDecodeWorker } from './createDecodeWorker'

describe('createDecodeWorker', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('constructs a module Worker for photo.worker.ts', () => {
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

    const worker = createDecodeWorker()

    expect(worker).toBeInstanceOf(CapturingWorker)
    expect(calls).toHaveLength(1)
    const first = calls[0]
    expect(first).toBeDefined()
    const [url, options] = first ?? []
    expect(url).toBeInstanceOf(URL)
    expect(String(url)).toMatch(/photo\.worker\.ts(?:\?|$)/)
    expect(options).toEqual({ type: 'module' })
  })
})
