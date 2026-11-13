import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import {
  publishFailAction,
  publishFailText,
  publishHostLine,
  publishPercent,
  publishPhaseLabel,
  publishRunningTitle,
  publishStatusText,
  publishSummaryText,
  type PublishFailCode,
  type PublishFailure,
  type PublishPhase,
} from './publishText'

const PHASES: readonly PublishPhase[] = [
  'prepare',
  'render',
  'upload',
  'finish',
]

const fail = (
  code: PublishFailCode,
  extra: Partial<PublishFailure> = {},
): PublishFailure => ({ code, message: '', sent: 0, total: 0, ...extra })

describe('publishPercent', () => {
  it('maps each phase into its band', () => {
    expect(publishPercent('prepare', 0, 4)).toBe(0)
    expect(publishPercent('prepare', 2, 4)).toBe(20)
    expect(publishPercent('render', 0, 1)).toBe(40)
    expect(publishPercent('upload', 0, 100)).toBe(50)
    expect(publishPercent('upload', 50, 100)).toBe(72)
    expect(publishPercent('upload', 100, 100)).toBe(95)
    expect(publishPercent('finish', 1, 2)).toBe(97)
    expect(publishPercent('finish', 2, 2)).toBe(100)
  })

  it('counts an empty phase as done and clamps overshoot', () => {
    expect(publishPercent('upload', 0, 0)).toBe(95)
    expect(publishPercent('prepare', 9, 4)).toBe(40)
    expect(publishPercent('upload', -3, 10)).toBe(50)
  })

  test.prop([
    fc.constantFrom(...PHASES),
    fc.nat(1000),
    fc.nat(1000),
    fc.nat(1000),
  ])(
    'is an integer within 0–100 that grows with done and across phases',
    (phase, a, b, total) => {
      const [low, high] = a <= b ? [a, b] : [b, a]
      const first = publishPercent(phase, low, total)
      const second = publishPercent(phase, high, total)
      expect(Number.isInteger(first)).toBe(true)
      expect(first).toBeGreaterThanOrEqual(0)
      expect(second).toBeLessThanOrEqual(100)
      expect(second).toBeGreaterThanOrEqual(first)
      const next = PHASES[PHASES.indexOf(phase) + 1]
      if (next !== undefined) {
        expect(publishPercent(next, 0, total)).toBeGreaterThanOrEqual(second)
      }
    },
  )
})

describe('run texts', () => {
  it('labels the phase by percent band', () => {
    expect(publishPhaseLabel(0)).toBe('Rendering web images')
    expect(publishPhaseLabel(49)).toBe('Rendering web images')
    expect(publishPhaseLabel(50)).toBe('Uploading changed files')
    expect(publishPhaseLabel(94)).toBe('Uploading changed files')
    expect(publishPhaseLabel(95)).toBe('Finishing')
  })

  it('titles and announces the running pill', () => {
    expect(publishRunningTitle(42)).toBe('Publishing · 42%')
    expect(publishStatusText(40)).toBe('Publishing, 40%')
  })

  it('names the host, with the other books when there are any', () => {
    expect(publishHostLine('Lake', 'books.example.com', true)).toEqual({
      before: '“Lake” goes to ',
      host: 'books.example.com',
      after: ' with the other published books.',
    })
    expect(publishHostLine('Lake', 'books.example.com', false).after).toBe('.')
  })
})

describe('publishSummaryText', () => {
  it('counts uploads, MB, removals and unchanged files', () => {
    expect(
      publishSummaryText({
        uploaded: 14,
        bytes: 3_210_000,
        removed: 0,
        unchanged: 186,
      }),
    ).toBe('14 changed files uploaded · 3.2 MB. 186 were already up to date.')
    expect(
      publishSummaryText({
        uploaded: 1,
        bytes: 40_000,
        removed: 2,
        unchanged: 1,
      }),
    ).toBe(
      '1 changed file uploaded · 0.0 MB, 2 removed. 1 was already up to date.',
    )
  })

  it('says nothing changed when nothing went up', () => {
    expect(
      publishSummaryText({ uploaded: 0, bytes: 0, removed: 3, unchanged: 9 }),
    ).toBe('Nothing changed since the last publish.')
  })
})

describe('failed step', () => {
  it('retries transient causes and sends the rest to Hosting', () => {
    const retry: PublishFailCode[] = ['offline', 'timeout', 'other', 'build']
    const hosting: PublishFailCode[] = [
      'cors',
      'key',
      'denied',
      'bucket',
      'unconnected',
    ]
    for (const code of retry) expect(publishFailAction(code)).toBe('retry')
    for (const code of hosting) expect(publishFailAction(code)).toBe('hosting')
  })

  it('words every cause per §2', () => {
    const text = (code: PublishFailCode, extra?: Partial<PublishFailure>) =>
      publishFailText(fail(code, extra), 'my-books')
    expect(text('offline')).toBe(
      "You're offline. Connect to the internet and try again.",
    )
    expect(text('timeout')).toBe("Cloudflare didn't answer in 30 seconds.")
    expect(text('cors')).toBe(
      'Cloudflare blocked the upload from this page. Check the CORS policy in Settings → Hosting.',
    )
    expect(text('key')).toBe(
      "Cloudflare doesn't recognise this key. It may have been deleted or rolled. Replace the token in Settings → Hosting.",
    )
    expect(text('denied')).toBe(
      "This token can't write to “my-books”. Give it Object Read & Write on this bucket.",
    )
    expect(text('bucket')).toBe("There's no bucket “my-books” in this account.")
    expect(text('build')).toBe(
      'Something went wrong while preparing the site. Try again.',
    )
    expect(text('unconnected')).toBe(
      'Connect your hosting in Settings → Hosting first.',
    )
  })

  it('takes the S3 answer from the worker message, else the status', () => {
    expect(
      publishFailText(
        fail('other', {
          status: 503,
          message:
            'Cloudflare answered 503 SlowDown. Check the values and try again.',
        }),
        'b',
      ),
    ).toBe('Cloudflare answered 503 SlowDown.')
    expect(
      publishFailText(
        fail('other', {
          status: 502,
          message: 'Proxy said: Cloudflare answered 502 X. Check.',
        }),
        'b',
      ),
    ).toBe('Cloudflare answered 502.')
    expect(publishFailText(fail('other', { status: 500 }), 'b')).toBe(
      'Cloudflare answered 500.',
    )
    expect(publishFailText(fail('other'), 'b')).toBe(
      'Something went wrong. Try again.',
    )
  })

  it('adds "s of t" only when a retry sends the rest', () => {
    expect(publishFailText(fail('timeout', { sent: 12, total: 40 }), 'b')).toBe(
      "Cloudflare didn't answer in 30 seconds. 12 of 40 files went up. Try again to send the rest.",
    )
    expect(publishFailText(fail('timeout', { sent: 0, total: 40 }), 'b')).toBe(
      "Cloudflare didn't answer in 30 seconds.",
    )
    expect(publishFailText(fail('key', { sent: 3, total: 9 }), 'b')).toBe(
      "Cloudflare doesn't recognise this key. It may have been deleted or rolled. Replace the token in Settings → Hosting.",
    )
  })
})
