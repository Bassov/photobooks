import { describe, expect, it } from 'vitest'

import { CURRENT_SCHEMA_VERSION, serializeBook } from '../../core'
import { makeBook } from '../../core/testing/fixtures'
import { processBookLoadRequest } from './bookLoad'
import { createBookLoadWorker } from './bookLoadWorkerClient'
import { createFsaLibraryStorage } from './fsaLibraryStorage'
import { createMemoryDirectory } from './memoryDirectory'

describe('processBookLoadRequest', () => {
  it('returns a book for valid JSON', () => {
    const book = makeBook({ id: 'load-ok' })
    const result = processBookLoadRequest({
      id: 'r1',
      text: JSON.stringify(serializeBook(book)),
    })
    expect(result).toEqual({ ok: true, id: 'r1', book })
  })

  it('returns corrupted for invalid JSON and invalid books', () => {
    expect(processBookLoadRequest({ id: 'r2', text: '{' })).toEqual({
      ok: false,
      id: 'r2',
      code: 'corrupted',
    })
    expect(
      processBookLoadRequest({ id: 'r3', text: '{"not":"a-book"}' }),
    ).toEqual({
      ok: false,
      id: 'r3',
      code: 'corrupted',
    })
  })

  it('returns newer-schema for unsupported schemaVersion', () => {
    const book = makeBook({ id: 'future' })
    const serialized = serializeBook(book)
    expect(serialized).toBeTypeOf('object')
    const result = processBookLoadRequest({
      id: 'r4',
      text: JSON.stringify({
        ...(serialized as object),
        schemaVersion: CURRENT_SCHEMA_VERSION + 1,
      }),
    })
    expect(result).toEqual({ ok: false, id: 'r4', code: 'newer-schema' })
  })
})

function createRecordingWorker(options?: {
  delayMs?: number
  fail?: boolean
}): {
  factory: () => Worker
  posted: { id: string; text: string }[]
} {
  const posted: { id: string; text: string }[] = []
  const delayMs = options?.delayMs ?? 0
  const fail = options?.fail ?? false

  class RecordingWorker {
    private messageListener: ((event: MessageEvent) => void) | null = null
    private errorListener: ((event: ErrorEvent) => void) | null = null

    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
    ): void {
      if (type === 'message' && typeof listener === 'function') {
        this.messageListener = (event: MessageEvent) => {
          listener(event)
        }
      }
      if (type === 'error' && typeof listener === 'function') {
        this.errorListener = (event: ErrorEvent) => {
          listener(event)
        }
      }
    }

    removeEventListener(type: string): void {
      if (type === 'message') {
        this.messageListener = null
      }
      if (type === 'error') {
        this.errorListener = null
      }
    }

    postMessage(data: { id: string; text: string }): void {
      posted.push(data)
      if (fail) {
        this.errorListener?.({ message: 'boom' } as ErrorEvent)
        return
      }
      const respond = () => {
        const result = processBookLoadRequest(data)
        this.messageListener?.({ data: result } as MessageEvent)
      }
      if (delayMs > 0) {
        setTimeout(respond, delayMs)
      } else {
        respond()
      }
    }

    terminate(): void {
      this.messageListener = null
      this.errorListener = null
    }
  }

  return {
    posted,
    factory: () => new RecordingWorker() as unknown as Worker,
  }
}

describe('createBookLoadWorker', () => {
  it('posts text and resolves with the worker response for valid, corrupt, and newer-schema', async () => {
    const book = makeBook({ id: 'worker-ok' })
    const { factory, posted } = createRecordingWorker()
    const client = createBookLoadWorker(factory)

    await expect(
      client.loadBookText(JSON.stringify(serializeBook(book))),
    ).resolves.toMatchObject({ ok: true, book })
    await expect(client.loadBookText('{')).resolves.toMatchObject({
      ok: false,
      code: 'corrupted',
    })
    const serialized = serializeBook(book)
    await expect(
      client.loadBookText(
        JSON.stringify({
          ...(serialized as object),
          schemaVersion: CURRENT_SCHEMA_VERSION + 1,
        }),
      ),
    ).resolves.toMatchObject({ ok: false, code: 'newer-schema' })

    expect(posted).toHaveLength(3)
    expect(posted[0]?.text).toContain(book.id)
    client.terminate()
  })

  it('correlates concurrent loads by request id', async () => {
    const slow = makeBook({ id: 'slow-book' })
    const fast = makeBook({ id: 'fast-book' })
    const { factory } = createRecordingWorker({ delayMs: 20 })
    const client = createBookLoadWorker(factory)

    const [slowResult, fastResult] = await Promise.all([
      client.loadBookText(JSON.stringify(serializeBook(slow))),
      client.loadBookText(JSON.stringify(serializeBook(fast))),
    ])

    expect(slowResult).toMatchObject({ ok: true, book: slow })
    expect(fastResult).toMatchObject({ ok: true, book: fast })
    client.terminate()
  })

  it('rejects when the worker emits an error event', async () => {
    const { factory } = createRecordingWorker({ fail: true })
    const client = createBookLoadWorker(factory)
    await expect(client.loadBookText('{}')).rejects.toThrow(/boom/)
    client.terminate()
  })
})

describe('createFsaLibraryStorage default worker load', () => {
  it('uses the default worker loader (postMessage text only) when loadBookText is omitted', async () => {
    const book = makeBook({ id: 'default-worker-load' })
    const root = createMemoryDirectory()
    const { factory, posted } = createRecordingWorker()

    const storage = createFsaLibraryStorage({
      root,
      workerFactory: factory,
    })
    await storage.createBook(book)
    posted.length = 0

    const loaded = await storage.loadBook(book.id)
    expect(loaded).toEqual({ ok: true, value: book })
    expect(posted).toHaveLength(1)
    expect(posted[0]?.text).toContain(book.id)
    expect(posted[0]?.id).toMatch(/^book-load-/)
  })
})
