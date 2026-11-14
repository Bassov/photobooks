import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { animationsSettled } from './fixtures/animationsSettled'
import { topAt } from './fixtures/paintProbe'

// pdf-export-kit (Designer pdf-export §2.1–2.4, PE1–PE3): the kit #/demo Print
// dialog. Options with a read-only "1 per sheet" row (2-up / 4-up hidden), the
// D5 summary, the Check block (checking / clean / issues, never blocking), the
// run (Hide / Esc hide it), PDF ready with Open PDF and the saved path, and
// the failed step. Values are the Spec's, measured in the DOM.

test.use({ viewport: { width: 1440, height: 900 } })

type Frame = Record<string, unknown>
interface Win {
  __demo: {
    reset: () => void
    go: (s: string) => void
    state: () => {
      open: string
      books: { id: string; doc: { spreads: { frames: Frame[] }[] } }[]
    }
  }
  __printDemo: { fail: (f: string) => void }
}

const demo = (page: Page) => page.getByTestId('demo')
const dialog = (page: Page) => page.getByTestId('print-dialog')
const check = (page: Page) => page.getByTestId('print-check')
const rows = (page: Page) => check(page).getByTestId('print-check-row')

/** A new book (Create book default A5 portrait, 10 spreads of empty frames). */
async function openNewBook(page: Page) {
  await page.goto('/uikit/#/demo')
  await expect(demo(page)).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as Win).__demo.reset()
  })
  await demo(page).getByTestId('create-library').click()
  await page.getByTestId('picker-select').click()
  await demo(page).getByTestId('new-book').click()
  await page.locator('[role=dialog] input').first().fill('Lake trip')
  await page.getByTestId('create-book').click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
}

const img = (
  id: string,
  x: number,
  w: number,
  h: number,
  photo: string | null,
): Frame => ({
  id,
  kind: 'image',
  x,
  y: 10,
  w,
  h,
  photo,
  zoom: 1,
  ox: 0,
  oy: 0,
  rot: 0,
  qt: 0,
  straighten: 0,
})

/**
 * Replaces the open book's spreads (base geometry: 200 × 200 mm pages) and
 * its missing photos, then remounts the editor so the studio reads them.
 */
async function seedBook(
  page: Page,
  spreads: Frame[][],
  missing: string[] = [],
  print?: object,
) {
  await page.evaluate(() => {
    ;(window as unknown as Win).__demo.go('library')
  })
  await expect(demo(page)).toHaveAttribute('data-demo-stage', 'library')
  await page.evaluate(
    ([spreads, missing, print]) => {
      const d = (window as unknown as Win).__demo
      const S = d.state()
      S.books = S.books.map((b) =>
        b.id === S.open
          ? {
              ...b,
              missing,
              doc: {
                ...b.doc,
                ...(print ? { print } : {}),
                spreads: spreads.map((frames, i) => ({
                  ...b.doc.spreads[i % b.doc.spreads.length],
                  frames,
                })),
              },
            }
          : b,
      )
      d.go('editor')
    },
    [spreads, missing, print] as const,
  )
  await expect(demo(page).getByTestId('demo-print')).toBeVisible()
}

async function openPrint(page: Page) {
  await demo(page).getByTestId('demo-print').click()
  await expect(dialog(page)).toHaveAttribute('data-step', 'opts')
}

const ISSUES: Frame[][] = [
  [img('a', 10, 80, 80, 'p13'), img('b', 210, 80, 80, 'p09')],
  [img('c', 0, 400, 200, 'p02'), img('d', 250, 60, 60, 'p05')],
  [
    img('e', 10, 60, 60, 'p19'),
    img('f', 250, 60, 60, null),
    { ...img('g', 20, 80, 20, null), kind: 'text', text: '' },
  ],
]

test.beforeEach(async ({ page }) => {
  await openNewBook(page)
})

test('dialog box, title and buttons carry the Spec values', async ({
  page,
}) => {
  await openPrint(page)
  await animationsSettled(page.locator('[role=dialog]'))
  const m = await dialog(page).evaluate((pd) => {
    const cs = getComputedStyle
    // the painted box: the first ancestor with a background (role=dialog is transparent)
    let el: Element = pd
    while (cs(el).backgroundColor === 'rgba(0, 0, 0, 0)' && el.parentElement)
      el = el.parentElement
    const t = pd.querySelector('.heading') ?? pd
    const go = pd.querySelector('[data-testid="print-go"]') ?? pd
    return {
      w: el.getBoundingClientRect().width,
      r: cs(el).borderTopLeftRadius,
      bg: cs(el).backgroundColor,
      pad: [
        cs(pd).paddingTop,
        cs(pd).paddingRight,
        cs(pd).paddingBottom,
        cs(pd).paddingLeft,
      ].join(' '),
      font: [
        cs(t).fontFamily.split(',')[0],
        cs(t).fontSize,
        cs(t).lineHeight,
        cs(t).fontWeight,
        cs(t).color,
      ].join(' '),
      btn: [
        go.getBoundingClientRect().height,
        cs(go).borderTopLeftRadius,
        cs(go).paddingLeft,
        cs(go).backgroundColor,
        cs(go).color,
      ].join(' '),
    }
  })
  expect(m).toEqual({
    w: 500,
    r: '14px',
    bg: 'rgb(225, 225, 225)',
    pad: '20px 24px 20px 24px',
    font: '"Lora Variable" 21px 26.25px 500 rgb(57, 55, 56)',
    btn: '36 8px 16px rgb(35, 34, 35) rgb(242, 242, 242)',
  })
})

test('PE1 options: 1 per sheet row, profile bleed label, D5 summary', async ({
  page,
}) => {
  await openPrint(page)
  await expect(dialog(page).getByTestId('print-size')).toHaveText(
    'Page sizeA5 · 14.8 × 21 cm',
  )
  await expect(dialog(page).getByTestId('print-profile')).toHaveText(
    'PrinterGeneric',
  )
  await expect(dialog(page).getByTestId('print-imposition')).toHaveText(
    'Imposition1 per sheet',
  )
  await expect(dialog(page).getByText(/2-up|4-up/)).toHaveCount(0)
  await expect(dialog(page).getByRole('radio')).toHaveCount(0)
  const bleed = dialog(page).getByRole('checkbox', {
    name: 'Add 3 mm bleed and crop marks',
  })
  await expect(bleed).toBeChecked()
  const summary = dialog(page).getByTestId('print-summary')
  await expect(summary).toHaveText('PDF · 20 pages · bleed 3 mm')
  await dialog(page).getByTestId('print-bleed').click()
  await expect(bleed).not.toBeChecked()
  await expect(summary).toHaveText('PDF · 20 pages · trim size, no marks')
})

test('PE1 bleed label and Printer row follow the book profile', async ({
  page,
}) => {
  await seedBook(
    page,
    Array.from({ length: 10 }, () => []),
    [],
    { profile: 'custom-lulu-copy', bleed: 5, safe: 15 },
  )
  await openPrint(page)
  await expect(dialog(page).getByTestId('print-profile')).toHaveText(
    'PrinterLulu · Photo book (copy)',
  )
  await expect(dialog(page).getByTestId('print-bleed')).toHaveText(
    'Add 5 mm bleed and crop marks',
  )
  await expect(dialog(page).getByTestId('print-summary')).toHaveText(
    'PDF · 20 pages · bleed 5 mm',
  )
})

test('PE2 check: checking, then issues; Export PDF stays enabled', async ({
  page,
}) => {
  await openPrint(page)
  const go = dialog(page).getByTestId('print-go')
  await expect(check(page)).toHaveAttribute('data-state', 'checking')
  await expect(rows(page)).toHaveText(['Checking the book…'])
  await expect(go).toBeEnabled()
  await expect(check(page)).toHaveAttribute('data-state', 'issues')
  await expect(go).toBeEnabled()
  // the blank book: every photo frame is empty (warning), the page list stops at 5
  const empty = check(page).locator('[data-rule="empty-image-frame"]')
  await expect(empty).toHaveText(
    /^\d+ empty photo frames · pages (\d+, ){4}\d+ \+\d+$/,
  )
  await expect(check(page)).toContainText('Check · 1 warning')
  await expect(dialog(page).getByTestId('print-check-note')).toHaveCount(0)
})

test('PE2 check: clean book shows No problems found', async ({ page }) => {
  await seedBook(
    page,
    Array.from({ length: 10 }, () => []),
  )
  await openPrint(page)
  await expect(check(page)).toHaveAttribute('data-state', 'clean')
  await expect(check(page)).toHaveText('CheckNo problems found')
})

test('PE2 check: rows ordered by severity, styled, capped at 118.25 px', async ({
  page,
}) => {
  await seedBook(page, ISSUES, ['p13', 'p09'])
  await openPrint(page)
  await expect(check(page)).toHaveAttribute('data-state', 'issues')
  await expect(check(page).locator('span').first()).toHaveText(
    'Check · 3 errors, 2 warnings',
  )
  await expect(rows(page)).toHaveText([
    'Generic prints at least 20 pages. This book has 6.',
    '2 photos can’t be found · pages 1, 2',
    '1 photo below 150 ppi · page 3',
    '2 photos aren’t sRGB (Adobe RGB, Display P3), colours may shift · pages 4, 5',
    '1 empty photo frame · page 6',
    '1 empty text frame · page 5',
  ])
  const style = await rows(page).evaluateAll((els) =>
    els.map((el) => {
      const cs = getComputedStyle(el)
      const svg = el.querySelector('svg') ?? el
      return [
        cs.color,
        cs.fontWeight,
        cs.fontSize,
        cs.lineHeight,
        svg.getBoundingClientRect().width,
        // icon centred on the first line: (18.85 − 16) / 2 below the row top
        (
          svg.getBoundingClientRect().top - el.getBoundingClientRect().top
        ).toFixed(2),
      ].join(' ')
    }),
  )
  expect(style).toEqual([
    'rgb(35, 34, 35) 500 13px 18.85px 16 1.42',
    'rgb(35, 34, 35) 500 13px 18.85px 16 1.42',
    'rgb(35, 34, 35) 500 13px 18.85px 16 1.42',
    'rgb(57, 55, 56) 400 13px 18.85px 16 1.42',
    'rgb(57, 55, 56) 400 13px 18.85px 16 1.42',
    'rgb(83, 81, 82) 400 13px 18.85px 16 1.42',
  ])
  const list = check(page).getByTestId('print-check-list')
  const cap = await list.evaluate((el) => [
    el.getBoundingClientRect().height,
    el.scrollHeight > el.clientHeight,
    getComputedStyle(el).overflowY,
  ])
  expect(cap).toEqual([118.25, true, 'auto'])
  // the 6th row is clipped: what paints there is the note under the list, not the row
  const hit = await topAt(rows(page).nth(5))
  expect(hit[0]).not.toContain('print-check-row')
  await expect(dialog(page).getByTestId('print-check-note')).toHaveText(
    'Print shops may refuse a PDF with errors. You can still export it, for example to proof it.',
  )
  await expect(dialog(page).getByTestId('print-go')).toBeEnabled()
})

test('PE3 run: page progress, 6 px bar, Esc hides; done with Open PDF', async ({
  page,
}) => {
  await seedBook(page, ISSUES, ['p13', 'p09'])
  await openPrint(page)
  await dialog(page).getByTestId('print-go').click()
  await expect(dialog(page)).toHaveAttribute('data-step', 'run')
  await expect(dialog(page).getByTestId('print-run-text')).toHaveText(
    /^(Page [1-6] of 6|Saving) · \d+%$/,
  )
  const bar = dialog(page).getByTestId('print-progress')
  await expect(bar).toHaveAccessibleName('Exporting PDF')
  expect((await bar.boundingBox())?.height).toBe(6)
  await expect(dialog(page)).toContainText(
    'You can keep editing. Changes from now on aren’t in this PDF.',
  )
  await expect(dialog(page).getByTestId('print-hide')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)

  await openPrint(page)
  await dialog(page).getByTestId('print-go').click()
  await expect(dialog(page)).toHaveAttribute('data-step', 'done')
  await expect(dialog(page).getByTestId('print-done')).toHaveText(
    'lake-trip-A5.pdf · 6 pages · 11.5 MB',
  )
  await expect(dialog(page).getByTestId('print-saved')).toHaveText(
    /^Saved in .+\/exports\.$/,
  )
  await expect(dialog(page).getByTestId('print-skipped')).toHaveText(
    '2 photos couldn’t be read and print as blank paper · pages 1, 2',
  )
  await expect(dialog(page).getByTestId('print-show')).toHaveCount(0)
  await expect(dialog(page).getByTestId('print-close')).toBeFocused()
  // headless Chromium has no PDF viewer (the tab downloads), so read the opened URL
  await page.evaluate(() => {
    const w = window as unknown as { opened: string[] }
    w.opened = []
    window.open = (url?: string | URL) => (w.opened.push(String(url)), null)
  })
  await dialog(page).getByTestId('print-open').click()
  const opened = await page.evaluate(async () => {
    const url = (window as unknown as { opened: string[] }).opened.join()
    const r = await fetch(url)
    return [
      url.slice(0, 5),
      r.headers.get('content-type'),
      (await r.text()).slice(0, 8),
    ]
  })
  expect(opened).toEqual(['blob:', 'application/pdf', '%PDF-1.4'])
  await dialog(page).getByTestId('print-close').click()
  await expect(dialog(page)).toHaveCount(0)
})

test('PE3 run: Hide and an outside click hide it', async ({ page }) => {
  await openPrint(page)
  await dialog(page).getByTestId('print-go').click()
  await expect(dialog(page)).toHaveAttribute('data-step', 'run')
  await expect(dialog(page).getByTestId('print-run-text')).toHaveText(
    /^(Page \d+ of 20|Saving) · \d+%$/,
  )
  await dialog(page).getByTestId('print-hide').click()
  await expect(dialog(page)).toHaveCount(0)
  await openPrint(page)
  await dialog(page).getByTestId('print-go').click()
  await page.mouse.click(20, 450)
  await expect(dialog(page)).toHaveCount(0)
})

test('PE3 failed: access / full / other texts, Try again exports', async ({
  page,
}) => {
  await openPrint(page)
  // the first export starts from Export PDF, the next ones from Try again
  for (const [kind, button, text] of [
    [
      'access',
      'print-go',
      /^Photobooks can’t write to “.+”\. Allow access to the folder and try again\.$/,
    ],
    ['full', 'print-retry', /^The disk is full\.$/],
    [
      'other',
      'print-retry',
      /^Something went wrong while making the PDF\. Try again\.$/,
    ],
  ] as const) {
    await page.evaluate((k) => {
      ;(window as unknown as Win).__printDemo.fail(k)
    }, kind)
    await dialog(page).getByTestId(button).click()
    await expect(dialog(page)).toHaveAttribute('data-step', 'failed')
    await expect(dialog(page).getByText('PDF not exported')).toBeVisible()
    await expect(dialog(page).getByTestId('print-error')).toHaveText(text)
  }
  await expect(
    dialog(page).getByRole('button', { name: 'Close' }),
  ).toBeVisible()
  await dialog(page).getByTestId('print-retry').click()
  await expect(dialog(page)).toHaveAttribute('data-step', 'done')
})
