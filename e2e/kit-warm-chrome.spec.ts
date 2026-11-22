import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { openLibraryBook } from './fixtures/openLibraryBook'
import { pixelsAt } from './fixtures/paintProbe'

// Designer walkthrough-polish-review P10 (polish-warm-chrome): the editor
// chrome takes the site paper's warm hue at the old lightness. Top bar
// #E1E1E1 → #E3E1DD, canvas #C8CACB → #C9C7C3, field #D7D7D7 → #D8D6D2.
// Prod (`/`) and kit (`/uikit/#/demo`) paint the same three tones.

test.use({ viewport: { width: 1440, height: 900 } })

const CHROME = [227, 225, 221]
const CANVAS = [201, 199, 195]
const FIELD = [216, 214, 210]
const css = ([r, g, b]: number[]) =>
  `rgb(${String(r)}, ${String(g)}, ${String(b)})`

/** Computed fill and the painted pixel at `at` agree on `rgb`. */
async function expectTone(
  box: Locator,
  rgb: number[],
  at: { x: number; y: number },
) {
  await expect(box).toHaveCSS('background-color', css(rgb))
  const [px] = await pixelsAt(box, [at])
  expect(px?.slice(0, 3)).toEqual(rgb)
}

async function expectWarmChrome(
  page: Page,
  canvas: Locator,
  field: Locator,
): Promise<void> {
  // Bar corner: no control sits in the top 2 px of the 12 px side padding.
  await expectTone(page.getByTestId('editor-bar'), CHROME, { x: 2, y: 2 })
  // Canvas tile middle, off the .30 dot at (16, 16).
  const [px] = await pixelsAt(canvas, [{ x: 24, y: 24 }])
  expect(px?.slice(0, 3)).toEqual(CANVAS)
  const h = (await field.boundingBox())?.height ?? 0
  // Field pill: inside the round end, left of the label.
  await expectTone(field, FIELD, { x: 8, y: Math.round(h / 2) })
}

test('prod editor: warm chrome bar, canvas and field paint (P10)', async ({
  page,
}) => {
  await openLibraryBook(page)
  // The canvas fill (dots on --canvas) sits on the workspace column; the
  // testid'd inner canvas is transparent over it.
  await expect(page.locator('.editor-workspace')).toHaveCSS(
    'background-color',
    css(CANVAS),
  )
  await expectWarmChrome(
    page,
    page.getByTestId('editor-workspace'),
    page.getByTestId('present'),
  )
})

test('kit #/demo editor: warm chrome bar, canvas and field paint (P10)', async ({
  page,
}) => {
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(() => {
    const d = (
      window as unknown as {
        __demo: {
          reset: () => void
          state: () => { path: string; books: unknown[]; open: string }
          go: (view: string) => void
        }
      }
    ).__demo
    d.reset()
    d.state().path = '~/Pictures/Photobooks'
    d.state().books = [
      {
        id: 's1',
        title: 'Lake trip',
        book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: 'A5' },
      },
    ]
    d.state().open = 's1'
    d.go('editor')
  })
  const field = page.getByTestId('demo-preview')
  await expect(field).toBeVisible()
  await expectWarmChrome(page, page.locator('.canvas-dots').last(), field)
})
