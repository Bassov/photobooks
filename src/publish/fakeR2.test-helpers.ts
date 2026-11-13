import type { R2Credentials } from './credentials'
import { REQUEST_TIMEOUT_MS } from './publishSite'

export const CREDENTIALS: R2Credentials = {
  accountId: '0123456789abcdef0123456789abcdef',
  bucket: 'my-books',
  accessKeyId: 'AKIDEXAMPLEKEY000001',
  secretAccessKey: 'wJalrXUtnFEMIK7MDENGbPxRfiCYEXAMPLEKEY01',
  publicBaseUrl: 'https://books.example.com',
}

export interface StoredObject {
  bytes: Uint8Array
  headers: Record<string, string>
}

export interface R2Event {
  type: 'start' | 'end'
  method: string
  key: string
}

/** Return a response (or throw) to replace the default answer for one request. */
export type R2Override = (
  method: string,
  key: string,
  init: RequestInit,
) => Response | undefined | Promise<Response | undefined>

export const s3Error = (status: number, code: string, headers = {}) =>
  new Response(`<Error><Code>${code}</Code></Error>`, { status, headers })

/** A Map-backed R2 bucket behind `fetch`: answers after a macrotask, logs every request. */
export function createFakeR2(initial: Record<string, StoredObject> = {}) {
  const objects = new Map(Object.entries(initial))
  const events: R2Event[] = []
  let inFlight = 0
  let maxInFlight = 0
  let override: R2Override | undefined

  const fetch = async (
    url: RequestInfo | URL,
    init: RequestInit = {},
  ): Promise<Response> => {
    const path = new URL(url instanceof Request ? url.url : url).pathname
    const prefix = `/${CREDENTIALS.bucket}/`
    const key = path
      .slice(prefix.length)
      .split('/')
      .map(decodeURIComponent)
      .join('/')
    const method = init.method ?? 'GET'
    events.push({ type: 'start', method, key })
    inFlight += 1
    maxInFlight = Math.max(maxInFlight, inFlight)
    try {
      await new Promise((resolve) => setTimeout(resolve, 0))
      const custom = await override?.(method, key, init)
      if (custom !== undefined) return custom
      if (method === 'PUT') {
        objects.set(key, {
          bytes: init.body as Uint8Array,
          headers: init.headers as Record<string, string>,
        })
        return new Response(null, { status: 200 })
      }
      if (method === 'DELETE') {
        objects.delete(key)
        return new Response(null, { status: 204 })
      }
      const object = objects.get(key)
      return object === undefined
        ? s3Error(404, 'NoSuchKey')
        : new Response(object.bytes as BodyInit, { status: 200 })
    } finally {
      inFlight -= 1
      events.push({ type: 'end', method, key })
    }
  }

  return {
    objects,
    events,
    fetch: fetch,
    get maxInFlight() {
      return maxInFlight
    },
    setOverride(next: R2Override | undefined) {
      override = next
    },
    /** Requests in start order. */
    requests: () =>
      events
        .filter((event) => event.type === 'start')
        .map((event) => `${event.method} ${event.key}`),
  }
}

/** Retry waits resolve at once and are recorded; the 30 s timeout fires only when `timeOut`. */
export function createFakeSleep(timeOut = false) {
  const waits: number[] = []
  const sleep = (ms: number, signal?: AbortSignal): Promise<void> => {
    if (ms === REQUEST_TIMEOUT_MS && !timeOut) {
      return new Promise((resolve) => {
        signal?.addEventListener('abort', () => {
          resolve()
        })
      })
    }
    if (ms !== REQUEST_TIMEOUT_MS) waits.push(ms)
    return Promise.resolve()
  }
  return { sleep, waits }
}

export const decodeText = (bytes: Uint8Array | undefined): string =>
  new TextDecoder().decode(bytes)
