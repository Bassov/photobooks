import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { dragPlaceFirstFilmstripItem } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { applyLayout } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'

// A 4K screen at DPR 2 is 1920×1080 CSS px; the 6000×4000 fixture is larger
// than every tier, so the tier alone sets the natural size.
const VIEWPORT = { width: 1920, height: 1080 }

interface Sample {
  src: string
  naturalWidth: number
  tier: string | null
  t: number
}

test.beforeAll(() => {
  ensurePhotoFixtures()
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

async function importAndLayOut(page: Page): Promise<void> {
  await openSessionEditor(page)
  await choosePhotoFolder(page, [photoFixturePaths.largeJpeg])
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 60_000,
  })
  await applyLayout(page, 'Full bleed', { restorePanel: true })
}

/** Record the placed frame image on every animation frame from now on. */
async function startSampler(page: Page): Promise<number> {
  return page.evaluate(() => {
    const samples: Sample[] = []
    Object.assign(window, { hidpiSamples: samples })
    const tick = (): void => {
      const img = document.querySelector<HTMLImageElement>(
        '[data-testid="spread-frame-image"]',
      )
      if (img !== null) {
        samples.push({
          src: img.getAttribute('src') ?? '',
          naturalWidth: img.naturalWidth,
          tier: img.dataset.tier ?? null,
          t: performance.now(),
        })
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    return performance.now()
  })
}

async function readSamples(page: Page): Promise<Sample[]> {
  return page.evaluate(
    () => (window as unknown as { hidpiSamples: Sample[] }).hidpiSamples,
  )
}

/** Long edges of the placed image: decoded pixels vs on-screen CSS px. */
async function readImageEdges(
  page: Page,
): Promise<{ natural: number; css: number }> {
  return page.getByTestId('spread-frame-image').evaluate(async (el) => {
    const img = el as HTMLImageElement
    await img.decode()
    const box = img.getBoundingClientRect()
    return {
      natural: Math.max(img.naturalWidth, img.naturalHeight),
      css: Math.max(box.width, box.height),
    }
  })
}

test.describe('HiDPI screen (DPR 2)', () => {
  test.use({ viewport: VIEWPORT, deviceScaleFactor: 2 })

  test('a full-bleed photo gets 2× its CSS size and never blanks after the drop', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    await importAndLayOut(page)
    const dropAt = await startSampler(page)
    await dragPlaceFirstFilmstripItem(page, 0)

    const image = page.getByTestId('spread-frame-image')
    await expect(image).toHaveAttribute('data-tier', '2560', {
      timeout: 60_000,
    })
    const edges = await readImageEdges(page)
    expect(edges.natural).toBeGreaterThanOrEqual(
      Math.min(2560, Math.floor(2 * edges.css)),
    )

    const samples = await readSamples(page)
    // No frame shows the placed image without decoded pixels.
    expect(samples.filter((s) => s.naturalWidth === 0)).toEqual([])
    // Each source shows in one run: at most thumb → 1280 → 2560, no flip-back.
    const runs = samples
      .map((s) => s.src)
      .filter((src, i, all) => i === 0 || all[i - 1] !== src)
    expect(new Set(runs).size).toBe(runs.length)
    expect(runs.length).toBeLessThanOrEqual(3)
    const first2560 = samples.find((s) => s.tier === '2560')
    testInfo.annotations.push({
      type: 'hidpi',
      description: `DPR 2 natural ${String(edges.natural)} for css ${String(Math.round(edges.css))}; drop → 2560 shown ${String(Math.round((first2560?.t ?? dropAt) - dropAt))} ms`,
    })
  })
})

test.describe('normal screen (DPR 1)', () => {
  test.use({ viewport: VIEWPORT, deviceScaleFactor: 1 })

  test('the same full-bleed photo stays on the 1280 working preview', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    await importAndLayOut(page)
    await startSampler(page)
    await dragPlaceFirstFilmstripItem(page, 0)

    const image = page.getByTestId('spread-frame-image')
    await expect(image).toHaveAttribute('data-tier', '1280', {
      timeout: 60_000,
    })
    const edges = await readImageEdges(page)
    expect(edges.natural).toBe(1280)
    expect(edges.natural).toBeGreaterThanOrEqual(Math.floor(edges.css))
    // Two more seconds settle: no 2560 work on a normal screen.
    await page.waitForTimeout(2_000)
    const tiers = new Set((await readSamples(page)).map((s) => s.tier))
    expect(tiers.has('2560')).toBe(false)
    testInfo.annotations.push({
      type: 'hidpi',
      description: `DPR 1 natural ${String(edges.natural)} for css ${String(Math.round(edges.css))}`,
    })
  })
})
