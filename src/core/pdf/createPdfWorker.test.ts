import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPdfWorker } from './createPdfWorker'

describe('createPdfWorker', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('constructs a module Worker for pdf.worker.ts', () => {
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

    const worker = createPdfWorker()

    expect(worker).toBeInstanceOf(CapturingWorker)
    expect(calls).toHaveLength(1)
    const [url, options] = calls[0] ?? []
    expect(String(url)).toMatch(/pdf\.worker\.ts(?:\?|$)/)
    expect(options).toEqual({ type: 'module' })
  })
})
