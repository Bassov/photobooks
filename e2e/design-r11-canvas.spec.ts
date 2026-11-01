import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { addSpreads } from './fixtures/layoutTiles'
import { openLibraryBook } from './fixtures/openLibraryBook'
import { chooseZoom } from './fixtures/zoomMenu'

// Owner Musts M73–M75, round 11, relayed by the Designer (review r10 of prod,
// 2026-11-01). Owner rule: every Designer item is a Must; round 11, Designer
// review r10 2026-11-01. Kit values measured on the rendered kit `uikit#/demo`
// (v0.10.0) at 1440 × 900 with getBoundingClientRect / getComputedStyle /
// Range rects, replaying the demo-capture steps (19 × 23 cm "Lake trip").
//
// M73 editor-spread-1: the spread is 848 × 513.25 at x 252, y 155.36; the
//     fold (canvas.tsx gutter) is x 663.28, 25.4375 × 513.25 (3 % of the
//     spread, centred on it), background-image
//     `linear-gradient(to right, rgba(0, 0, 0, 0) 0%, oklab(0 0 0 / 0.06) 50%,
//     rgba(0, 0, 0, 0) 100%)`. Page shadow (kept) rgba(0, 0, 0, 0.1) 0px 2px
//     6px 0px, rgba(0, 0, 0, 0.14) 0px 12px 32px 0px.
// M74 editor-cover-photo-and-title: the list Cover and Endpaper thumbnails
//     (v7 shadowSm) rgba(35, 34, 35, 0.18) 0px 1px 2px 0px, nothing else.
// M75 editor-cover-photo-and-title (front title "Lake trip 2026"): cover
//     848 × 497.55 at x 252. Front title Lora Variable 34px / 400 italic,
//     text width 228; spine text 12px / 400; back text 11px. Labels 12px,
//     text 10 px under the cover; text x Back 443, Spine 663.02 (the spine's
//     left edge: "Spine" is wider than the spine and overflows to the right),
//     Front 879.47. The sizes are cqw of the cover, so the ratio to the cover
//     width holds at any cover size.
//     Page y: this replay puts the kit cover at y 163.22 (14 px lower, same
//     x, size and label gap); the Designer's kit labels at y 656.77 put it at
//     y 149.22 (656.77 − 10 − 497.55), where prod has it, so y uses those.
// Designer (other renderer): front width 141.08, labels y 656.77, Spine x
//     663.02; prod before 30.53 / 500, 11.02 / 500, 10.18, y 654.77, x 659.96.

const KIT = {
  spread: { x: 252, width: 848, height: 513.25 },
  fold: {
    x: 663.28,
    width: 25.4375,
    share: 0.03,
    image:
      'linear-gradient(to right, rgba(0, 0, 0, 0) 0%, oklab(0 0 0 / 0.06) 50%, rgba(0, 0, 0, 0) 100%)',
  },
  pageShadow:
    'rgba(0, 0, 0, 0.1) 0px 2px 6px 0px, rgba(0, 0, 0, 0.14) 0px 12px 32px 0px',
  miniShadow: 'rgba(35, 34, 35, 0.18) 0px 1px 2px 0px',
  cover: { x: 252, y: 149.22, width: 848, height: 497.55 },
  front: { size: 34, weight: '400', width: 228 },
  spine: { size: 12, weight: '400' },
  back: { size: 11 },
  labels: { y: 656.77, back: 443, spine: 663.02, front: 879.47, size: '12px' },
} as const

const FRONT_TITLE = 'Lake trip 2026'

/**
 * Kit family "Lora Variable", Lora, serif with upright faces only (italic is
 * synthesised); prod reads the same upright files through the "Lora Cover"
 * alias first, because its "Lora Variable" also has a real italic face.
 */
const COVER_FAMILY = '"Lora Cover", "Lora Variable", Lora, serif'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function near(actual: number, expected: number, what: string): void {
  expect(
    Math.abs(actual - expected),
    `${what}: ${String(actual)}`,
  ).toBeLessThanOrEqual(0.5)
}

async function openLakeTrip(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openLibraryBook(page)
  const count = Number(
    await page
      .getByTestId('pasteboard-scroll')
      .getAttribute('data-spread-count'),
  )
  if (count < 3) await addSpreads(page, 3 - count)
}

interface FoldRead {
  spread: Rect
  fold: Rect
  image: string
  shadow: string
}

/** The selected two-page spread, its fold and its page shadow in one frame. */
async function readFold(page: Page, spreadId: string): Promise<FoldRead> {
  return page.evaluate((id) => {
    const rect = (el: Element): Rect => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    }
    const view = document.querySelector(
      `[data-testid="spread-view"][data-spread-id="${id}"]`,
    )
    const fold = view?.querySelector('[data-testid="spread-page-cut"]')
    const shadow = document.querySelector(
      `[data-testid="pasteboard-page-shadow"][data-spread-id="${id}"]`,
    )
    if (!view || !fold || !shadow) throw new Error('spread fold missing')
    return {
      spread: rect(view),
      fold: rect(fold),
      image: getComputedStyle(fold).backgroundImage,
      shadow: getComputedStyle(shadow).boxShadow,
    }
  }, spreadId)
}

/** Fit or ×2: the fold is 3 % of the spread, full height, on its centre. */
function expectFoldLocked(read: FoldRead, at: string): void {
  near(read.fold.width, read.spread.width * KIT.fold.share, `${at} fold width`)
  near(read.fold.height, read.spread.height, `${at} fold height`)
  near(read.fold.y, read.spread.y, `${at} fold y`)
  near(
    read.fold.x + read.fold.width / 2,
    read.spread.x + read.spread.width / 2,
    `${at} fold centre`,
  )
  expect(read.image, at).toBe(KIT.fold.image)
  expect(read.shadow, at).toBe(KIT.pageShadow)
}

async function settledFold(page: Page, spreadId: string): Promise<FoldRead> {
  let prev = ''
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(await readFold(page, spreadId))
        const settled = now === prev
        prev = now
        return settled
      },
      { intervals: [150] },
    )
    .toBe(true)
  return readFold(page, spreadId)
}

test.describe('M73: the spine fold is the kit gradient, 3 % of the spread', () => {
  test.beforeEach(async ({ page }) => {
    await openLakeTrip(page)
  })

  test('Fit and ×2 (200 %): the fold scales with the spread', async ({
    page,
  }) => {
    const row = page.locator('[data-testid^="spread-list-item-"]').nth(1)
    const spreadId = ((await row.getAttribute('data-testid')) ?? '').replace(
      'spread-list-item-',
      '',
    )
    expect(spreadId).not.toBe('')
    await row.click()
    await chooseZoom(page, 'Fit spread')
    const fit = await settledFold(page, spreadId)
    expectFoldLocked(fit, 'Fit')
    near(fit.spread.x, KIT.spread.x, 'Fit spread x')
    near(fit.spread.width, KIT.spread.width, 'Fit spread width')
    near(fit.spread.height, KIT.spread.height, 'Fit spread height')
    near(fit.fold.x, KIT.fold.x, 'Fit fold x')
    near(fit.fold.width, KIT.fold.width, 'Fit fold width')

    await chooseZoom(page, '200%')
    const x2 = await settledFold(page, spreadId)
    expectFoldLocked(x2, '×2')
    // 200 % is physical size, past twice the Fit spread at 1440 × 900.
    expect(x2.spread.width).toBeGreaterThan(fit.spread.width * 2)
    near(
      x2.fold.width / fit.fold.width,
      x2.spread.width / fit.spread.width,
      '×2 / Fit fold scale',
    )
  })
})

interface CoverRead {
  cover: Rect
  front: {
    size: number
    weight: string
    family: string
    style: string
    width: number
  }
  spine: { size: number; weight: string; family: string; style: string }
  back: { size: number; weight: string }
  labels: { text: string; x: number; y: number; size: string }[]
}

async function readCover(page: Page): Promise<CoverRead> {
  return page.evaluate(() => {
    const byId = (id: string): HTMLElement => {
      const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
      if (!el) throw new Error(`missing ${id}`)
      return el
    }
    const textBox = (el: Element): DOMRect => {
      const range = document.createRange()
      range.selectNodeContents(el)
      return range.getBoundingClientRect()
    }
    const font = (el: Element) => {
      const s = getComputedStyle(el)
      return {
        size: Number.parseFloat(s.fontSize),
        weight: s.fontWeight,
        family: s.fontFamily,
        style: s.fontStyle,
      }
    }
    const c = byId('canvas-cover').getBoundingClientRect()
    const frontEm = byId('cover-front-text').querySelector('em')
    const spineEm = byId('cover-spine-text').querySelector('em')
    if (!frontEm || !spineEm) throw new Error('cover text missing')
    const back = font(byId('cover-back-text'))
    return {
      cover: { x: c.x, y: c.y, width: c.width, height: c.height },
      front: { ...font(frontEm), width: textBox(frontEm).width },
      spine: font(spineEm),
      back: { size: back.size, weight: back.weight },
      labels: ['back', 'spine', 'front'].map((name) => {
        const label = byId(`cover-label-${name}`)
        const box = textBox(label)
        return {
          text: label.textContent,
          x: box.x,
          y: box.y,
          size: getComputedStyle(label).fontSize,
        }
      }),
    }
  })
}

async function openCover(page: Page): Promise<void> {
  await page.getByTestId('cover-list-item').click()
  const title = page.getByTestId('cover-text-front')
  await title.fill(FRONT_TITLE)
  await title.blur()
  await expect(page.getByTestId('cover-front-text')).toHaveText(FRONT_TITLE)
  await page.mouse.move(1439, 899)
  await page.evaluate(async (text) => {
    await document.fonts.load('italic 400 34px "Lora Cover"', text)
    await document.fonts.ready
  }, FRONT_TITLE)
}

/** Kit px on the 848 px Fit cover, as a share of the cover width. */
function ratioOf(px: number): number {
  return px / KIT.cover.width
}

test.describe('M74 / M75: list thumbnails and cover canvas text match the kit', () => {
  test.beforeEach(async ({ page }) => {
    await openLakeTrip(page)
    await openCover(page)
  })

  test('M74: the list Cover and Endpaper thumbnails take the kit shadowSm only', async ({
    page,
  }) => {
    const minis: [string, Locator][] = [
      ['cover', page.getByTestId('cover-list-item').locator('.cover-spread')],
      [
        'endpaper front',
        page
          .getByTestId('endpaper-list-item-front')
          .locator('.endpaper-spread'),
      ],
      [
        'endpaper back',
        page.getByTestId('endpaper-list-item-back').locator('.endpaper-spread'),
      ],
    ]
    for (const [name, mini] of minis) {
      await expect(mini, name).toHaveCSS('box-shadow', KIT.miniShadow)
    }
    // The canvas cover keeps the big kit shadow.
    await expect(page.getByTestId('canvas-cover')).toHaveCSS(
      'box-shadow',
      'rgba(35, 34, 35, 0.2) 0px 1px 2px 0px, rgba(35, 34, 35, 0.55) 0px 30px 60px -30px',
    )
  })

  test('M75 at Fit: title, spine and back type and the panel labels', async ({
    page,
  }) => {
    const read = await readCover(page)
    near(read.cover.x, KIT.cover.x, 'cover x')
    near(read.cover.y, KIT.cover.y, 'cover y')
    near(read.cover.width, KIT.cover.width, 'cover width')
    near(read.cover.height, KIT.cover.height, 'cover height')

    near(read.front.size, KIT.front.size, 'front size')
    expect(read.front.weight).toBe(KIT.front.weight)
    expect(read.front.family).toBe(COVER_FAMILY)
    expect(read.front.style).toBe('italic')
    near(read.front.width, KIT.front.width, 'front width')
    near(read.spine.size, KIT.spine.size, 'spine size')
    expect(read.spine.weight).toBe(KIT.spine.weight)
    expect(read.spine.family).toBe(COVER_FAMILY)
    expect(read.spine.style).toBe('italic')
    near(read.back.size, KIT.back.size, 'back size')
    expect(read.back.weight).toBe('400')

    expect(read.labels.map((l) => l.text)).toEqual(['Back', 'Spine', 'Front'])
    const xs = [KIT.labels.back, KIT.labels.spine, KIT.labels.front]
    read.labels.forEach((label, i) => {
      near(label.y, KIT.labels.y, `${label.text} label y`)
      near(label.x, xs[i] ?? Number.NaN, `${label.text} label x`)
      expect(label.size).toBe(KIT.labels.size)
    })
  })

  test('M75 at ×2 cover size: the type keeps its ratio to the cover', async ({
    page,
  }) => {
    const fit = await readCover(page)
    await page.setViewportSize({ width: 2880, height: 1800 })
    await expect
      .poll(async () => (await readCover(page)).cover.width)
      .toBeGreaterThan(fit.cover.width * 1.9)
    const big = await readCover(page)
    const w = big.cover.width
    expect(big.front.size / w, 'front ratio').toBeCloseTo(
      ratioOf(KIT.front.size),
      4,
    )
    expect(big.spine.size / w, 'spine ratio').toBeCloseTo(
      ratioOf(KIT.spine.size),
      4,
    )
    expect(big.back.size / w, 'back ratio').toBeCloseTo(
      ratioOf(KIT.back.size),
      4,
    )
    near(big.front.size, (fit.front.size * w) / fit.cover.width, 'front ×2')
    near(big.spine.size, (fit.spine.size * w) / fit.cover.width, 'spine ×2')
    near(big.back.size, (fit.back.size * w) / fit.cover.width, 'back ×2')
  })
})
