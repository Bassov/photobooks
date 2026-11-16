import { describe, expect, it } from 'vitest'
import {
  CREDENTIALS,
  createFakeR2,
  createFakeSleep,
} from './fakeR2.test-helpers'
import { createPublisher } from './publisher'
import { describePublisherContract } from './publisherContract.test-helpers'
import { R2_CAPABILITIES } from './publishSite'
import { createR2Publisher } from './r2Publisher'

const NOW = new Date('2026-11-13T10:00:00Z')

function r2Deps(r2: ReturnType<typeof createFakeR2>) {
  return {
    fetch: r2.fetch,
    now: () => NOW,
    sleep: createFakeSleep().sleep,
    isOnline: () => true,
    randomHex: () => '0a1b2c3d',
  }
}

describePublisherContract('r2', () => {
  const r2 = createFakeR2()
  return {
    publisher: createR2Publisher(CREDENTIALS, r2Deps(r2)),
    stored: () =>
      new Map(
        [...r2.objects]
          .filter(([key]) => !key.startsWith('_photobooks/'))
          .map(([key, object]) => [
            key,
            {
              bytes: object.bytes,
              cacheControl: object.headers['cache-control'],
            },
          ]),
      ),
    maxInFlight: () => r2.maxInFlight,
    urlOf: (path) => new URL(path, `${CREDENTIALS.publicBaseUrl}/`).href,
  }
})

describe('createPublisher', () => {
  it('builds the R2 target with its capabilities for stored credentials', async () => {
    const r2 = createFakeR2()

    const publisher = createPublisher(CREDENTIALS, r2Deps(r2))
    const checked = await publisher.check('connect')

    expect(publisher.target).toBe('r2')
    expect(publisher.capabilities).toEqual({
      immutableCache: true,
      maxParallelUploads: 4,
      deletes: true,
    })
    expect(publisher.capabilities).toBe(R2_CAPABILITIES)
    expect(checked).toEqual({ ok: true })
    expect(r2.requests()).toEqual([
      'PUT _photobooks/check-0a1b2c3d.txt',
      'HEAD _photobooks/check-0a1b2c3d.txt',
      'DELETE _photobooks/check-0a1b2c3d.txt',
    ])
  })
})
