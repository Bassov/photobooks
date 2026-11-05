import assert from 'node:assert/strict'
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { dispatchCtrlWheel } from './fixtures/dispatchCtrlWheel'

// Designer page-numbers: `&parent=a` puts Master A on all 40 painter spreads
// (300 × 300 mm trim, 5 mm safe area). Folio boxes are 20 × 4.34 mm in spread
// mm; the master decides Show + Outer / Centre / Inner, the book how it counts.
const PAINTER = '/?fixture=painter&parent=a'
const PAGE_MM = 300
const SAFE_MM = 5
const FOLIO_W_MM = 20
const FOLIO_H_MM = 4.34

test.use({ viewport: { width: 1440, height: 900 } })

type Position = 'Outer' | 'Centre' | 'Inner'

interface Margins {
  bottom: number
  inside: number
  outside: number
}

const slots = (page: Page) =>
  page.getByTestId('pasteboard-scroll').locator('[data-pasteboard-slot]')
const paperAt = (page: Page, index: number) =>
  slots(page).nth(index).getByTestId('spread-view')
const numbersAt = (page: Page, index: number) =>
  paperAt(page, index).getByTestId('page-number')

async function slotIds(page: Page): Promise<string[]> {
  return slots(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-spread-id') ?? ''),
  )
}

async function openMasters(page: Page): Promise<void> {
  await page.getByTestId('left-tab-masters').click()
  await expect(page.getByTestId('insp-master')).toBeVisible()
}

async function openPages(page: Page): Promise<void> {
  await page.getByTestId('left-tab-pages').click()
  await expect(page.getByTestId('masters-canvas')).toHaveCount(0)
}

async function margins(page: Page): Promise<Margins> {
  const read = async (field: string) =>
    Number(await page.getByTestId(`master-field-${field}`).inputValue())
  return {
    bottom: await read('bottom'),
    inside: await read('inside'),
    outside: await read('outside'),
  }
}

/** Designer spec folio box (spread mm) for page side 0 = left, 1 = right. */
function folioX(position: Position, side: 0 | 1, m: Margins): number {
  if (position === 'Outer') {
    return side === 0 ? m.outside : 2 * PAGE_MM - m.outside - FOLIO_W_MM
  }
  if (position === 'Centre') {
    return side * PAGE_MM + PAGE_MM / 2 - FOLIO_W_MM / 2
  }
  return side === 0 ? PAGE_MM - m.inside - FOLIO_W_MM : PAGE_MM + m.inside
}

const SIDES = [0, 1] as const
type Align = 'left' | 'center' | 'right'
const ALIGNS: Record<Position, readonly [Align, Align]> = {
  Outer: ['left', 'right'],
  Centre: ['center', 'center'],
  Inner: ['right', 'left'],
}

/** Where a chip anchors on its folio box (spread mm): left / centre / right edge. */
function folioAnchorMm(position: Position, side: 0 | 1, m: Margins): number {
  const x = folioX(position, side, m)
  const align = ALIGNS[position][side]
  if (align === 'left') {
    return x
  }
  return align === 'right' ? x + FOLIO_W_MM : x + FOLIO_W_MM / 2
}

/** Masters canvas `#` chips relative to the master paper, at their align anchor. */
async function chipBoxes(page: Page) {
  return page
    .getByTestId('masters-canvas')
    .getByTestId('spread-view')
    .evaluate((el) => {
      const box = el.getBoundingClientRect()
      return [...document.querySelectorAll('[data-testid="master-pn"]')].map(
        (node) => {
          const r = node.getBoundingClientRect()
          const align = node instanceof HTMLElement ? node.dataset.align : ''
          const anchor =
            align === 'left'
              ? r.left
              : align === 'right'
                ? r.right
                : (r.left + r.right) / 2
          return {
            pxPerMm: box.width / 600,
            align,
            anchor: anchor - box.left,
            top: r.top - box.top,
            fontSize: Number.parseFloat(getComputedStyle(node).fontSize),
            text: node.textContent,
          }
        },
      )
    })
}

function folioY(m: Margins): number {
  return Math.min(
    PAGE_MM - m.bottom / 2 - FOLIO_H_MM / 2,
    PAGE_MM - SAFE_MM - FOLIO_H_MM,
  )
}

/** Folio boxes relative to their paper, with the paper's px/mm. */
async function folioBoxes(paper: Locator) {
  return paper.evaluate((el) => {
    const box = el.getBoundingClientRect()
    return {
      pxPerMm: box.width / 600,
      folios: [...el.querySelectorAll('[data-testid="page-number"]')].map(
        (node) => {
          const r = node.getBoundingClientRect()
          const style = getComputedStyle(node)
          return {
            text: node.textContent,
            align: style.textAlign,
            left: r.left - box.left,
            top: r.top - box.top,
            width: r.width,
            height: r.height,
            fontSize: Number.parseFloat(style.fontSize),
            parentLayer: node.parentElement?.dataset.testid,
            hit: style.pointerEvents,
          }
        },
      ),
    }
  })
}

async function turnOn(page: Page): Promise<void> {
  await openMasters(page)
  await page.getByTestId('master-pn-toggle').click()
  await expect(page.getByTestId('master-pn-toggle')).toHaveAttribute(
    'aria-checked',
    'true',
  )
}

test('Show off: no folio anywhere and Book settings says no master prints', async ({
  page,
}) => {
  await page.goto(PAINTER)
  await expect(paperAt(page, 1)).toBeVisible()
  await expect(page.getByTestId('page-number')).toHaveCount(0)

  await openMasters(page)
  await expect(page.getByTestId('master-pn-position')).toHaveCount(0)
  await expect(page.getByTestId('master-pn-note')).toHaveCount(0)
  await expect(page.getByTestId('master-pn')).toHaveCount(0)
  await page.getByTestId('book-title').click()
  await expect(page.getByTestId('book-pn-note')).toHaveText(
    'No master prints page numbers yet. Turn them on in Masters.',
  )
  await assertDocumentFitsViewport(page)
})

test('Show on: every page is numbered at the Outer / Centre / Inner box (±0.5 px)', async ({
  page,
}) => {
  await page.goto(PAINTER)
  await expect(paperAt(page, 1)).toBeVisible()
  await turnOn(page)
  const m = await margins(page)
  await expect(page.getByTestId('master-pn-note')).toHaveText(
    'Starts at 1 · 1, 2, 3 · Book settings',
  )

  for (const position of ['Outer', 'Centre', 'Inner'] as const) {
    await openMasters(page)
    await page
      .getByTestId('master-pn-position')
      .getByText(position, { exact: true })
      .click()
    // Masters canvas `#` chips: true scale, anchored per align.
    const chips = await chipBoxes(page)
    expect(chips.map((chip) => [chip.text, chip.align])).toEqual(
      ALIGNS[position].map((align) => ['#', align]),
    )
    for (const side of SIDES) {
      const chip = chips[side]
      const anchor = folioAnchorMm(position, side, m) * (chip?.pxPerMm ?? 0)
      expect(Math.abs((chip?.anchor ?? 0) - anchor)).toBeLessThan(0.5)
      expect(
        Math.abs((chip?.top ?? 0) - folioY(m) * (chip?.pxPerMm ?? 0)),
      ).toBeLessThan(0.5)
      expect(chip?.fontSize).toBeCloseTo(3.1 * (chip?.pxPerMm ?? 0), 2)
    }

    await openPages(page)
    const { pxPerMm, folios } = await folioBoxes(paperAt(page, 1))
    expect(folios.map((folio) => folio.text)).toEqual(['2', '3'])
    for (const side of SIDES) {
      const folio = folios[side]
      assert(folio !== undefined, 'expected a folio per page')
      const x = folioX(position, side, m) * pxPerMm
      expect(Math.abs(folio.left - x)).toBeLessThan(0.5)
      expect(Math.abs(folio.top - folioY(m) * pxPerMm)).toBeLessThan(0.5)
      expect(Math.abs(folio.width - FOLIO_W_MM * pxPerMm)).toBeLessThan(0.5)
      expect(folio.parentLayer).toBe('parent-layer')
      expect(folio.hit).toBe('none')
    }
    expect(folios.map((folio) => folio.align)).toEqual(ALIGNS[position])
  }

  // Page 1 sits alone on the right half of the first spread.
  await expect(numbersAt(page, 0)).toHaveText(['1'])
  // List thumbnails never print numbers.
  await expect(
    page.getByTestId('spreads-list').locator('.spread-view-folio'),
  ).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})

test('folios renumber after a reorder, skip page 1 and print roman', async ({
  page,
}) => {
  await page.goto(PAINTER)
  await expect(paperAt(page, 1)).toBeVisible()
  await turnOn(page)
  await openPages(page)
  await expect(numbersAt(page, 1)).toHaveText(['2', '3'])

  const [first, second] = await slotIds(page)
  await page.getByTestId(`spread-list-item-${first ?? ''}`).focus()
  await page.keyboard.press('Alt+ArrowDown')
  await expect
    .poll(async () => (await slotIds(page)).slice(0, 2))
    .toEqual([second, first])
  await expect(numbersAt(page, 0)).toHaveText(['1'])
  await expect(numbersAt(page, 1)).toHaveText(['2', '3'])
  await expect(paperAt(page, 1)).toHaveAttribute('data-spread-id', first ?? '')

  await page.getByTestId('book-title').click()
  // Kit `#/demo` editor-book-page-numbers: 179.37 px with the one-line note,
  // and the start value fits its 2ch box.
  const section = await page
    .getByTestId('book-page-numbers')
    .evaluate((el) => el.getBoundingClientRect().height)
  expect(Math.abs(section - 179.37)).toBeLessThan(0.5)
  const start = page.getByTestId('book-pn-start')
  expect(await start.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  )
  await start.fill('5')
  await start.press('Enter')
  await expect(numbersAt(page, 1)).toHaveText(['6', '7'])
  await expect(page.getByTestId('book-pn-note')).toHaveText('Page 1 is 5')

  await page
    .getByTestId('book-pn-format')
    .getByText('I, II, III', { exact: true })
    .click()
  await expect(numbersAt(page, 1)).toHaveText(['VI', 'VII'])
  await expect(numbersAt(page, 0)).toHaveText(['V'])

  await page.getByTestId('book-pn-skip-first').click()
  await expect(numbersAt(page, 0)).toHaveCount(0)
  await expect(numbersAt(page, 1)).toHaveText(['VI', 'VII'])
  await expect(page.getByTestId('book-pn-note')).toHaveText(
    'Page 1 has no number · page 2 is VI',
  )
})

test('the folio is caption size at Fit and scales with the zoom', async ({
  page,
}) => {
  await page.goto(PAINTER)
  await expect(paperAt(page, 1)).toBeVisible()
  await turnOn(page)
  await openPages(page)
  await expect(numbersAt(page, 1)).toHaveCount(2)

  const fit = await folioBoxes(paperAt(page, 1))
  const [folio] = fit.folios
  expect(folio?.fontSize).toBeCloseTo(3.1 * fit.pxPerMm, 2)
  expect(folio?.height).toBeCloseTo(FOLIO_H_MM * fit.pxPerMm, 1)

  await dispatchCtrlWheel(page, -200, 4)
  await expect
    .poll(async () =>
      page.getByTestId('pasteboard-world').getAttribute('data-gesture'),
    )
    .toBeNull()
  const zoomed = await folioBoxes(paperAt(page, 1))
  expect(zoomed.pxPerMm).toBeGreaterThan(fit.pxPerMm * 1.2)
  // Same box in mm: the folio is world content, locked to the zoom.
  const [after] = zoomed.folios
  expect((after?.height ?? 0) / zoomed.pxPerMm).toBeCloseTo(FOLIO_H_MM, 1)
  expect((after?.left ?? 0) / zoomed.pxPerMm).toBeCloseTo(
    (folio?.left ?? 0) / fit.pxPerMm,
    1,
  )
})
