import { expect, test } from './fixtures/coverage'
import { createBookViaLibrary } from './fixtures/createBookViaLibrary'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { deflateSync } from 'node:zlib'
import assert from 'node:assert/strict'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import {
  applyCpuThrottling,
  assertCiPerfGates,
  assertCrossOriginIsolated,
  beginFilmstripLoafScrollWindow,
  browserAssertNoLoaf,
  clearPerfScenario,
  collectFrameStatsArtifact,
  enablePerfScenario,
  scrollFilmstripLoafWindow,
} from './perf/perfFixture'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
  queuePhotoDirectoryPicker,
  type StubPhotoFile,
} from './fixtures/photoDirectoryPicker'
import { dragPlaceFirstFilmstripItem } from './fixtures/dropAssetOnFrame'
import { openSessionEditor } from './fixtures/openSessionEditor'
import type { Page } from '@playwright/test'

/** New book from editor chrome: confirm (if dirty) + title prompt → Book created. */
async function createBookFromEditorChrome(
  page: Page,
  title = 'Filmstrip book',
): Promise<void> {
  const onDialog = (dialog: {
    type: () => string
    accept: (v?: string) => Promise<void>
  }) => {
    if (dialog.type() === 'confirm') {
      void dialog.accept()
      return
    }
    void dialog.accept(title)
  }
  page.on('dialog', onDialog)
  try {
    await createBookViaLibrary(page, title)
  } finally {
    page.off('dialog', onDialog)
  }
}

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

async function pickPhotoFolder(
  page: Page,
  paths: string | readonly string[],
  options?: {
    button?: 'top' | 'pasteboard'
    replaceFolder?: boolean
    via?: 'input' | 'picker'
  },
): Promise<void> {
  if (options?.replaceFolder) {
    // Native confirm is sync; Playwright dialog IPC is not product latency.
    await page.evaluate(() => {
      window.confirm = () => true
    })
  }
  const list = typeof paths === 'string' ? [paths] : paths
  await choosePhotoFolder(page, list, {
    ...(options?.button ? { button: options.button } : {}),
    ...(options?.via ? { via: options.via } : {}),
  })
}

async function pickPhotoFolderStub(
  page: Page,
  files: readonly StubPhotoFile[],
  options?: { replaceFolder?: boolean },
): Promise<void> {
  if (options?.replaceFolder) {
    await page.evaluate(() => {
      window.confirm = () => true
    })
  }
  await queuePhotoDirectoryPicker(page, files)
  await page.getByTestId('choose-photo-folder').click()
}

test('empty filmstrip message spans the scrollport', async ({ page }) => {
  await openSessionEditor(page)
  const empty = page.getByTestId('filmstrip-empty')
  await expect(empty).toBeVisible()
  await expect(empty).toHaveText(
    'No photos yet — add a folder or drop one here.',
  )
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(0)
  const box = await empty.boundingBox()
  assert.ok(box)
  // Bug: 1px virtualizer window stacked one word per line.
  expect(box.width).toBeGreaterThan(240)
  // Kit empty row is one thumb tall (h-(--thumb)).
  expect(box.height).toBeLessThan(120)
  await assertDocumentFitsViewport(page)
})

test('non-ASCII file name is the filmstrip thumbnail name', async ({
  page,
}) => {
  const fileName = 'фото отпуск 01.jpg'
  const namedPath = join(
    tmpdir(),
    `pb-cyrillic-${String(Date.now())}-${fileName}`,
  )
  writeFileSync(namedPath, readFileSync(photoFixturePaths.samplePng))
  await openSessionEditor(page)
  await pickPhotoFolder(page, [namedPath])

  const thumb = page.getByRole('row', { name: fileName })
  await expect(thumb).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('row', { name: /^asset-/ })).toHaveCount(0)
  await thumb.click()
  await expect(thumb).toHaveAttribute('aria-selected', 'true')
  await assertDocumentFitsViewport(page)
})

test('imports PNG into the filmstrip via directory picker', async ({
  page,
}) => {
  await openSessionEditor(page)
  await pickPhotoFolder(page, [photoFixturePaths.samplePng], { via: 'picker' })

  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('filmstrip-thumb')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByTestId('film-head')).toContainText('Photos · 1 ·')
})

test('list-first folder pick shows gallery placeholders before all thumbs', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const { files } = writeBulkImportFixtureSet(48)
  await openSessionEditor(page)
  // Slow decode so list-enqueue placeholders stay visible after count hits 48.
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 })
  try {
    const sawListFirst = page.waitForFunction(() => {
      const count = document
        .querySelector('[data-testid="filmstrip"]')
        ?.getAttribute('data-gallery-count')
      if (count !== '48') {
        return false
      }
      return (
        document.querySelector('[data-testid="filmstrip-placeholder"]') !== null
      )
    })
    await pickPhotoFolder(page, files, { via: 'picker' })
    await sawListFirst
    await expect(page.getByTestId('film-head')).toContainText('Photos · 48 ·', {
      timeout: 60_000,
    })
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  }
  await assertDocumentFitsViewport(page)
})

test('portrait and landscape cards differ; thumbs use cover', async ({
  page,
}) => {
  await openSessionEditor(page)
  await pickPhotoFolder(page, [
    photoFixturePaths.samplePng,
    photoFixturePaths.sampleOrient6,
  ])

  await expect(page.getByTestId('filmstrip-item')).toHaveCount(2, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(2, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('film-head')).toContainText('Photos · 2 ·')

  const land = page.locator(
    '[data-testid="filmstrip-item"][data-orientation="landscape"]',
  )
  const port = page.locator(
    '[data-testid="filmstrip-item"][data-orientation="portrait"]',
  )
  await expect(land).toHaveCount(1, { timeout: 30_000 })
  await expect(port).toHaveCount(1, { timeout: 30_000 })

  const landBox = await land.boundingBox()
  const portBox = await port.boundingBox()
  expect(landBox).toBeTruthy()
  expect(portBox).toBeTruthy()
  expect((portBox?.width ?? 0) < (landBox?.width ?? 0)).toBe(true)

  const objectFit = await page
    .getByTestId('filmstrip-thumb')
    .first()
    .evaluate((node) => getComputedStyle(node).objectFit)
  expect(objectFit).toBe('cover')
})

test('external drag shows the overlay', async ({ page }) => {
  await openSessionEditor(page)
  await pickPhotoFolder(page, [
    photoFixturePaths.samplePng,
    photoFixturePaths.sampleOrient6,
  ])
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(2, {
    timeout: 30_000,
  })

  const overlay = page.getByTestId('film-drop-overlay')
  await expect(overlay).toHaveCount(0)
  await page.getByTestId('dock').dispatchEvent('dragover', {
    dataTransfer: await page.evaluateHandle(() => {
      const data = new DataTransfer()
      data.items.add(new File(['x'], 'x.txt'))
      return data
    }),
  })
  await expect(overlay).toHaveText('Drop a folder to add its photos')
  await page.getByTestId('dock').dispatchEvent('dragleave')
  await expect(overlay).toHaveCount(0)
})

test('portrait gallery fills the scrollport while scrolling', async ({
  page,
}) => {
  test.setTimeout(120_000)
  // Many identical portraits — fixed WINDOW_SIZE left a hole on wide viewports.
  const files = Array.from(
    { length: 36 },
    () => photoFixturePaths.sampleOrient6,
  )
  await openSessionEditor(page)
  await pickPhotoFolder(page, files)

  await expect
    .poll(
      async () =>
        page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
      { timeout: 120_000 },
    )
    .toBe('36')

  const scroll = page.getByTestId('filmstrip-scroll')
  const maxScroll = await scroll.evaluate(
    (node) => node.scrollWidth - node.clientWidth,
  )
  expect(maxScroll).toBeGreaterThan(0)

  // Mid-scroll is the regression: fixed WINDOW_SIZE left a hole while more
  // cards still exist to the right. End-of-strip may legitimately not fill.
  for (const left of [0, Math.floor(maxScroll / 2)]) {
    await scroll.evaluate((node, nextLeft) => {
      node.scrollLeft = nextLeft
    }, left)
    await page.waitForTimeout(50)

    const coverage = await page.evaluate(() => {
      const port = document.querySelector('[data-testid="filmstrip-scroll"]')
      if (!(port instanceof HTMLElement)) {
        return { ok: false, reason: 'no-scrollport' }
      }
      const portBox = port.getBoundingClientRect()
      const items = Array.from(
        document.querySelectorAll('[data-testid="filmstrip-item"]'),
      )
      if (items.length === 0) {
        return { ok: false, reason: 'no-items' }
      }
      let maxRight = 0
      for (const el of items) {
        const box = el.getBoundingClientRect()
        if (box.right > maxRight) {
          maxRight = box.right
        }
      }
      // Rightmost mounted card should reach near the scrollport's right edge
      // (allow scrollbar / padding slack). A fixed 16-item window leaves >400px.
      const hole = portBox.right - maxRight
      return { ok: hole < 120, hole, itemCount: items.length }
    })

    expect(coverage.ok, JSON.stringify(coverage)).toBe(true)
  }
})

test('mixed aspect cards pack with uniform gaps from each card end', async ({
  page,
}) => {
  await openSessionEditor(page)
  await page.bringToFront()
  // Two landscapes then three portraits — fixed max-width stride leaves huge gaps
  // between portraits (see aspect filmstrip packing bug).
  await pickPhotoFolder(page, [
    photoFixturePaths.samplePng,
    photoFixturePaths.samplePng,
    photoFixturePaths.sampleOrient6,
    photoFixturePaths.sampleOrient6,
    photoFixturePaths.sampleOrient6,
  ])

  await expect(page.getByTestId('filmstrip-item')).toHaveCount(5, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(5, {
    timeout: 30_000,
  })
  await expect(
    page.locator(
      '[data-testid="filmstrip-item"][data-orientation="landscape"]',
    ),
  ).toHaveCount(2, { timeout: 30_000 })
  await expect(
    page.locator('[data-testid="filmstrip-item"][data-orientation="portrait"]'),
  ).toHaveCount(3, { timeout: 30_000 })

  const gaps = await page.evaluate(() => {
    const items = Array.from(
      document.querySelectorAll('[data-testid="filmstrip-item"]'),
    )
    const boxes = items.map((el) => el.getBoundingClientRect())
    const nextGaps: number[] = []
    for (let i = 1; i < boxes.length; i += 1) {
      const prev = boxes[i - 1]
      const curr = boxes[i]
      if (!prev || !curr) {
        continue
      }
      nextGaps.push(curr.left - prev.right)
    }
    return nextGaps
  })

  expect(gaps).toHaveLength(4)
  const expectedGap = gaps[0] ?? 0
  for (const gap of gaps) {
    expect(Math.abs(gap - expectedGap)).toBeLessThan(2)
  }
  // Flex gap is 8px; max-width stride leftovers are ~96px between portraits.
  expect(expectedGap).toBeGreaterThan(4)
  expect(expectedGap).toBeLessThan(20)
})

test('EXIF orientation 6 shows a filmstrip thumb', async ({ page }) => {
  await openSessionEditor(page)
  await pickPhotoFolder(page, [photoFixturePaths.sampleOrient6])

  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 30_000,
  })
  // Happy: header/decode path yields a real thumb (not grey placeholder).
  await expect(page.getByTestId('filmstrip-thumb')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByTestId('filmstrip-placeholder')).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})

test('unsupported TIFF shows import error without gallery entry', async ({
  page,
}) => {
  await openSessionEditor(page)
  await pickPhotoFolderStub(page, [
    {
      name: 'scan.tiff',
      mime: 'image/tiff',
      base64: Buffer.from('II*\u0000fake').toString('base64'),
    },
  ])

  await expect(page.getByTestId('import-errors')).toBeVisible()
  await expect(page.getByTestId('editor-status')).toContainText('Unsupported')
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(0)
})

function minimalHeicFtypBuffer(): Buffer {
  const size = 20
  const bytes = Buffer.alloc(size)
  bytes.writeUInt32BE(size, 0)
  bytes.write('ftyp', 4)
  bytes.write('heic', 8)
  return bytes
}

test('HEIC enters gallery as a placeholder tile', async ({ page }) => {
  await openSessionEditor(page)
  await pickPhotoFolderStub(page, [
    {
      name: 'sample.heic',
      mime: 'image/heic',
      base64: minimalHeicFtypBuffer().toString('base64'),
    },
  ])

  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 30_000,
  })
  await expect
    .poll(async () =>
      page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
    )
    .toBe('1')
  // Empty/no-decoder: grey placeholder stays (no libheif).
  await expect(page.getByTestId('filmstrip-placeholder')).toBeVisible()
  await assertDocumentFitsViewport(page)
})

test('extension-less HEIC octet-stream enters gallery after sniff', async ({
  page,
}) => {
  await openSessionEditor(page)
  await pickPhotoFolderStub(page, [
    {
      name: 'IMG_0042',
      mime: 'application/octet-stream',
      base64: minimalHeicFtypBuffer().toString('base64'),
    },
  ])

  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 30_000,
  })
  await expect
    .poll(async () =>
      page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
    )
    .toBe('1')
})

test('folder import keeps JPEG and HEIC gallery placeholders', async ({
  page,
}) => {
  const dir = join(tmpdir(), `pb-folder-heic-${String(Date.now())}`)
  mkdirSync(dir)
  writeFileSync(
    join(dir, 'shot.jpg'),
    readFileSync(photoFixturePaths.sampleOrient6),
  )
  writeFileSync(join(dir, 'phone.heic'), minimalHeicFtypBuffer())

  await openSessionEditor(page)
  await pickPhotoFolder(page, [join(dir, 'shot.jpg'), join(dir, 'phone.heic')])

  await expect
    .poll(async () =>
      page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
    )
    .toBe('2')
  await expect(page.getByTestId('filmstrip-item').first()).toBeVisible({
    timeout: 30_000,
  })
  // Scroll case: document stays within viewport while filmstrip scrolls.
  await assertDocumentFitsViewport(page)
  const scroll = page.getByTestId('filmstrip-scroll')
  await scroll.evaluate((el) => {
    el.scrollLeft = el.scrollWidth
  })
  await assertDocumentFitsViewport(page)
})

test('folder import skips README without import-errors', async ({ page }) => {
  const dir = join(tmpdir(), `pb-folder-skip-${String(Date.now())}`)
  mkdirSync(dir)
  writeFileSync(
    join(dir, 'shot.jpg'),
    readFileSync(photoFixturePaths.sampleOrient6),
  )
  writeFileSync(join(dir, 'README.md'), '# notes\n')

  await openSessionEditor(page)
  await pickPhotoFolder(page, [join(dir, 'shot.jpg'), join(dir, 'README.md')])

  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('import-errors')).toHaveCount(0)
  await expect(page.getByTestId('editor-status')).toHaveText(
    '1 non-image file skipped',
  )
  await expect
    .poll(
      async () =>
        page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
      { timeout: 15_000 },
    )
    .toBe('1')
})

test('imports lossy and lossless WebP; place shows rendered frame image', async ({
  page,
}) => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
  await openSessionEditor(page)

  await expect(page.getByTestId('filmstrip-item')).toHaveCount(0)
  await expect(page.getByTestId('import-errors')).toHaveCount(0)

  await pickPhotoFolder(page, [
    photoFixturePaths.sampleLossyWebp,
    photoFixturePaths.sampleLosslessWebp,
  ])

  await expect(page.getByTestId('filmstrip-item')).toHaveCount(2, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(2, {
    timeout: 30_000,
  })
  await expect
    .poll(async () =>
      page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
    )
    .toBe('2')
  await expect(page.getByTestId('import-errors')).toHaveCount(0)

  await page.bringToFront()
  await dragPlaceFirstFilmstripItem(page)
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
    timeout: 30_000,
  })
  const naturalWidth = await page
    .getByTestId('spread-frame-image')
    .first()
    .evaluate((img) => (img instanceof HTMLImageElement ? img.naturalWidth : 0))
  expect(naturalWidth).toBeGreaterThan(0)
})

async function sampleCornerAlpha(
  page: import('@playwright/test').Page,
  testId: string,
): Promise<{ a: number; r: number; g: number; b: number }> {
  return page
    .getByTestId(testId)
    .first()
    .evaluate(async (el) => {
      if (!(el instanceof HTMLImageElement)) {
        throw new Error('expected HTMLImageElement')
      }
      if (!el.complete || el.naturalWidth === 0) {
        await new Promise<void>((resolve, reject) => {
          el.addEventListener(
            'load',
            () => {
              resolve()
            },
            { once: true },
          )
          el.addEventListener(
            'error',
            () => {
              reject(new Error('image failed to load'))
            },
            { once: true },
          )
        })
      }
      const canvas = document.createElement('canvas')
      canvas.width = el.naturalWidth
      canvas.height = el.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('2d context unavailable')
      ctx.drawImage(el, 0, 0)
      const px = ctx.getImageData(0, 0, 1, 1).data
      return { r: px[0] ?? 0, g: px[1] ?? 0, b: px[2] ?? 0, a: px[3] ?? 0 }
    })
}

test('transparent PNG corners stay transparent in thumb and frame', async ({
  page,
}) => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
  await openSessionEditor(page)

  await pickPhotoFolder(page, [photoFixturePaths.transparentCornersPng])

  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
    timeout: 30_000,
  })

  await expect
    .poll(async () => (await sampleCornerAlpha(page, 'filmstrip-thumb')).a, {
      timeout: 30_000,
    })
    .toBe(0)

  await page.bringToFront()
  await dragPlaceFirstFilmstripItem(page)
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
    timeout: 30_000,
  })

  await expect
    .poll(async () => (await sampleCornerAlpha(page, 'spread-frame-image')).a, {
      timeout: 30_000,
    })
    .toBe(0)
})

test('corrupt WebP shows a decode import error', async ({ page }) => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
  await openSessionEditor(page)
  await pickPhotoFolder(page, [photoFixturePaths.sampleCorruptWebp])

  await expect(page.getByTestId('import-errors')).toBeVisible({
    timeout: 30_000,
  })
  await expect
    .poll(async () =>
      page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
    )
    .toBe('0')
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(0)
})

test('corrupt JPEG alone leaves no filmstrip tile', async ({ page }) => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
  const corruptPath = writeCorruptTruncatedJpeg()
  await openSessionEditor(page)
  await pickPhotoFolder(page, [corruptPath])

  await expect(page.getByTestId('import-errors')).toBeVisible({
    timeout: 30_000,
  })
  await expect
    .poll(async () =>
      page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
    )
    .toBe('0')
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})

test('valid JPEG plus corrupt JPEG keeps one tile', async ({ page }) => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
  const corruptPath = writeCorruptTruncatedJpeg()
  await openSessionEditor(page)
  await pickPhotoFolder(page, [photoFixturePaths.sampleOrient6, corruptPath])

  await expect(page.getByTestId('import-errors')).toBeVisible({
    timeout: 30_000,
  })
  await expect
    .poll(async () =>
      page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
    )
    .toBe('1')
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1)
  await assertDocumentFitsViewport(page)
})

test('import errors panel groups, dismisses, clears; decode shows Not imported', async ({
  page,
}) => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
  await openSessionEditor(page)
  const { files: bulkFiles } = writeBulkImportFixtureSet(16)
  const tiffDir = join(tmpdir(), `pb-import-errors-${String(Date.now())}`)
  mkdirSync(tiffDir, { recursive: true })
  const tiffA = join(tiffDir, 'scan-a.tiff')
  const tiffB = join(tiffDir, 'scan-b.tiff')
  writeFileSync(tiffA, Buffer.from('II*\u0000fake-a'))
  writeFileSync(tiffB, Buffer.from('II*\u0000fake-b'))
  await pickPhotoFolder(page, [
    ...bulkFiles,
    tiffA,
    tiffB,
    photoFixturePaths.sampleCorruptWebp,
  ])

  await expect(page.getByTestId('import-errors')).toBeVisible({
    timeout: 60_000,
  })
  await expect
    .poll(async () =>
      page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
    )
    .toBe('16')

  await page.getByTestId('import-errors').click()
  const panel = page.getByTestId('import-errors-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByText(/Unsupported format \(2\)/)).toBeVisible()
  await expect(panel.getByText(/Couldn't decode \(1\)/)).toBeVisible()
  await assertDocumentFitsViewport(page)

  const corruptName = photoFixturePaths.sampleCorruptWebp.split('/').pop()
  assert.ok(corruptName)
  await expect(
    panel.getByText(new RegExp(`${corruptName}.*Not imported`)),
  ).toBeVisible()
  await expect(
    panel.locator('button.import-errors-panel__jump', { hasText: corruptName }),
  ).toHaveCount(0)
  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'filmstrip-scroll')

  await panel
    .getByRole('button', { name: 'Dismiss error for scan-a.tiff' })
    .click()
  await expect(panel.getByText(/Unsupported format \(1\)/)).toBeVisible()
  await panel.getByRole('button', { name: 'Clear all' }).click()
  await expect(panel).toBeHidden()
  await expect(
    page.getByRole('button', { name: /Imported with .* error/ }),
  ).toHaveCount(0)
})

test('one folder import adds multiple photos to the gallery', async ({
  page,
}) => {
  await openSessionEditor(page)
  await pickPhotoFolder(page, [
    photoFixturePaths.samplePng,
    photoFixturePaths.sampleOrient6,
  ])
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(2, {
    timeout: 30_000,
  })
})

test('SPA is cross-origin isolated under preview headers', async ({ page }) => {
  await openSessionEditor(page)
  await assertCrossOriginIsolated(page)
})

/** Truncated JPEG that passes type accept but fails decode. */
function writeCorruptTruncatedJpeg(): string {
  const dir = join(
    tmpdir(),
    `photobooks-corrupt-jpeg-${String(process.pid)}-${String(Date.now())}`,
  )
  mkdirSync(dir, { recursive: true })
  const path = join(dir, 'corrupt_truncated.jpg')
  // SOI + APP0 fragment only — enough to be typed as JPEG, not to decode.
  writeFileSync(
    path,
    Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]),
  )
  return path
}

/**
 * Open and close the sort popover once before a LoAF window. The first open
 * mounts the popover cold (a ~55 ms render-only frame, blockingDuration 0);
 * later opens are clean, so the measured window covers the steady state.
 */
async function warmFilmstripSortMenu(page: Page): Promise<void> {
  await page.getByTestId('film-sort').click()
  await page.getByTestId('film-sort-menu').waitFor({ state: 'visible' })
  await page.keyboard.press('Escape')
  await page.getByTestId('film-sort-menu').waitFor({ state: 'hidden' })
}

function writeBulkImportFixtureSet(count: number): {
  dir: string
  files: string[]
} {
  const dir = join(
    tmpdir(),
    `photobooks-bulk-${String(process.pid)}-${String(count)}-${String(Date.now())}`,
  )
  mkdirSync(dir, { recursive: true })
  // Minimal valid 1×1 PNG. Identical bytes across the set: first import still
  // creates `count` entries (identity-first); cross-picker re-import reuses via
  // content hash without growing the gallery.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  const files: string[] = []
  for (let i = 0; i < count; i += 1) {
    const path = join(dir, `bulk-${String(i).padStart(3, '0')}.png`)
    writeFileSync(path, png)
    files.push(path)
  }
  return { dir, files }
}

function writeBulkImportFixtures(count: number): string[] {
  return writeBulkImportFixtureSet(count).files
}

/** CRC-32 for PNG chunk trailers. */
function pngCrc32(data: Buffer): number {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(pngCrc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

/**
 * Distinct valid 1×1 RGB PNGs so content-hash cannot reuse within the set.
 * `salt` shifts the palette so a second call with a different salt cannot
 * content-hash-match the first (same filenames still collide on path alone).
 */
function writeUniqueBulkImportFixtures(count: number, salt = 0): string[] {
  const dir = join(
    tmpdir(),
    `photobooks-unique-bulk-${String(process.pid)}-${String(count)}-${String(salt)}-${String(Date.now())}`,
  )
  mkdirSync(dir, { recursive: true })
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(1, 0)
  ihdr.writeUInt32BE(1, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const files: string[] = []
  for (let i = 0; i < count; i += 1) {
    const r = (i * 37 + salt) % 256
    const g = (i * 91 + salt * 3) % 256
    const b = (i * 17 + 3 + salt * 5) % 256
    const raw = Buffer.from([0, r, g, b])
    const idat = deflateSync(raw)
    const png = Buffer.concat([
      signature,
      pngChunk('IHDR', ihdr),
      pngChunk('IDAT', idat),
      pngChunk('IEND', Buffer.alloc(0)),
    ])
    const path = join(
      dir,
      `uniq-${String(salt)}-${String(i).padStart(3, '0')}.png`,
    )
    writeFileSync(path, png)
    files.push(path)
  }
  return files
}

test('bulk import fills every revealed placeholder even while scrolling', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const count = 24
  const files = writeBulkImportFixtures(count)

  await openSessionEditor(page)
  await pickPhotoFolder(page, files)

  await expect(page.getByTestId('import-progress')).toBeVisible({
    timeout: 30_000,
  })

  // Shift the visible window during import — leave-now cancels; re-enter retries.
  for (let i = 0; i < 20; i += 1) {
    await page.getByTestId('filmstrip-scroll').evaluate((node) => {
      node.scrollLeft += 120
    })
    await page.waitForTimeout(32)
  }

  await expect
    .poll(
      async () =>
        page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
      { timeout: 120_000 },
    )
    .toBe(String(count))

  await expect(page.getByTestId('import-progress')).toBeHidden({
    timeout: 60_000,
  })

  const scroll = page.getByTestId('filmstrip-scroll')
  const maxScroll = await scroll.evaluate(
    (node) => node.scrollWidth - node.clientWidth,
  )
  for (let left = 0; left <= maxScroll; left += 160) {
    await scroll.evaluate((node, nextLeft) => {
      node.scrollLeft = nextLeft
    }, left)
    await expect(page.getByTestId('filmstrip-placeholder')).toHaveCount(0, {
      timeout: 15_000,
    })
    await expect(page.getByTestId('filmstrip-thumb').first()).toBeVisible({
      timeout: 15_000,
    })
  }
})

test('long gallery scrolls inside the filmstrip without widening the page', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const files = writeBulkImportFixtures(80)

  await openSessionEditor(page)
  await pickPhotoFolder(page, files)

  await expect
    .poll(
      async () =>
        page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
      { timeout: 120_000 },
    )
    .toBe('80')

  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'filmstrip-scroll')
})

test('virtual window re-covers scrollport after import scroll without a nudge', async ({
  page,
}) => {
  // IMP-11/FS-03: aspect/prefix updates during import left a blank strip until
  // the next wheel event remounted rows.
  test.setTimeout(120_000)
  const count = 48
  const files = writeBulkImportFixtures(count)

  await openSessionEditor(page)
  await pickPhotoFolder(page, files)

  await expect(page.getByTestId('import-progress')).toBeVisible({
    timeout: 30_000,
  })

  for (let i = 0; i < 16; i += 1) {
    await page.getByTestId('filmstrip-scroll').evaluate((node) => {
      node.scrollLeft += 100
    })
    await page.waitForTimeout(24)
  }

  await expect
    .poll(
      async () =>
        page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
      { timeout: 120_000 },
    )
    .toBe(String(count))
  await expect(page.getByTestId('import-progress')).toBeHidden({
    timeout: 60_000,
  })

  // Settle without scrolling — the window must already cover the port.
  await page.waitForTimeout(200)

  const coverage = await page
    .getByTestId('filmstrip-scroll')
    .evaluate((node) => {
      const windowEl = node.querySelector('[data-testid="filmstrip-window"]')
      if (!(windowEl instanceof HTMLElement)) {
        return { overlapRatio: 0, itemCount: 0 }
      }
      const scrollLeft = node.scrollLeft
      const port = node.clientWidth
      const style = getComputedStyle(windowEl)
      const matrix = new DOMMatrixReadOnly(style.transform)
      const windowLeft = matrix.m41
      const windowWidth = windowEl.getBoundingClientRect().width
      const windowRight = windowLeft + windowWidth
      const visibleRight = scrollLeft + port
      const overlap =
        Math.min(windowRight, visibleRight) - Math.max(windowLeft, scrollLeft)
      return {
        overlapRatio: port > 0 ? Math.max(0, overlap) / port : 0,
        itemCount: node.querySelectorAll('[data-testid="filmstrip-item"]')
          .length,
      }
    })

  expect(coverage.itemCount).toBeGreaterThan(14)
  expect(coverage.overlapRatio).toBeGreaterThan(0.9)
  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'filmstrip-scroll')
})

test.describe('library re-import async', () => {
  test('adding N new photos to a hashed library project yields 2N', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const count = 40
    const first = writeUniqueBulkImportFixtures(count, 0)
    const second = writeUniqueBulkImportFixtures(count, 1)

    const pageErrors: string[] = []
    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })

    await page.goto('/?testLibrary=1')
    await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
      timeout: 15_000,
    })
    await createBookFromEditorChrome(page)

    await pickPhotoFolder(page, first)
    await expect
      .poll(
        async () =>
          page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
        { timeout: 120_000 },
      )
      .toBe(String(count))
    await expect(page.getByTestId('import-progress')).toBeHidden({
      timeout: 60_000,
    })
    await expect(page.getByTestId('book-size')).toHaveText(/· saved$/, {
      timeout: 60_000,
    })

    await pickPhotoFolder(page, [...first, ...second], { replaceFolder: true })
    await expect
      .poll(
        async () =>
          page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
        { timeout: 120_000 },
      )
      .toBe(String(count * 2))
    await expect(page.getByTestId('import-progress')).toBeHidden({
      timeout: 60_000,
    })
    expect(pageErrors, `pageerrors: ${pageErrors.join(' | ')}`).toEqual([])
  })

  test('Change photo folder replaces gallery with the new folder scan', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const count = 24
    const { files } = writeBulkImportFixtureSet(count)

    await page.goto('/?testLibrary=1')
    await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
      timeout: 15_000,
    })
    await createBookFromEditorChrome(page)

    await pickPhotoFolder(page, files)
    await expect
      .poll(
        async () =>
          page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
        { timeout: 120_000 },
      )
      .toBe(String(count))
    await expect(page.getByTestId('import-progress')).toBeHidden({
      timeout: 60_000,
    })

    // Change folder clears the prior root's gallery, then imports the new pick.
    const next = writeBulkImportFixtureSet(count)
    await pickPhotoFolder(page, next.files, { replaceFolder: true })
    await expect
      .poll(
        async () =>
          page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
        { timeout: 120_000 },
      )
      .toBe(String(count))
    await expect(page.getByTestId('import-progress')).toBeHidden({
      timeout: 60_000,
    })
  })

  // LoAF scroll windows must run without Istanbul (CI: -g "frame-budget gates").
  test.describe('frame-budget gates', () => {
    test('re-import restores thumbs without duplicates; first card ≤1.5× session', async ({
      page,
    }, testInfo) => {
      test.setTimeout(240_000)
      const files = writeBulkImportFixtures(200)

      // --- Session path baseline under the same CPU throttle as re-import ---
      // Warm fixture bytes in the OS page cache so the timed baseline is not a
      // cold-disk first hit while later re-import pays a warm setInputFiles cost.
      for (const filePath of files) {
        readFileSync(filePath)
      }
      await enablePerfScenario(page)
      await clearPerfScenario(page)
      // Same progressive signal as re-import (Importing), not first-card decode.
      const sessionStart = performance.now()
      await pickPhotoFolder(page, files)
      await expect(page.getByTestId('import-progress')).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByTestId('import-progress')).toContainText(
        'Importing',
        { timeout: 30_000 },
      )
      const sessionFirstCardMs = performance.now() - sessionStart
      await expect
        .poll(
          async () =>
            page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
          { timeout: 120_000 },
        )
        .toBe('200')
      await expect(page.getByTestId('import-progress')).toBeHidden({
        timeout: 60_000,
      })

      // --- Library-backed: import, clear DerivedCache, re-import ---
      await page.goto('/?testLibrary=1&perf=1')
      await page.waitForFunction(() => window.__photobooksPerf !== undefined)
      await applyCpuThrottling(page)
      await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
        timeout: 15_000,
      })
      await createBookFromEditorChrome(page)

      // Library-backed fresh bulk import: frame-budget scroll window (Perf line).
      await clearPerfScenario(page)
      const chooseFolder = page.getByTestId('choose-photo-folder')
      await expect(chooseFolder).toBeEnabled()
      await pickPhotoFolder(page, files)

      await expect(page.getByTestId('import-progress')).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByTestId('import-progress')).toContainText(
        'Importing',
        { timeout: 30_000 },
      )
      await expect
        .poll(
          async () => {
            const count = Number(
              (await page
                .getByTestId('filmstrip')
                .getAttribute('data-gallery-count')) ?? '0',
            )
            const importing = await page
              .getByTestId('import-progress')
              .isVisible()
            return count > 0 && importing
          },
          { timeout: 60_000 },
        )
        .toBe(true)

      await beginFilmstripLoafScrollWindow(page)
      await scrollFilmstripLoafWindow(page)
      await page.evaluate(browserAssertNoLoaf, 0)

      await expect
        .poll(
          async () =>
            page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
          { timeout: 120_000 },
        )
        .toBe('200')
      await expect(page.getByTestId('import-progress')).toBeHidden({
        timeout: 60_000,
      })

      await page.getByTestId('filmstrip-scroll').evaluate((node) => {
        node.scrollLeft = 0
      })
      // Wait for the virtualizer to remount the start of the gallery.
      await expect
        .poll(
          async () =>
            page
              .getByTestId('filmstrip-item')
              .first()
              .getAttribute('data-asset-id'),
          { timeout: 15_000 },
        )
        .toMatch(/bulk-000/)
      const firstIdBefore = await page
        .getByTestId('filmstrip-item')
        .first()
        .getAttribute('data-asset-id')
      expect(firstIdBefore).toBeTruthy()

      // Settle first-import autosave before clearing thumbs so its OPFS write
      // cannot land inside the re-import LoAF scroll window.
      await expect(page.getByTestId('book-size')).toHaveText(/· saved$/, {
        timeout: 60_000,
      })

      await page.evaluate(async () => {
        const api = window.__photobooksThumbs
        if (!api) {
          throw new Error('window.__photobooksThumbs is not available')
        }
        await api.clearThumbsAndDerivedCacheForTests()
      })
      await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(0, {
        timeout: 15_000,
      })

      // Re-import: gallery is already full; progressive start = progress bar
      // (comparable to session empty→first card). Thumbs restore separately.
      await clearPerfScenario(page)
      const reimportStart = performance.now()
      await pickPhotoFolder(page, files, { replaceFolder: true })

      await expect(page.getByTestId('import-progress')).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByTestId('import-progress')).toContainText(
        'Importing',
        { timeout: 30_000 },
      )
      const reimportFirstCardMs = performance.now() - reimportStart

      // Scroll-during-re-import while progress is still up (Done-when / Perf).
      await beginFilmstripLoafScrollWindow(page)
      await scrollFilmstripLoafWindow(page)
      await page.evaluate(browserAssertNoLoaf, 0)

      // First restored thumb (gallery count stays 200 after clearThumbs).
      await expect(page.getByTestId('filmstrip-thumb').first()).toBeVisible({
        timeout: 60_000,
      })
      const reimportFirstThumbMs = performance.now() - reimportStart

      await expect
        .poll(
          async () =>
            page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
          { timeout: 120_000 },
        )
        .toBe('200')
      await expect(page.getByTestId('import-progress')).toBeHidden({
        timeout: 60_000,
      })

      await page.getByTestId('filmstrip-scroll').evaluate((node) => {
        node.scrollLeft = 0
      })
      // Change folder clears the prior gallery; ids are new but count stays 200.
      await expect
        .poll(
          async () =>
            page
              .getByTestId('filmstrip-item')
              .first()
              .getAttribute('data-asset-id'),
          { timeout: 15_000 },
        )
        .toMatch(/bulk-000/)
      expect(
        await page
          .getByTestId('filmstrip-item')
          .first()
          .getAttribute('data-asset-id'),
      ).not.toBe(firstIdBefore)
      // Sample the far end of the strip (virtualizer) still mounts items.
      await page.getByTestId('filmstrip-scroll').evaluate((node) => {
        node.scrollLeft = node.scrollWidth
      })
      await expect
        .poll(async () => page.getByTestId('filmstrip-item').count(), {
          timeout: 15_000,
        })
        .toBeGreaterThan(0)
      await page.getByTestId('filmstrip-scroll').evaluate((node) => {
        node.scrollLeft = 0
      })
      await expect(page.getByTestId('filmstrip-thumb').first()).toBeVisible({
        timeout: 60_000,
      })

      // Change-folder clear + bind vs empty-session Importing (same signal).
      expect(
        reimportFirstCardMs,
        `re-import progress ${String(reimportFirstCardMs)}ms > 2× session progressive ${String(sessionFirstCardMs)}ms`,
      ).toBeLessThanOrEqual(sessionFirstCardMs * 2 + 1)
      // setInputFiles has no Event Timing; click supplies INP for the gate snapshot.
      await page.getByTestId('filmstrip-item').first().click({ delay: 20 })
      await page.waitForFunction(() => {
        const perf = window.__photobooksPerf
        if (!perf) {
          return false
        }
        perf.flushEventTimingEntries()
        return perf.getEventTimingEntries().length > 0
      })
      // Capture INP/handler from import kickoff + click, then clear LoAF
      // for the post-settle window (scroll-during-re-import LoAF was asserted above).
      const gateSnapshot = await page.evaluate((handlerLabel) => {
        const perf = window.__photobooksPerf
        if (!perf) {
          throw new Error('window.__photobooksPerf is not available')
        }
        perf.flushEventTimingEntries()
        const durations = perf.getHandlerMeasureDurations(handlerLabel)
        const sorted = [...durations].sort((a, b) => a - b)
        const p95 =
          sorted.length === 0
            ? null
            : sorted[
                Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)
              ]
        return {
          loafEntries: perf.getLoafEntries().length,
          inpMs: perf.getInpMs(),
          handlerP95Ms: p95,
          handlerSampleCount: durations.length,
        }
      }, 'import-photos')
      await page.evaluate(() => {
        window.__photobooksPerf?.clearLoafEntries()
      })
      await assertCiPerfGates(page)
      await collectFrameStatsArtifact(page, testInfo)

      const proof = {
        sessionFirstCardMs,
        reimportProgressMs: reimportFirstCardMs,
        reimportFirstThumbMs,
        ratio: reimportFirstCardMs / Math.max(1, sessionFirstCardMs),
        readsInFlightCap: 16,
        loafEntriesDuringScrollReimport: 0,
        ...gateSnapshot,
      }
      const proofPath = testInfo.outputPath('reimport-async-proof.json')
      writeFileSync(proofPath, JSON.stringify(proof, null, 2), 'utf8')
      await testInfo.attach('reimport-async-proof.json', {
        path: proofPath,
        contentType: 'application/json',
      })
    })
  })
})

test.describe('frame-budget gates', () => {
  test('bulk filmstrip import while scrolling stays within frame-budget gates', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000)
    await enablePerfScenario(page)

    const observing = await page.evaluate(() => {
      return window.__photobooksPerf?.isLoafObserving() ?? false
    })
    expect(observing).toBe(true)

    await clearPerfScenario(page)

    const files = writeBulkImportFixtures(200)
    await expect(page.getByTestId('choose-photo-folder')).toBeEnabled()
    // setInputFiles seam (same bind+import path) — directory-picker base64
    // stub walks trip LoAF under CPU throttle for 200 files.
    await choosePhotoFolder(page, files)

    await expect(page.getByTestId('import-progress')).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByTestId('import-progress')).toContainText(
      'Importing',
      {
        timeout: 30_000,
      },
    )

    // Progressive visibility: gallery ids flush into the strip before the batch settles.
    await expect
      .poll(
        async () => {
          const count = Number(
            (await page
              .getByTestId('filmstrip')
              .getAttribute('data-gallery-count')) ?? '0',
          )
          const importing = await page
            .getByTestId('import-progress')
            .isVisible()
          return count > 0 && importing
        },
        { timeout: 60_000 },
      )
      .toBe(true)

    // Interaction window: scroll while import continues (exclude picker/setFiles LoAF).
    await beginFilmstripLoafScrollWindow(page)
    await scrollFilmstripLoafWindow(page)

    // Assert LoAF for the scroll-during-import window before post-import reveal work.
    await page.evaluate(browserAssertNoLoaf, 0)

    // Virtualizer only mounts visible rows — assert gallery size, not DOM item count.
    await expect
      .poll(
        async () =>
          page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
        { timeout: 120_000 },
      )
      .toBe('200')

    await assertDocumentFitsViewport(page)

    await expect(page.getByTestId('filmstrip-item').first()).toBeVisible({
      timeout: 60_000,
    })

    // setInputFiles has no Event Timing; a light click supplies INP samples.
    await page.getByTestId('filmstrip-item').first().click({ delay: 20 })
    await page.waitForFunction(() => {
      const perf = window.__photobooksPerf
      if (!perf) {
        return false
      }
      perf.flushEventTimingEntries()
      return perf.getEventTimingEntries().length > 0
    })

    // Clear post-import reveal LoAF; handler p95 comes from import kickoff.
    await page.evaluate(() => {
      window.__photobooksPerf?.clearLoafEntries()
    })

    await assertCiPerfGates(page)
    await collectFrameStatsArtifact(page, testInfo)
  })
})

test('scroll mid-import keeps earlier revealed tile ids', async ({ page }) => {
  test.setTimeout(120_000)
  const count = 48
  const files = writeBulkImportFixtures(count)

  await openSessionEditor(page)
  await pickPhotoFolder(page, files)

  await expect(page.getByTestId('import-progress')).toBeVisible({
    timeout: 30_000,
  })
  await expect
    .poll(
      async () =>
        page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
      { timeout: 60_000 },
    )
    .toMatch(/^[1-9]/)

  const revealedIds = await page
    .getByTestId('filmstrip-item')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => node.getAttribute('data-asset-id'))
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    )
  expect(revealedIds.length).toBeGreaterThan(0)
  const anchorId = revealedIds[0]
  assert(anchorId !== undefined)

  for (let i = 0; i < 24; i += 1) {
    await page.getByTestId('filmstrip-scroll').evaluate((node) => {
      node.scrollLeft += 140
    })
    await page.waitForTimeout(24)
  }

  await expect
    .poll(
      async () =>
        page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
      { timeout: 120_000 },
    )
    .toBe(String(count))
  await expect(page.getByTestId('import-progress')).toBeHidden({
    timeout: 60_000,
  })

  await page.getByTestId('filmstrip-scroll').evaluate((node) => {
    node.scrollLeft = 0
  })
  await expect
    .poll(
      async () => {
        const ids = await page
          .getByTestId('filmstrip-item')
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute('data-asset-id')),
          )
        return ids.includes(anchorId)
      },
      { timeout: 30_000 },
    )
    .toBe(true)
  await expect(
    page.locator(`[data-testid="filmstrip-item"][data-asset-id="${anchorId}"]`),
  ).toBeVisible({ timeout: 15_000 })
  await expect(
    page.locator(
      `[data-testid="filmstrip-item"][data-asset-id="${anchorId}"] [data-testid="filmstrip-thumb"], [data-testid="filmstrip-item"][data-asset-id="${anchorId}"] [data-testid="filmstrip-placeholder"]`,
    ),
  ).toHaveCount(1, { timeout: 15_000 })
  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'filmstrip-scroll')
})

test.describe('sort / filter / remove', () => {
  test('Unplaced only shrinks after placing; empty filter; placed removal asks first', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const files = writeBulkImportFixtures(2)
    await openSessionEditor(page)
    await pickPhotoFolder(page, files)
    await expect
      .poll(
        async () =>
          page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
        { timeout: 60_000 },
      )
      .toBe('2')

    await page.getByTestId('film-unplaced-only').click()
    await expect(page.getByTestId('placed-count')).toHaveText(
      'Photos · 2 of 2 · 0 used',
    )

    await dragPlaceFirstFilmstripItem(page)
    await expect(page.getByTestId('filmstrip-item')).toHaveCount(1)
    await expect(page.getByTestId('placed-count')).toHaveText(
      'Photos · 1 of 2 · 1 used',
    )

    await dragPlaceFirstFilmstripItem(page)
    await expect(page.getByTestId('filmstrip-filter-empty')).toHaveText(
      'Every photo is placed. Turn off “Unplaced” to see all.',
    )
    await assertDocumentFitsViewport(page)

    await page.getByTestId('film-unplaced-only').click()
    await expect(page.getByTestId('filmstrip-item')).toHaveCount(2)
    const images = page.getByTestId('spread-frame-image')
    const placedBefore = await images.count()
    await page.getByTestId('filmstrip-item').first().click()
    await page.keyboard.press('Delete')
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.getByRole('button', { name: 'Remove and empty frame' }).click()
    await expect(page.getByTestId('filmstrip-item')).toHaveCount(1)
    await expect(images).toHaveCount(placedBefore - 1)
  })

  test('1000-photo gallery scroll, sort and filter toggle stay within frame-budget gates', async ({
    page,
  }) => {
    test.setTimeout(300_000)
    await enablePerfScenario(page)
    await clearPerfScenario(page)
    const files = writeBulkImportFixtures(1000)
    await expect(page.getByTestId('choose-photo-folder')).toBeEnabled()
    await choosePhotoFolder(page, files)
    await expect
      .poll(
        async () =>
          page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
        { timeout: 240_000 },
      )
      .toBe('1000')
    await expect(page.getByTestId('import-progress')).toBeHidden({
      timeout: 120_000,
    })

    await warmFilmstripSortMenu(page)
    await beginFilmstripLoafScrollWindow(page)
    await scrollFilmstripLoafWindow(page, 10)
    await page.getByTestId('film-unplaced-only').click()
    await scrollFilmstripLoafWindow(page, 5)
    await page.getByTestId('film-sort').click()
    await page.getByRole('menuitemradio', { name: 'File name' }).click()
    await scrollFilmstripLoafWindow(page, 5)
    await page.getByTestId('film-unplaced-only').click()
    await scrollFilmstripLoafWindow(page, 10)
    await page.evaluate(browserAssertNoLoaf, 0)

    await assertDocumentFitsViewport(page)
    await assertNamedScrollport(page, 'filmstrip-scroll')
  })

  test('empty dock: loose file drop is refused', async ({ page }) => {
    await openSessionEditor(page)
    await expect(page.getByTestId('filmstrip-empty')).toBeVisible()
    await assertDocumentFitsViewport(page)

    await page.getByTestId('dock').evaluate((dock) => {
      const event = new Event('drop', { bubbles: true, cancelable: true })
      const item = {
        kind: 'file',
        getAsFileSystemHandle: () => Promise.resolve({ kind: 'file' }),
      }
      Object.defineProperty(event, 'dataTransfer', {
        value: { types: ['Files'], items: [item] },
      })
      dock.dispatchEvent(event)
    })
    await expect(page.getByTestId('editor-status')).toHaveText(
      'Drop a folder — Photobooks adds folders, not single photos',
    )
  })
})
