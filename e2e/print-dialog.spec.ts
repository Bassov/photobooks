import { PDFDocument } from '@cantoo/pdf-lib'
import type { Locator, Page, TestInfo } from '@playwright/test'
import { animationsSettled } from './fixtures/animationsSettled'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { expect, test } from './fixtures/coverage'
import { openLibraryBook } from './fixtures/openLibraryBook'
import { pixelsAt } from './fixtures/paintProbe'
import {
  denyNextWrite,
  holdPdf,
  openPrintFixture,
  readExport,
  readExportBytes,
  releasePdf,
} from './fixtures/printJob'

// pdf-export (Designer pdf-export D1–D10, §2.1–2.5, PE8–PE10): the product
// Print pill and dialog on the `?fixture=painter` editor in an OPFS library.
// Kit values (`uikit#/full/pdf-export`) are measured in the same run.

// The headless shell rounds text advances (Export site 111); the full
// Chromium build lays text out as the Designer measured it.
test.use({ viewport: { width: 1440, height: 900 }, channel: 'chromium' })

const TOL = 0.5
const pill = (page: Page) => page.getByTestId('print')
const dialog = (page: Page) => page.getByTestId('print-dialog')
const check = (page: Page) => page.getByTestId('print-check')

const folderFor = (testInfo: TestInfo) =>
  `print-e2e-${String(testInfo.workerIndex)}-${String(Date.now())}`

async function box(locator: Locator) {
  const b = await locator.boundingBox()
  if (b === null) throw new Error('expected a bounding box')
  return { ...b, right: b.x + b.width }
}

async function sizeOf(locator: Locator) {
  const b = await box(locator)
  return [Math.round(b.width * 100) / 100, Math.round(b.height * 100) / 100]
}

/** Click the bleed checkbox's label (its box covers the input). */
const toggleBleed = (page: Page) =>
  dialog(page)
    .getByText(/^Add \d+(\.\d)? mm bleed and crop marks$/)
    .click()

async function openPrint(page: Page) {
  await pill(page).click()
  await expect(dialog(page)).toHaveAttribute('data-step', 'opts')
}

/** Tops of the dialog parts below the title (px from the title's top). */
async function offsets(page: Page, ids: string[]) {
  const scope = dialog(page)
  await animationsSettled(page.getByRole('dialog'))
  const title = await box(scope.locator(':scope > :first-child'))
  const tops: Record<string, number> = {}
  for (const id of ids) {
    tops[id] = (await box(scope.getByTestId(id).first())).y - title.y
  }
  return tops
}

/** The kit's #/full/pdf-export at scenario `tab`. */
async function kitAt(page: Page, tab: string) {
  await page.goto('/uikit/#/full/pdf-export')
  await page
    .getByTestId('scenarios')
    .getByRole('tab', { name: tab, exact: true })
    .evaluate((t: HTMLElement) => {
      t.click()
    })
  await expect(dialog(page)).toBeVisible()
}

/** Width, dialog paint, the primary button's box and paint. */
async function frameLook(page: Page, primary: string) {
  const panel = page.getByRole('dialog')
  const button = page.getByTestId(primary)
  const b = await box(button)
  const [bg] = await pixelsAt(panel, [{ x: 4, y: 40 }])
  const [ink] = await pixelsAt(button, [{ x: b.width / 2, y: 3 }])
  return {
    width: (await box(panel)).width,
    button: [b.width, b.height],
    bg,
    ink,
  }
}

function nearAll(
  actual: Record<string, number>,
  want: Record<string, number>,
  tol: number,
) {
  for (const [key, value] of Object.entries(want)) {
    const got = actual[key] ?? Number.NaN
    expect(
      Math.abs(got - value),
      `${key}: ${String(got)} (kit ${String(value)})`,
    ).toBeLessThan(tol)
  }
}

test.describe('pdf-export top bar', () => {
  test('1440: Preview · Settings · Export site · Print · Publish at the Spec x', async ({
    page,
  }) => {
    await openLibraryBook(page)
    const want: [string, number, number][] = [
      ['present', 1042.64, 95.45],
      ['editor-settings-open', 1144.09, 40],
      ['export-site', 1190.09, 112.33],
      ['print', 1308.42, 40],
      ['publish', 1354.42, 73.58],
    ]
    for (const [id, x, width] of want) {
      const b = await box(page.getByTestId(id))
      expect(Math.abs(b.x - x), `${id} x`).toBeLessThan(TOL)
      expect(Math.abs(b.width - width), `${id} width`).toBeLessThan(TOL)
      expect(b.height).toBe(32)
    }
    await expect(pill(page)).toHaveAttribute('title', 'Print')
    await expect(pill(page)).toHaveAttribute('aria-label', 'Print')
  })

  for (const width of [1280, 1423, 1424, 1440]) {
    test(`${String(width)} px: Export site ${width < 1424 ? 'icon-only' : 'labelled'}, ≥ 24 px before the end group`, async ({
      page,
    }) => {
      await openLibraryBook(page)
      await page.setViewportSize({ width, height: 900 })
      const exportWidth = (await box(page.getByTestId('export-site'))).width
      const labelled = width >= 1424
      expect(Math.abs(exportWidth - 40) < TOL).toBe(!labelled)
      expect(exportWidth > 100).toBe(labelled)
      const tools = await box(page.getByTestId('grid-topbar-toggle'))
      const end = await box(page.locator('.editor-top-end'))
      expect(end.x - tools.right).toBeGreaterThanOrEqual(24)
      expect(await sizeOf(pill(page))).toEqual([40, 32])
      await assertDocumentFitsViewport(page)
    })
  }
})

test.describe('pdf-export dialog', () => {
  test('options: rows, bleed summary and the Check issues', async ({
    page,
  }, testInfo) => {
    await openPrintFixture(page, folderFor(testInfo), '&px=200')
    await openPrint(page)

    await expect(page.getByTestId('print-size')).toHaveText(
      'Page sizeSquare 30×30 · 30 × 30 cm',
    )
    await expect(page.getByTestId('print-profile')).toHaveText('PrinterGeneric')
    await expect(page.getByTestId('print-imposition')).toHaveText(
      'Imposition (duplex)1 per sheet2-up4-up',
    )
    await expect(
      dialog(page).getByRole('radio', { name: '1 per sheet' }),
    ).toBeChecked()
    await expect(page.getByTestId('print-bleed')).toBeChecked()
    await expect(dialog(page)).toContainText('Add 3 mm bleed and crop marks')
    const summary = page.getByTestId('print-summary')
    await expect(summary).toHaveText(/^PDF · \d+ pages · bleed 3 mm$/)
    await toggleBleed(page)
    await expect(summary).toHaveText(/^PDF · \d+ pages · trim size, no marks$/)

    await expect(check(page)).toHaveAttribute('data-state', 'issues')
    await expect(check(page)).toContainText(/^Check · \d+ errors?/)
    const low = check(page).locator('[data-rule="dpi-below-min"]')
    await expect(low).toHaveText(
      /^\d+ photos below \d+ ppi · pages 1, 2, 3, 4, 5 \+\d+$/,
    )
    await expect(
      check(page).locator('[data-rule="empty-image-frame"]'),
    ).toHaveText('1 empty photo frame · page 1')
    await expect(page.getByTestId('print-check-note')).toBeVisible()
    await expect(page.getByTestId('print-go')).toBeEnabled()
    // The list scrolls inside its 118.25 px cap; the page never scrolls.
    expect(
      (await box(page.getByTestId('print-check-list'))).height,
    ).toBeLessThanOrEqual(118.5)
    await assertDocumentFitsViewport(page)
  })

  test('options and done steps sit like the kit', async ({
    page,
  }, testInfo) => {
    const ids = [
      'print-size',
      'print-profile',
      'print-imposition',
      'print-summary',
      'print-check',
    ]
    await kitAt(page, 'No problems')
    const kitOpts = await offsets(page, ids)
    const kitOptsLook = await frameLook(page, 'print-go')
    await kitAt(page, 'PDF ready')
    const kitDone = await offsets(page, [
      'print-done',
      'print-saved',
      'print-open',
    ])
    const kitDoneLook = await frameLook(page, 'print-close')

    await openPrintFixture(page, folderFor(testInfo))
    await openPrint(page)
    nearAll(await offsets(page, ids), kitOpts, 1)
    const optsLook = await frameLook(page, 'print-go')
    expect(optsLook.width).toBeCloseTo(kitOptsLook.width, 0)
    expect(optsLook.button[1]).toBe(kitOptsLook.button[1])
    expect(
      Math.abs((optsLook.button[0] ?? 0) - (kitOptsLook.button[0] ?? 0)),
    ).toBeLessThan(1)
    expect(optsLook.bg).toEqual(kitOptsLook.bg)
    expect(optsLook.ink).toEqual(kitOptsLook.ink)

    await page.getByTestId('print-go').click()
    await expect(dialog(page)).toHaveAttribute('data-step', 'done', {
      timeout: 30_000,
    })
    nearAll(
      await offsets(page, ['print-done', 'print-saved', 'print-open']),
      kitDone,
      1,
    )
    const doneLook = await frameLook(page, 'print-close')
    expect(doneLook.bg).toEqual(kitDoneLook.bg)
    expect(doneLook.ink).toEqual(kitDoneLook.ink)
  })

  test('Export → Hide → the pill fills → PDF ready → Open PDF', async ({
    page,
  }, testInfo) => {
    const folder = folderFor(testInfo)
    await openPrintFixture(page, folder)
    await openPrint(page)
    await holdPdf(page)
    await page.getByTestId('print-go').click()

    await expect(dialog(page)).toHaveAttribute('data-step', 'run')
    const runText = page.getByTestId('print-run-text')
    await expect(runText).toHaveText(/^Page 1 of \d+ · 0%$/)
    const sheets = Number(
      /of (\d+)/.exec((await runText.textContent()) ?? '')?.[1],
    )
    const half = Math.floor(sheets / 2)
    await releasePdf(page, half)
    await expect(runText).toHaveText(
      `Page ${String(half + 1)} of ${String(sheets)} · ${String(Math.round((95 * half) / sheets))}%`,
    )
    await page.getByTestId('print-hide').click()
    await expect(dialog(page)).toHaveCount(0)

    // Running: the --control fill covers the left half of the pill, by paint.
    await expect(pill(page)).toHaveAttribute('data-state', 'running')
    await expect(pill(page)).toHaveAttribute('title', /^Exporting PDF · \d+%$/)
    expect(await sizeOf(pill(page))).toEqual([40, 32])
    await expect
      .poll(async () => {
        const [left, right] = await pixelsAt(pill(page), [
          { x: 3, y: 16 },
          { x: 37, y: 16 },
        ])
        return [left?.[0], right?.[0]]
      })
      .toEqual([190, 215])

    await releasePdf(page)
    await expect(pill(page)).toHaveAttribute('data-state', 'done', {
      timeout: 30_000,
    })
    await expect(pill(page)).toHaveAttribute('title', 'PDF ready')
    expect(await sizeOf(pill(page))).toEqual([40, 32])
    await pill(page).click()

    await expect(dialog(page)).toHaveAttribute('data-step', 'done')
    const done = page.getByTestId('print-done')
    await expect(done).toHaveText(
      new RegExp(
        `^[a-z0-9-]+-sq30\\.pdf · ${String(sheets)} pages · \\d+\\.\\d MB$`,
      ),
    )
    const [file = '', , mb = ''] = ((await done.textContent()) ?? '').split(
      ' · ',
    )
    const written = await readExport(page, folder, file)
    expect(written?.head).toBe('%PDF-')
    expect((written?.bytes ?? 0) / 1_000_000).toBeCloseTo(
      Number.parseFloat(mb),
      1,
    )
    await expect(page.getByTestId('print-saved')).toHaveText(
      `Saved in ${folder}/exports.`,
    )

    const popup = page.waitForEvent('popup')
    await page.getByTestId('print-open').click()
    expect((await popup).url()).toMatch(/^blob:/)
    await page.getByTestId('print-close').click()
    await expect(dialog(page)).toHaveCount(0)
  })

  test('a denied write fails with the access text; Try again writes', async ({
    page,
  }, testInfo) => {
    const folder = folderFor(testInfo)
    await openPrintFixture(page, folder)
    await openPrint(page)
    await toggleBleed(page)
    await denyNextWrite(page)
    await holdPdf(page)
    await page.getByTestId('print-go').click()
    await page.getByTestId('print-hide').click()
    await releasePdf(page)

    await expect(pill(page)).toHaveAttribute('data-state', 'failed', {
      timeout: 30_000,
    })
    await expect(pill(page)).toHaveAttribute('title', 'PDF not exported')
    expect(await sizeOf(pill(page))).toEqual([40, 32])
    await pill(page).click()
    await expect(dialog(page)).toHaveAttribute('data-step', 'failed')
    await expect(page.getByTestId('print-error')).toHaveText(
      `Photobooks can’t write to “${folder}”. Allow access to the folder and try again.`,
    )

    await page.getByTestId('print-retry').click()
    await expect(dialog(page)).toHaveAttribute('data-step', 'done', {
      timeout: 30_000,
    })
    const file =
      ((await page.getByTestId('print-done').textContent()) ?? '').split(
        ' · ',
      )[0] ?? ''
    expect((await readExport(page, folder, file))?.head).toBe('%PDF-')
  })
})

// booklet-imposition: 2-up / 4-up booklets of short painter books. Book
// pages are even, so the 14-page book stands in for 13 (4 / 2 sheets too).
test.describe('booklet-imposition', () => {
  const runs = [
    { spreads: 5, pages: 8, id: '2up', label: '2-up', sheets: '2 sheets' },
    { spreads: 5, pages: 8, id: '4up', label: '4-up', sheets: '1 sheet' },
    { spreads: 8, pages: 14, id: '2up', label: '2-up', sheets: '4 sheets' },
    { spreads: 8, pages: 14, id: '4up', label: '4-up', sheets: '2 sheets' },
  ] as const
  const flips = {
    '2up': 'flip on the short edge',
    '4up': 'flip on the long edge',
  } as const

  for (const run of runs) {
    test(`a ${String(run.pages)}-page book prints ${run.label} on ${run.sheets}`, async ({
      page,
    }, testInfo) => {
      const folder = folderFor(testInfo)
      await openPrintFixture(page, folder, `&spreads=${String(run.spreads)}`)
      await openPrint(page)
      await dialog(page).getByRole('radio', { name: run.label }).check()
      await expect(page.getByTestId('print-summary')).toHaveText(
        `PDF · ${String(run.pages)} pages on ${run.sheets} · bleed 3 mm`,
      )
      await assertDocumentFitsViewport(page)
      await page.getByTestId('print-go').click()
      await expect(dialog(page)).toHaveAttribute('data-step', 'done', {
        timeout: 30_000,
      })

      const done = page.getByTestId('print-done')
      await expect(done).toHaveText(
        new RegExp(
          `^[a-z0-9-]+-sq30-${run.id}\\.pdf · ${run.sheets} · \\d+\\.\\d MB$`,
        ),
      )
      await expect(page.getByTestId('print-duplex')).toContainText(
        flips[run.id],
      )
      const [file = ''] = String(await done.textContent()).split(' · ')
      const pdf = await PDFDocument.load(
        await readExportBytes(page, folder, file),
      )
      // Front and back of every paper sheet.
      expect(pdf.getPageCount()).toBe(2 * Number.parseInt(run.sheets, 10))
    })
  }

  test('the run says it is imposing after painting', async ({
    page,
  }, testInfo) => {
    await openPrintFixture(page, folderFor(testInfo), '&spreads=8')
    await openPrint(page)
    await dialog(page).getByRole('radio', { name: '2-up' }).check()
    await holdPdf(page)
    await page.getByTestId('print-go').click()
    // 14 painted pages and the paint `done`.
    await releasePdf(page, 15)
    await expect(page.getByTestId('print-run-text')).toHaveText(
      /^Imposing sheets · [1-4] of 4 · (8\d|9[0-5])%$/,
    )
    await releasePdf(page)
    await expect(dialog(page)).toHaveAttribute('data-step', 'done', {
      timeout: 30_000,
    })
    await expect(page.getByTestId('print-done')).toContainText(' · 4 sheets · ')
  })
})
