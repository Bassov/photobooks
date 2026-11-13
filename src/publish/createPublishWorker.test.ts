import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPublishWorker } from './createPublishWorker'

describe('createPublishWorker', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('constructs a module Worker for publish.worker.ts', () => {
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

    const worker = createPublishWorker()

    expect(worker).toBeInstanceOf(CapturingWorker)
    expect(calls).toHaveLength(1)
    const [url, options] = calls[0] ?? []
    expect(String(url)).toMatch(/publish\.worker\.ts(?:\?|$)/)
    expect(options).toEqual({ type: 'module' })
  })
})
