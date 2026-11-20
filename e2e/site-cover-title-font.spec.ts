import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { pixelsAt, type Point } from './fixtures/paintProbe'
import { readerLanded } from './fixtures/readerLanded'

// Designer walkthrough-polish B1 / D38: the site cover title takes the book's
// Title font (serif-italic → Lora italic); a sans title keeps the site sans.

async function openPreview(page: Page): Promise<Locator> {
  await page.getByTestId('present').click()
  const preview = page.getByTestId('site-preview')
  await readerLanded(preview.getByTestId('ps-reader'), 0)
  await page.evaluate(() => document.fonts.ready)
  return preview
}

interface TitleLook {
  family: string
  style: string
  weight: string
  /** the cover's top band paint (the title sits 9 % from the top) */
  paint: number[][]
}

/** Points of a 24 × 6 grid over the top quarter of a `w` × `h` cover. */
const band = (w: number, h: number): Point[] =>
  Array.from({ length: 144 }, (_, i) => ({
    x: w * (0.04 + (0.92 * (i % 24)) / 23),
    y: h * (0.06 + (0.16 * Math.floor(i / 24)) / 5),
  }))

async function look(preview: Locator): Promise<TitleLook> {
  const title = preview.locator('.sb-cover .sd-b3-title').first()
  const cover = preview.locator('.sb-cover').first()
  const css = await title.evaluate((el) => {
    const s = getComputedStyle(el)
    return { family: s.fontFamily, style: s.fontStyle, weight: s.fontWeight }
  })
  const box = await preview.getByTestId('ps-reader').boundingBox()
  const c = await cover.boundingBox()
  if (box === null || c === null) throw new Error('no cover box')
  // the CSS cover's box in reader coordinates: its pixels are the CSS or the GL book's
  const pts = band(c.width, c.height).map((p) => ({
    x: c.x - box.x + p.x,
    y: c.y - box.y + p.y,
  }))
  return {
    ...css,
    paint: await pixelsAt(preview.getByTestId('ps-reader'), pts),
  }
}

test('Preview paints the cover title in the book Title font (D38)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSessionEditor(page)

  // a new book's Title font: serif-italic
  const serif = await look(await openPreview(page))
  expect(serif.family).toContain('Lora Cover')
  expect(serif.style).toBe('italic')
  expect(serif.weight).toBe('400')
  expect(
    await page.evaluate(() =>
      document.fonts.check('italic 400 32px "Lora Cover"', 'Ab'),
    ),
  ).toBe(true)

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('site-preview')).toHaveCount(0)
  await page.getByTestId('cover-list-item').click()
  await page
    .getByTestId('insp-cover')
    .getByTestId('cover-title-font')
    .selectOption('sans')

  // sans: the site sans as before (.ss .sd-it: Site Inter Display 500, upright)
  const sans = await look(await openPreview(page))
  expect(sans.family).toContain('Site Inter Display')
  expect(sans.style).toBe('normal')
  expect(sans.weight).toBe('500')

  // and the paint follows: the title band differs between the two faces
  const moved = serif.paint.filter((px, i) =>
    px.some((v, ch) => Math.abs(v - (sans.paint[i]?.[ch] ?? v)) > 40),
  )
  expect(moved.length).toBeGreaterThan(3)
})

test('kit #/demo Preview sets the cover title in the book Title font (D38)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  // the CSS book (?gl=0): its title is the DOM; the GL cover canvas draws the same face (closed.ts coverCanvas)
  await page.goto('/uikit/?gl=0#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(() => {
    const d = (
      window as unknown as {
        __demo: {
          reset: () => void
          state: () => Record<string, unknown>
          go: (stage: string) => void
        }
      }
    ).__demo
    d.reset()
    const s = d.state()
    s.path = '~/Pictures/Photobooks'
    s.books = [
      {
        id: 's1',
        title: 'Prev',
        book: { endp: true, endpSame: true, w: 19, h: 23, preset: 'custom' },
      },
    ]
    s.open = 's1'
    d.go('editor')
  })
  await page.getByTestId('demo-preview').click()
  // the kit cover's Title font default (Serif italic): the site front in Lora italic
  const title = page
    .getByTestId('site-preview')
    .locator('[data-cover-title]')
    .first()
  await expect(title).toHaveText('Prev')
  const css = await title.evaluate((el) => {
    const s = getComputedStyle(el)
    return [s.fontFamily, s.fontStyle, s.fontWeight]
  })
  expect(css[0]).toContain('Lora')
  expect(css.slice(1)).toStrictEqual(['italic', '400'])
})
