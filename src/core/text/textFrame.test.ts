import assert from 'node:assert/strict'
import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { formatCaptureDate } from './resolveText'
import {
  type Asset,
  type Book,
  type Frame,
  CURRENT_SCHEMA_VERSION,
  migrateToCurrent,
  parseBook,
  resolveTextItems,
  serializeBook,
  TEXT_STYLE_IDS,
} from '../index'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'

const itemsOf = (book: Book, index: number) => {
  const spread = book.spreads[index]
  assert(spread)
  return resolveTextItems(book, spread)
}

const textFrame = (overrides: Partial<Frame> = {}): Frame =>
  makeFrame({ id: 't1', z: 1, kind: 'text', ...overrides })

describe('v5 to v6', () => {
  const v5 = (frames: unknown[]) => ({
    ...makeBook(),
    schemaVersion: 5,
    spreads: [{ id: 's1', frames }],
  })
  const frameV5 = {
    id: 'f1',
    rect: { x: 0, y: 0, width: 10, height: 10 },
    z: 0,
    rotationDeg: 0,
  }

  it('marks every frame as an image frame and keeps its fields', () => {
    const result = migrateToCurrent(v5([frameV5]))
    assert.equal(result.ok, true)
    expect(
      (result.value as { spreads: { frames: unknown[] }[] }).spreads[0]?.frames,
    ).toEqual([{ ...frameV5, kind: 'image' }])
  })

  it('keeps an existing kind and tolerates odd shapes', () => {
    const result = migrateToCurrent({
      ...makeBook(),
      schemaVersion: 5,
      spreads: [
        { id: 's1', frames: [{ ...frameV5, kind: 'text' }, null] },
        null,
        { id: 's2' },
      ],
    })
    assert.equal(result.ok, true)
    expect((result.value as { spreads: unknown[] }).spreads).toEqual([
      { id: 's1', frames: [{ ...frameV5, kind: 'text' }, null] },
      null,
      { id: 's2' },
    ])
  })

  it('leaves non-array spreads alone', () => {
    const result = migrateToCurrent({
      ...makeBook(),
      schemaVersion: 5,
      spreads: 'none',
    })
    assert.equal(result.ok, true)
    expect(result.value).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      spreads: 'none',
    })
  })

  it('parses into a valid current book', () => {
    const result = parseBook(v5([frameV5]))
    assert.equal(result.ok, true)
    expect(result.book.spreads[0]?.frames[0]?.kind).toBe('image')
  })
})

describe('text frame schema', () => {
  it('round-trips a full text frame', () => {
    const book = makeBook({
      spreads: [
        makeSpread({
          frames: [
            makeFrame(),
            textFrame({
              content: { type: 'static', text: 'Hello' },
              anchorFrameId: 'frame-1',
              styleId: 'title',
              align: 'center',
            }),
          ],
        }),
      ],
    })
    const result = parseBook(serializeBook(book))
    assert.equal(result.ok, true)
    expect(result.book).toEqual(book)
  })

  it.each([
    ['kind', { kind: 'video' }],
    ['styleId', { styleId: 'huge' }],
    ['align', { align: 'justify' }],
    ['content type', { content: { type: 'dynamic' } }],
    ['anchor', { anchorFrameId: '' }],
  ])('rejects a bad %s', (_name, patch) => {
    const book = makeBook({
      spreads: [makeSpread({ frames: [makeFrame(), textFrame()] })],
    })
    const frames = book.spreads[0]?.frames as Record<string, unknown>[]
    frames[1] = { ...frames[1], ...patch }
    expect(parseBook(book)).toMatchObject({ ok: false, code: 'invalid-shape' })
  })

  it('rejects a text frame holding an asset', () => {
    const book = makeBook({
      assets: { a: {} },
      gallery: ['a'],
      spreads: [makeSpread({ frames: [textFrame({ assetId: 'a' })] })],
    })
    expect(parseBook(book)).toMatchObject({
      ok: false,
      code: 'invariant',
      violation: { code: 'text-frame-asset', frameId: 't1' },
    })
  })

  it.each([
    ['missing frame', [textFrame({ anchorFrameId: 'nope' })]],
    [
      'text target',
      [textFrame({ id: 't0' }), textFrame({ anchorFrameId: 't0' })],
    ],
    ['image source', [makeFrame({ anchorFrameId: 'frame-1' })]],
  ])('rejects an anchor to a %s', (_name, frames) => {
    const book = makeBook({ spreads: [makeSpread({ frames })] })
    expect(parseBook(book)).toMatchObject({
      ok: false,
      code: 'invariant',
      violation: { code: 'bad-text-anchor' },
    })
  })

  it('accepts an anchor to an image frame', () => {
    const book = makeBook({
      spreads: [
        makeSpread({
          frames: [makeFrame(), textFrame({ anchorFrameId: 'frame-1' })],
        }),
      ],
    })
    expect(parseBook(book).ok).toBe(true)
  })
})

describe('resolveTextItems', () => {
  const book = (frames: Frame[], title = 'Trip') =>
    makeBook({
      title,
      assets: { a: { meta: { caption: 'Beach', title: 'IMG' } }, b: {} },
      gallery: ['a', 'b'],
      spreads: [
        makeSpread({ id: 's0', frames: [] }),
        makeSpread({ id: 's1', frames }),
      ],
    })

  it('returns nothing for image-only spreads', () => {
    const b = book([makeFrame()])
    expect(itemsOf(b, 1)).toEqual([])
  })

  it('applies defaults and static content', () => {
    const b = book([
      textFrame({ content: { type: 'static', text: '{title}' } }),
    ])
    expect(itemsOf(b, 1)).toEqual([
      { frameId: 't1', text: '{title}', styleId: 'caption', align: 'left' },
    ])
  })

  it('empty text without content', () => {
    const b = book([textFrame()])
    expect(itemsOf(b, 1)[0]?.text).toBe('')
  })

  it('fills anchored tokens from the photo, not the book title', () => {
    const b = book([
      makeFrame({ assetId: 'a' }),
      textFrame({
        anchorFrameId: 'frame-1',
        styleId: 'body',
        align: 'right',
        content: {
          type: 'template',
          template: '{title}|{caption}|{spread}|{x}',
        },
      }),
    ])
    expect(itemsOf(b, 1)).toEqual([
      {
        frameId: 't1',
        text: 'IMG|Beach|2|{x}',
        styleId: 'body',
        align: 'right',
        anchorFrameId: 'frame-1',
      },
    ])
  })

  it('unanchored templates keep the book title and leave photo tokens empty', () => {
    const b = book([
      textFrame({
        content: {
          type: 'template',
          template: '{title}|{caption}|{date}|{camera}|{spread}',
        },
      }),
    ])
    expect(itemsOf(b, 1)[0]?.text).toBe('Trip||||2')
  })

  it('has no caption fallback to the title', () => {
    const asset = (assetId: string) =>
      book(
        [
          makeFrame({ assetId }),
          textFrame({
            anchorFrameId: 'frame-1',
            content: { type: 'template', template: '[{caption}]{title}' },
          }),
        ],
        '',
      )
    const b1 = asset('b')
    expect(itemsOf(b1, 1)[0]?.text).toBe('[]')
    const noTitle = makeBook({
      assets: { a: { meta: { title: 'IMG' } } },
      gallery: ['a'],
      spreads: [
        makeSpread({
          frames: [
            makeFrame({ assetId: 'a' }),
            textFrame({
              anchorFrameId: 'frame-1',
              content: { type: 'template', template: '{caption}{title}' },
            }),
          ],
        }),
      ],
    })
    expect(itemsOf(noTitle, 0)[0]?.text).toBe('IMG')
  })

  it('does not treat object prototype names as tokens', () => {
    const b = book([
      textFrame({
        content: { type: 'template', template: '{constructor}{toString}' },
      }),
    ])
    expect(itemsOf(b, 1)[0]?.text).toBe('{constructor}{toString}')
  })

  it('orders text items by z', () => {
    const b = book([
      textFrame({ id: 'hi', z: 5 }),
      makeFrame({ z: 3 }),
      textFrame({ id: 'lo', z: 2 }),
    ])
    expect(itemsOf(b, 1).map((i) => i.frameId)).toEqual(['lo', 'hi'])
  })
})

describe('live caption tokens', () => {
  const MONTH_NAMES = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(
    ' ',
  )
  const word = fc.stringMatching(/^[A-Za-z]{1,8}$/)

  const live = (asset: Asset | undefined, template: string): string => {
    const b = makeBook({
      title: 'Trip',
      assets: asset === undefined ? {} : { a: asset },
      gallery: asset === undefined ? [] : ['a'],
      spreads: [
        makeSpread({
          frames: [
            makeFrame(asset === undefined ? {} : { assetId: 'a' }),
            textFrame({
              anchorFrameId: 'frame-1',
              content: { type: 'template', template },
            }),
          ],
        }),
      ],
    })
    return itemsOf(b, 0)[0]?.text ?? 'missing'
  }

  it('fills date, title, caption and camera from the photo', () => {
    const asset: Asset = {
      capturedAt: '2025:07:12 08:35:00',
      meta: { title: 'Lake', caption: 'Dawn', camera: 'Canon EOS R5' },
    }
    expect(live(asset, '{date}|{title}|{caption}|{camera}|{spread}')).toBe(
      '12 Jul 2025|Lake|Dawn|Canon EOS R5|1',
    )
  })

  it('drops empty parts with their separator', () => {
    const asset: Asset = { capturedAt: '2025-07-12', meta: { title: 'Lake' } }
    expect(live(asset, '{title} · {date} · {caption}')).toBe(
      'Lake · 12 Jul 2025',
    )
    expect(live(asset, '{caption} · {camera} · ')).toBe('')
    expect(live(asset, '{caption} {camera} · {title}')).toBe('Lake')
    expect(live({}, '{title}')).toBe('')
  })

  it('reads the anchored frame, not the first one; a missing anchor prints dashes', () => {
    const b = (anchorFrameId: string) =>
      makeBook({
        assets: {
          a: { meta: { title: 'Lake' } },
          o: { meta: { title: 'Other' } },
        },
        gallery: ['a', 'o'],
        spreads: [
          makeSpread({
            frames: [
              makeFrame({ id: 'frame-1', assetId: 'o' }),
              makeFrame({ id: 'frame-2', assetId: 'a' }),
              textFrame({
                anchorFrameId,
                content: { type: 'template', template: '{title}' },
              }),
            ],
          }),
        ],
      })
    expect(itemsOf(b('frame-2'), 0)[0]?.text).toBe('Lake')
    expect(itemsOf(b('gone'), 0)[0]?.text).toBe('—')
  })

  it('prints a dash per photo token when the anchor has no photo', () => {
    expect(live(undefined, '{date} · {title} · {caption} · {camera}')).toBe(
      '— · — · — · —',
    )
    expect(live(undefined, '{spread} · {x}')).toBe('1 · {x}')
  })

  it('reads a photo whose asset record is missing as empty values', () => {
    const b = makeBook({
      spreads: [
        makeSpread({
          frames: [
            makeFrame({ assetId: 'gone' }),
            textFrame({
              anchorFrameId: 'frame-1',
              content: { type: 'template', template: 'At · {date}' },
            }),
          ],
        }),
      ],
    })
    expect(itemsOf(b, 0)[0]?.text).toBe('At')
  })

  it.each([
    ['2025:07:12 08:35:00', '12 Jul 2025'],
    ['2025-01-05T10:00:00', '5 Jan 2025'],
    ['2024-12-31', '31 Dec 2024'],
    ['2025-01-01', '1 Jan 2025'],
    ['2025-07-12T23:30:00Z (UTC)', '12 Jul 2025'],
    ['2025-07-12T23:30:00+0400', '12 Jul 2025'],
    ['taken 2023:02:09', '9 Feb 2023'],
    ['2025-13-01', ''],
    ['2025-00-10', ''],
    ['2025-07-00', ''],
    ['2025-07-32', ''],
    ['2025/07/12', ''],
    ['soon', ''],
    ['2025-07-12Tnope+04:00', ''],
  ])('formats %s as %j', (capturedAt, expected) => {
    expect(formatCaptureDate(capturedAt)).toBe(expected)
  })

  it('reads the local date of a zoned ISO time', () => {
    for (const iso of [
      '2025-07-12T23:30:00.000Z',
      '2025-07-12T01:30:00+04:00',
    ]) {
      const date = new Date(iso)
      const month = MONTH_NAMES[date.getMonth()] ?? ''
      expect(formatCaptureDate(iso)).toBe(
        `${String(date.getDate())} ${month} ${String(date.getFullYear())}`,
      )
    }
    expect(formatCaptureDate('')).toBe('')
  })

  test.prop(
    [
      fc.integer({ min: 1000, max: 9999 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 31 }),
      fc.constantFrom(':', '-'),
    ],
    { numRuns: Number(process.env.FC_NUM_RUNS ?? 100) },
  )('EXIF and plain dates print D Mon YYYY', (year, month, day, sep) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const raw = `${String(year)}${sep}${pad(month)}${sep}${pad(day)} 08:00:00`
    expect(formatCaptureDate(raw)).toBe(
      `${String(day)} ${MONTH_NAMES[month - 1] ?? ''} ${String(year)}`,
    )
  })

  test.prop(
    [
      fc.array(fc.constantFrom('date', 'title', 'caption', 'camera'), {
        minLength: 1,
        maxLength: 6,
      }),
      fc.record(
        {
          title: word,
          caption: word,
          camera: word,
        },
        { requiredKeys: [] },
      ),
      fc.boolean(),
    ],
    { numRuns: Number(process.env.FC_NUM_RUNS ?? 100) },
  )(
    'keeps exactly the non-empty values, joined by the separator',
    (tokens, meta, dated) => {
      const asset: Asset = {
        meta,
        ...(dated ? { capturedAt: '2025:07:12 08:35:00' } : {}),
      }
      const values: Record<string, string | undefined> = {
        ...meta,
        date: dated ? '12 Jul 2025' : undefined,
      }
      const template = tokens.map((name) => `{${name}}`).join(' · ')
      const expected = tokens.flatMap((name) => values[name] ?? [])
      expect(live(asset, template)).toBe(expected.join(' · '))
      expect(live(undefined, template)).toBe(tokens.map(() => '—').join(' · '))
    },
  )
})

const contentArb = fc.oneof(
  fc.record({ type: fc.constant('static' as const), text: fc.string() }),
  fc.record({ type: fc.constant('template' as const), template: fc.string() }),
)

test.prop(
  [
    contentArb,
    fc.constantFrom(...TEXT_STYLE_IDS),
    fc.constantFrom('left' as const, 'center' as const, 'right' as const),
    fc.boolean(),
  ],
  { numRuns: Number(process.env.FC_NUM_RUNS ?? 100) },
)(
  'text frames survive parse(serialize(book)) and v5 downgrade migrates back',
  (content, styleId, align, anchored) => {
    const book = makeBook({
      spreads: [
        makeSpread({
          frames: [
            makeFrame(),
            textFrame({
              content,
              styleId,
              align,
              ...(anchored ? { anchorFrameId: 'frame-1' } : {}),
            }),
          ],
        }),
      ],
    })
    const direct = parseBook(serializeBook(book))
    assert.equal(direct.ok, true)
    expect(direct.book).toEqual(book)

    // A v5 document stores no kind on image frames; text fields are v6-only.
    const v5 = structuredClone(book) as unknown as {
      schemaVersion: number
      spreads: { frames: Record<string, unknown>[] }[]
    }
    v5.schemaVersion = 5
    delete v5.spreads[0]?.frames[0]?.kind
    const migrated = parseBook(v5)
    assert.equal(migrated.ok, true)
    expect(migrated.book.spreads[0]?.frames[0]?.kind).toBe('image')
    expect(migrated.book.spreads[0]?.frames[1]).toEqual(
      book.spreads[0]?.frames[1],
    )
  },
)
