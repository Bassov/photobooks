import assert from 'node:assert/strict'
import { describe, expect, it } from 'vitest'
import {
  genericPrintProfile,
  parsePrintProfile,
  photoPages,
  preflight,
  preflightRules,
  type Book,
  type Frame,
  type PreflightAssetStatus,
  type PreflightCoverOptions,
  type PrintProfile,
  type PrintProfileInput,
} from '../index'
import { spreadsForPages } from '../pages'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'

const generic = genericPrintProfile()
const CENTER = { x: 0.5, y: 0.5 }

/** 200 × 200 mm trim, 3 mm bleed, `pages` printed pages; spread `s1` (pages 2–3, 400 mm wide) holds `frames`. */
function bookWith(frames: Frame[], pages = 20): Book {
  const spreadCount = spreadsForPages(pages)
  return makeBook({
    settings: { trim: { widthMm: 200, heightMm: 200 }, bleedMm: 3 },
    assets: {
      sharp: { widthPx: 6000, heightPx: 6000 },
      soft: { widthPx: 700, heightPx: 700 },
      blurry: { widthPx: 500, heightPx: 500 },
    },
    gallery: ['sharp', 'soft', 'blurry'],
    spreads: Array.from({ length: spreadCount }, (_, i) =>
      makeSpread({ id: `s${String(i)}`, frames: i === 1 ? frames : [] }),
    ),
  })
}

function photo(overrides: Partial<Frame> = {}): Frame {
  return makeFrame({
    id: 'photo',
    rect: { x: 50, y: 50, width: 100, height: 100 },
    assetId: 'sharp',
    crop: { zoom: 1, center: CENTER },
    ...overrides,
  })
}

function text(value: string, overrides: Partial<Frame> = {}): Frame {
  return makeFrame({
    id: 'text',
    kind: 'text',
    rect: { x: 50, y: 50, width: 100, height: 20 },
    content: { type: 'static', text: value },
    ...overrides,
  })
}

function profileWith(overrides: Partial<PrintProfileInput>): PrintProfile {
  const parsed = parsePrintProfile({ ...generic, id: 'lab', ...overrides })
  assert(parsed.ok)
  return parsed.profile
}

function rules(
  book: Book,
  profile = generic,
  assetStatus?: ReadonlyMap<string, PreflightAssetStatus>,
) {
  return preflight(
    book,
    profile,
    assetStatus === undefined ? {} : { assetStatus },
  ).map((found) => found.rule)
}

describe('preflight rule table', () => {
  it('pins every severity and fix-action id', () => {
    expect(preflightRules()).toMatchInlineSnapshot(`
      {
        "asset-missing": {
          "fix": "relink-asset",
          "scope": "pages",
          "severity": "error",
        },
        "asset-modified": {
          "fix": "relink-asset",
          "scope": "pages",
          "severity": "warning",
        },
        "bleed-hazard": {
          "fix": "extend-to-bleed",
          "scope": "pages",
          "severity": "warning",
        },
        "cover-asset-missing": {
          "fix": "relink-asset",
          "scope": "cover",
          "severity": "error",
        },
        "cover-asset-modified": {
          "fix": "relink-asset",
          "scope": "cover",
          "severity": "warning",
        },
        "cover-dpi-below-min": {
          "fix": "reduce-photo-scale",
          "scope": "cover",
          "severity": "error",
        },
        "cover-dpi-below-warn": {
          "fix": "reduce-photo-scale",
          "scope": "cover",
          "severity": "warning",
        },
        "cover-front-empty": {
          "fix": "edit-cover",
          "scope": "cover",
          "severity": "info",
        },
        "cover-not-srgb": {
          "fix": "edit-cover",
          "scope": "cover",
          "severity": "warning",
        },
        "dpi-below-min": {
          "fix": "reduce-photo-scale",
          "scope": "pages",
          "severity": "error",
        },
        "dpi-below-warn": {
          "fix": "reduce-photo-scale",
          "scope": "pages",
          "severity": "warning",
        },
        "empty-image-frame": {
          "fix": "fill-or-remove-frame",
          "scope": "pages",
          "severity": "warning",
        },
        "empty-text-frame": {
          "fix": "fill-or-remove-frame",
          "scope": "pages",
          "severity": "info",
        },
        "page-count-above-max": {
          "fix": "remove-pages",
          "scope": "pages",
          "severity": "error",
        },
        "page-count-below-min": {
          "fix": "add-pages",
          "scope": "pages",
          "severity": "error",
        },
        "page-count-step": {
          "fix": "add-pages",
          "scope": "pages",
          "severity": "error",
        },
        "safe-zone-intrusion": {
          "fix": "move-into-safe-zone",
          "scope": "pages",
          "severity": "warning",
        },
        "spine-text-cut": {
          "fix": "edit-cover",
          "scope": "cover",
          "severity": "warning",
        },
        "spine-text-small": {
          "fix": "edit-cover",
          "scope": "cover",
          "severity": "warning",
        },
      }
    `)
  })
})

describe('preflight', () => {
  it('a clean book has no issues', () => {
    expect(preflight(bookWith([photo(), text('Hello')]), generic)).toEqual([])
  })

  describe('page count (profile pageCount)', () => {
    it('below the minimum is an error with the count and the minimum', () => {
      const issues = preflight(bookWith([], 18), generic)

      expect(issues).toEqual([
        {
          rule: 'page-count-below-min',
          severity: 'error',
          fix: 'add-pages',
          scope: 'pages',
          location: {},
          measured: 18,
          threshold: 20,
        },
      ])
    })

    it('above the maximum is an error; the maximum itself is clean', () => {
      expect(rules(bookWith([], 122))).toEqual(['page-count-above-max'])
      expect(preflight(bookWith([], 122), generic)[0]).toMatchObject({
        measured: 122,
        threshold: 120,
      })
      expect(rules(bookWith([], 120))).toEqual([])
    })

    it('off the profile step is an error; a whole step is clean', () => {
      // Steps count from the minimum: 22, 30, 38… pages.
      const profile = profileWith({
        pageCount: { min: 22, step: 8, max: 118 },
      })

      expect(preflight(bookWith([], 24), profile)).toMatchObject([
        { rule: 'page-count-step', measured: 24, threshold: 8 },
      ])
      expect(rules(bookWith([], 22), profile)).toEqual([])
      expect(rules(bookWith([], 30), profile)).toEqual([])
    })
  })

  describe('assets', () => {
    it('a photo whose asset record is gone is missing', () => {
      expect(rules(bookWith([photo({ assetId: 'gone' })]))).toEqual([
        'asset-missing',
      ])
    })

    it('reads missing / modified from the relink status; ok and unknown ids are clean', () => {
      const book = bookWith([photo()])

      expect(rules(book, generic, new Map([['sharp', 'missing']]))).toEqual([
        'asset-missing',
      ])
      expect(rules(book, generic, new Map([['sharp', 'modified']]))).toEqual([
        'asset-modified',
      ])
      expect(rules(book, generic, new Map([['sharp', 'ok']]))).toEqual([])
      expect(rules(book, generic, new Map([['other', 'missing']]))).toEqual([])
    })
  })

  describe('effective DPI (profile dpi gates)', () => {
    it('500 px across 100 mm (127 dpi) is below the 150 minimum: error', () => {
      const [found] = preflight(
        bookWith([photo({ assetId: 'blurry' })]),
        generic,
      )

      expect(found).toMatchObject({
        rule: 'dpi-below-min',
        severity: 'error',
        fix: 'reduce-photo-scale',
        measured: 127,
        threshold: 150,
      })
    })

    it('700 px across 100 mm (178 dpi) is below the 200 warning: warning', () => {
      const [found] = preflight(bookWith([photo({ assetId: 'soft' })]), generic)

      expect(found).toMatchObject({
        rule: 'dpi-below-warn',
        severity: 'warning',
        measured: 178,
        threshold: 200,
      })
    })

    it('zooming the crop lowers the DPI', () => {
      // 6000 px / 12 = 500 px across 100 mm: 127 dpi.
      const zoomed = photo({ crop: { zoom: 12, center: CENTER } })

      expect(rules(bookWith([zoomed]))).toEqual(['dpi-below-min'])
    })

    it('a wide photo is cropped to the frame before it is rated', () => {
      // 1000 × 500 px covers the square frame with its middle 500 px: 127 dpi.
      const book = bookWith([photo({ assetId: 'wide' })])
      const wide: Book = {
        ...book,
        assets: { ...book.assets, wide: { widthPx: 1000, heightPx: 500 } },
      }

      expect(preflight(wide, generic)).toMatchObject([
        { rule: 'dpi-below-min', measured: 127 },
      ])
    })

    it('uses the given profile, not the built-in gates', () => {
      const lenient = profileWith({ dpi: { warn: 100, min: 50 } })

      expect(rules(bookWith([photo({ assetId: 'blurry' })]), lenient)).toEqual(
        [],
      )
    })

    it('an asset without pixel size is not rated', () => {
      const book = bookWith([photo()])
      const unsized: Book = { ...book, assets: { ...book.assets, sharp: {} } }

      expect(rules(unsized)).toEqual([])
    })

    it('a half-known pixel size is not rated either', () => {
      const widthOnly = bookWith([photo({ assetId: 'w' })])
      const heightOnly = bookWith([
        photo({
          assetId: 'h',
          crop: { zoom: 1, center: CENTER, quarterTurns: 1 },
        }),
      ])

      // Each alone would rate 127 dpi (500 px across 100 mm).
      expect(rules({ ...widthOnly, assets: { w: { widthPx: 500 } } })).toEqual(
        [],
      )
      expect(
        rules({ ...heightOnly, assets: { h: { heightPx: 500 } } }),
      ).toEqual([])
    })
  })

  describe('empty frames', () => {
    it('an image frame without a photo is a warning', () => {
      expect(
        preflight(
          bookWith([photo({ assetId: undefined, crop: undefined })]),
          generic,
        ),
      ).toMatchObject([
        {
          rule: 'empty-image-frame',
          severity: 'warning',
          fix: 'fill-or-remove-frame',
        },
      ])
    })

    it('a text frame with blank text is info; any text is clean', () => {
      expect(preflight(bookWith([text('  ')]), generic)).toMatchObject([
        { rule: 'empty-text-frame', severity: 'info' },
      ])
      expect(rules(bookWith([text('Hi')]))).toEqual([])
    })

    it('frames off the page (pasteboard or bleed only) are not checked', () => {
      const pasteboard = photo({
        assetId: undefined,
        rect: { x: -150, y: 50, width: 100, height: 100 },
      })
      const bleedOnly = photo({
        id: 'bleed',
        assetId: undefined,
        rect: { x: -3, y: 50, width: 3, height: 100 },
      })

      expect(rules(bookWith([pasteboard, bleedOnly]))).toEqual([])
    })
  })

  describe('safe zone (profile safeMarginMm, 5 mm)', () => {
    it('text closer than 5 mm to the trim intrudes; at 5 mm it is clean', () => {
      expect(
        preflight(
          bookWith([
            text('Hi', { rect: { x: 2, y: 50, width: 100, height: 20 } }),
          ]),
          generic,
        ),
      ).toMatchObject([
        {
          rule: 'safe-zone-intrusion',
          severity: 'warning',
          fix: 'move-into-safe-zone',
        },
      ])
      expect(
        rules(
          bookWith([
            text('Hi', { rect: { x: 5, y: 5, width: 100, height: 20 } }),
          ]),
        ),
      ).toEqual([])
    })

    it('text across the gutter or the bottom margin intrudes', () => {
      const gutter = text('Hi', {
        rect: { x: 180, y: 50, width: 40, height: 20 },
      })
      const bottom = text('Hi', {
        rect: { x: 250, y: 190, width: 40, height: 8 },
      })

      expect(rules(bookWith([gutter]))).toEqual(['safe-zone-intrusion'])
      expect(rules(bookWith([bottom]))).toEqual(['safe-zone-intrusion'])
    })

    it('a rotation that swings the corners into the margin intrudes', () => {
      const square = { x: 10, y: 50, width: 100, height: 100 }

      expect(rules(bookWith([text('Hi', { rect: square })]))).toEqual([])
      expect(
        rules(bookWith([text('Hi', { rect: square, rotationDeg: 45 })])),
      ).toEqual(['safe-zone-intrusion'])
    })

    it('a 45° turn that keeps its corners 9 mm in is clean', () => {
      // Bounds grow 20.7 mm on each side: x / y 9.3, right / bottom 150.7.
      const square = { x: 30, y: 30, width: 100, height: 100 }

      expect(
        rules(bookWith([text('Hi', { rect: square, rotationDeg: 45 })])),
      ).toEqual([])
    })

    it('a rotation swings the corners up past the top margin too', () => {
      const square = { x: 50, y: 10, width: 100, height: 100 }

      expect(rules(bookWith([text('Hi', { rect: square })]))).toEqual([])
      expect(
        rules(bookWith([text('Hi', { rect: square, rotationDeg: 45 })])),
      ).toEqual(['safe-zone-intrusion'])
    })

    it('uses the profile margin, not the book setting', () => {
      const wide = profileWith({ safeMarginMm: 20 })

      expect(
        rules(
          bookWith([
            text('Hi', { rect: { x: 10, y: 50, width: 100, height: 20 } }),
          ]),
          wide,
        ),
      ).toEqual(['safe-zone-intrusion'])
    })
  })

  describe('bleed hazard (safe margin vs book bleed)', () => {
    it('a photo edge 2 mm inside the trim is a hazard', () => {
      const near = photo({ rect: { x: 2, y: 50, width: 100, height: 100 } })

      expect(preflight(bookWith([near]), generic)).toMatchObject([
        { rule: 'bleed-hazard', severity: 'warning', fix: 'extend-to-bleed' },
      ])
    })

    it('a photo out to the bleed edge or behind the safe line is clean', () => {
      const fullBleed = photo({
        rect: { x: -3, y: -3, width: 406, height: 206 },
      })
      const inset = photo({ rect: { x: 5, y: 5, width: 390, height: 190 } })

      expect(rules(bookWith([fullBleed]))).toEqual([])
      expect(rules(bookWith([inset]))).toEqual([])
    })

    it('stopping short of the bleed on the right or bottom is a hazard', () => {
      const right = photo({ rect: { x: 300, y: 50, width: 99, height: 100 } })
      const bottom = photo({
        rect: { x: 250, y: 100, width: 100, height: 101 },
      })

      expect(rules(bookWith([right]))).toEqual(['bleed-hazard'])
      expect(rules(bookWith([bottom]))).toEqual(['bleed-hazard'])
    })

    it('the binding side of page 1 and of the last page is no trim edge', () => {
      const atBinding = photo({
        rect: { x: 1, y: 50, width: 100, height: 100 },
      })
      const book = bookWith([])
      const last = book.spreads.length - 1
      const spreads = book.spreads.map((spread, i) =>
        i === 0
          ? { ...spread, frames: [atBinding] }
          : i === last
            ? {
                ...spread,
                frames: [
                  photo({ rect: { x: 99, y: 50, width: 100, height: 100 } }),
                ],
              }
            : spread,
      )

      expect(rules({ ...book, spreads })).toEqual([])
    })
  })

  describe('location', () => {
    it('names the spread, the page under the item center and the item', () => {
      const book = bookWith([
        photo({ id: 'left', assetId: undefined }),
        photo({
          id: 'right',
          assetId: undefined,
          rect: { x: 250, y: 50, width: 100, height: 100 },
        }),
      ])

      expect(preflight(book, generic).map((found) => found.location)).toEqual([
        { spreadId: 's1', page: 2, itemId: 'left' },
        { spreadId: 's1', page: 3, itemId: 'right' },
      ])
    })

    it('page 1 sits on the first spread, the last single page on the last', () => {
      const empty = photo({ assetId: undefined })
      const book = bookWith([])
      const spreads = book.spreads.map((spread, i) =>
        i === 0 || i === book.spreads.length - 1
          ? { ...spread, frames: [empty] }
          : spread,
      )

      expect(
        preflight({ ...book, spreads }, generic).map(
          (found) => found.location.page,
        ),
      ).toEqual([1, 20])
    })
  })

  // Cheap enough to run on every edit: each added spread costs the same, so
  // going 50 → 100 spreads adds twice the work of 25 → 50 (counted lookups,
  // not wall clock, which flakes on a shared CI runner).
  it('does constant work per added spread (25, 50, 100 spreads)', () => {
    const run = (pages: number) => {
      const book = bookWith([], pages)
      let assetReads = 0
      let statusReads = 0
      const assets = new Proxy(book.assets, {
        get: (target, key, receiver) => {
          assetReads += 1
          return Reflect.get(target, key, receiver) as unknown
        },
      })
      const countingStatus = new (class extends Map<
        string,
        PreflightAssetStatus
      > {
        override get(id: string) {
          statusReads += 1
          return super.get(id)
        }
      })()
      const filled: Book = {
        ...book,
        assets,
        spreads: book.spreads.map((spread) => ({
          ...spread,
          frames: [
            photo(),
            photo({
              id: 'soft',
              assetId: 'soft',
              rect: { x: 250, y: 50, width: 100, height: 100 },
            }),
            photo({
              id: 'empty',
              assetId: undefined,
              rect: { x: 2, y: 2, width: 20, height: 20 },
            }),
            text('Hello'),
          ],
        })),
      }
      const issues = preflight(filled, generic, { assetStatus: countingStatus })
      return {
        spreads: book.spreads.length,
        // Page-count issues are book-level: 198 pages is above the max.
        issues: issues.filter((found) => !found.rule.startsWith('page-count'))
          .length,
        assetReads,
        statusReads,
      }
    }
    const added = (from: Work, to: Work): Work => ({
      spreads: to.spreads - from.spreads,
      issues: to.issues - from.issues,
      assetReads: to.assetReads - from.assetReads,
      statusReads: to.statusReads - from.statusReads,
    })
    type Work = ReturnType<typeof run>

    const quarter = run(48)
    const half = run(98)
    const full = run(198)
    const first = added(quarter, half)
    const second = added(half, full)

    expect([quarter.spreads, half.spreads, full.spreads]).toEqual([25, 50, 100])
    // Two photos per added spread: one status lookup each, never a rescan.
    expect(first.statusReads).toBe(2 * first.spreads)
    // Twice the added spreads cost exactly twice the added work (affine).
    expect(second).toEqual({
      spreads: 2 * first.spreads,
      issues: 2 * first.issues,
      assetReads: 2 * first.assetReads,
      statusReads: 2 * first.statusReads,
    })
  })
})

describe('photoPages', () => {
  it('maps each placed photo to its printed pages, ascending and unique', () => {
    const book = bookWith([
      photo({ id: 'right', rect: { x: 250, y: 50, width: 100, height: 100 } }),
      photo({ id: 'left' }),
      photo({ id: 'left-2', rect: { x: 20, y: 20, width: 50, height: 50 } }),
      photo({ id: 'soft', assetId: 'soft' }),
      photo({
        id: 'pasteboard',
        assetId: 'blurry',
        rect: { x: -300, y: 50, width: 100, height: 100 },
      }),
      photo({ id: 'empty', assetId: undefined }),
      text('Hello'),
    ])

    expect([...photoPages(book)]).toEqual([
      ['sharp', [2, 3]],
      ['soft', [2]],
    ])
  })
})

describe('cover rules', () => {
  /** A fitting spine text: no advance. */
  const fits: PreflightCoverOptions = {
    layout: 'single',
    textAdvanceMm: () => 0,
  }

  /**
   * `bookWith([])` (200 mm trim, 20 pages: spine 12 mm, wrap 15 mm, cover
   * 412 mm; front photo box 215 × 230 mm) with a 3000 px front photo and
   * the spine text `Lake trip`.
   */
  function coverBook(
    front: Partial<Book['cover']['front']> = {},
    spine: { text?: string; manualMm?: number } = {},
  ): Book {
    const book = bookWith([])
    return {
      ...book,
      assets: {
        ...book.assets,
        front: { widthPx: 3000, heightPx: 3000 },
        small: { widthPx: 1000, heightPx: 1000 },
        mid: { widthPx: 1600, heightPx: 1600 },
      },
      cover: {
        ...book.cover,
        front: { ...book.cover.front, assetId: 'front', ...front },
        spine: { ...book.cover.spine, text: spine.text ?? 'Lake trip' },
        style: {
          ...book.cover.style,
          spineWidthMm: spine.manualMm ?? book.cover.style.spineWidthMm,
        },
        print: {
          spineWidthSource: spine.manualMm === undefined ? 'profile' : 'manual',
        },
      },
    }
  }

  function coverRules(
    book: Book,
    cover: PreflightCoverOptions = fits,
    assetStatus?: ReadonlyMap<string, PreflightAssetStatus>,
  ) {
    return preflight(book, generic, {
      cover,
      ...(assetStatus === undefined ? {} : { assetStatus }),
    }).map((found) => found.rule)
  }

  it('a clean cover has no issues', () => {
    expect(coverRules(coverBook())).toEqual([])
  })

  it('runs only when the caller asks, and only for 1 per sheet', () => {
    const book = coverBook({ assetId: undefined })

    expect(rules(book)).toEqual([])
    expect(coverRules(book, { ...fits, layout: '2up' })).toEqual([])
    expect(coverRules(book, { ...fits, layout: '4up' })).toEqual([])
    expect(coverRules(book)).toEqual(['cover-front-empty'])
  })

  it('cover-front-empty: no front photo, an info row without a location', () => {
    expect(
      preflight(coverBook({ assetId: undefined }), generic, { cover: fits }),
    ).toEqual([
      {
        rule: 'cover-front-empty',
        severity: 'info',
        fix: 'edit-cover',
        scope: 'cover',
        location: {},
      },
    ])
  })

  it('cover-asset-missing: an unknown asset or a missing file, with no dpi row', () => {
    expect(coverRules(coverBook({ assetId: 'gone' }))).toEqual([
      'cover-asset-missing',
    ])
    expect(
      coverRules(
        coverBook({ assetId: 'small' }),
        fits,
        new Map([['small', 'missing']]),
      ),
    ).toEqual(['cover-asset-missing'])
    expect(
      coverRules(coverBook(), fits, new Map([['other', 'missing']])),
    ).toEqual([])
  })

  it('cover-asset-modified: a changed file is still rated', () => {
    expect(
      coverRules(
        coverBook({ assetId: 'small' }),
        fits,
        new Map([['small', 'modified']]),
      ),
    ).toEqual(['cover-asset-modified', 'cover-dpi-below-min'])
    expect(coverRules(coverBook(), fits, new Map([['front', 'ok']]))).toEqual(
      [],
    )
  })

  it('cover-dpi-below-min: the editor front ppi under the profile minimum', () => {
    // coverPanelPpi(1000², 215 × 230 mm, 1) = round(1000 / 230 × 25.4) = 110.
    expect(
      preflight(coverBook({ assetId: 'small' }), generic, { cover: fits }),
    ).toMatchObject([
      {
        rule: 'cover-dpi-below-min',
        severity: 'error',
        scope: 'cover',
        measured: 110,
        threshold: 150,
      },
    ])
  })

  it('cover-dpi-below-warn: only the worse dpi row, the crop zoom counts', () => {
    // 1600 px: 177 ppi; 3000 px at zoom 2: round(3000 / 230 × 25.4 / 2) = 166.
    expect(
      preflight(coverBook({ assetId: 'mid' }), generic, { cover: fits }),
    ).toMatchObject([
      { rule: 'cover-dpi-below-warn', measured: 177, threshold: 200 },
    ])
    expect(
      preflight(coverBook({ crop: { zoom: 2, center: CENTER } }), generic, {
        cover: fits,
      }),
    ).toMatchObject([{ rule: 'cover-dpi-below-warn', measured: 166 }])
    // Zoom 1.1 keeps 3000 px at 301 ppi: no row.
    expect(
      coverRules(coverBook({ crop: { zoom: 1.1, center: CENTER } })),
    ).toEqual([])
  })

  it('rates a tall front photo by its width across the 215 mm box', () => {
    // coverPanelPpi(1000 × 3000, 215 × 230 mm, 1) = round(1000 / 215 × 25.4) = 118.
    const book = coverBook({ assetId: 'tall' })

    expect(
      preflight(
        {
          ...book,
          assets: { ...book.assets, tall: { widthPx: 1000, heightPx: 3000 } },
        },
        generic,
        { cover: fits },
      ),
    ).toMatchObject([{ rule: 'cover-dpi-below-min', measured: 118 }])
  })

  it('rates a front photo without pixel sizes as unknown, no dpi row', () => {
    const book = coverBook({ assetId: 'unsized' })

    expect(
      coverRules({ ...book, assets: { ...book.assets, unsized: {} } }),
    ).toEqual([])
  })

  it('cover-not-srgb: a colour warning on the front photo only', () => {
    const colors = [
      { assetId: 'sharp', family: 'display-p3' },
      { assetId: 'front', family: 'adobe-rgb' },
    ] as const

    expect(
      preflight(coverBook(), generic, { cover: { ...fits, colors } }),
    ).toEqual([
      {
        rule: 'cover-not-srgb',
        severity: 'warning',
        fix: 'edit-cover',
        scope: 'cover',
        location: {},
        family: 'adobe-rgb',
      },
    ])
    expect(coverRules(coverBook(), { ...fits, colors: [colors[0]] })).toEqual(
      [],
    )
  })

  it('spine-text-small: type at exactly the minimum is fine', () => {
    const lab = profileWith({ minFontPt: (2 * 72) / 25.4 })

    expect(
      preflight(coverBook({}, { manualMm: 4 }), lab, { cover: fits }),
    ).toEqual([])
  })

  it('spine-text-small: a 4 mm spine sets 2 mm (5.7 pt) type under 6 pt', () => {
    expect(
      preflight(coverBook({}, { manualMm: 4 }), generic, { cover: fits }),
    ).toEqual([
      {
        rule: 'spine-text-small',
        severity: 'warning',
        fix: 'edit-cover',
        scope: 'cover',
        location: {},
        measured: (2 * 72) / 25.4,
        threshold: 6,
      },
    ])
    // A 5 mm spine: 2.5 mm = 7.1 pt.
    expect(coverRules(coverBook({}, { manualMm: 5 }))).toEqual([])
  })

  it('spine-text-cut: the text advance past trimH − 2·safe', () => {
    const seen: [string, number][] = []
    const advance = (length: number): PreflightCoverOptions => ({
      layout: 'single',
      textAdvanceMm: (text, sizeMm) => {
        seen.push([text, sizeMm])
        return length
      },
    })

    expect(
      coverRules(coverBook({}, { text: '  Lake trip ' }), advance(190.01)),
    ).toEqual(['spine-text-cut'])
    // 12 mm spine on a 412 mm cover: min(412 × 12 / 848, 6) mm.
    expect(seen).toEqual([['Lake trip', (412 * 12) / 848]])
    expect(coverRules(coverBook(), advance(190))).toEqual([])
  })

  it('an empty spine text gets neither spine row', () => {
    const book = coverBook({}, { text: '  ', manualMm: 4 })

    expect(
      coverRules(book, { layout: 'single', textAdvanceMm: () => 1000 }),
    ).toEqual([])
  })

  it('lists the cover issues after the interior ones, in rule order', () => {
    const book = coverBook({ assetId: 'small' }, { manualMm: 4 })
    const withPhoto: Book = {
      ...book,
      spreads: bookWith([photo({ assetId: 'blurry' })]).spreads,
    }

    expect(
      coverRules(withPhoto, {
        layout: 'single',
        colors: [{ assetId: 'small', family: 'display-p3' }],
        textAdvanceMm: () => 500,
      }),
    ).toEqual([
      'dpi-below-min',
      'cover-dpi-below-min',
      'cover-not-srgb',
      'spine-text-small',
      'spine-text-cut',
    ])
  })
})
