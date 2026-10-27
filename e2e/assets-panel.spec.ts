import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import {
  browserAssertNoLoaf,
  browserBeginLoafScenarioWindow,
  clearPerfScenario,
  enablePerfScenario,
} from './perf/perfFixture'

interface RelinkApi {
  replaceRelinkStatuses: (
    next: Iterable<[string, 'missing' | 'modified' | 'ok']>,
  ) => void
}

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

async function setStatuses(
  page: Page,
  entries: [string, 'missing' | 'modified'][],
): Promise<void> {
  await page.evaluate((next) => {
    const api = (window as unknown as { __photobooksRelink?: RelinkApi })
      .__photobooksRelink
    if (!api) {
      throw new Error('relink API missing')
    }
    api.replaceRelinkStatuses(next)
  }, entries)
}

test('assets tab lists status rows, sorts, and keeps scroll inside the list', async ({
  page,
}) => {
  await openSessionEditor(page)
  await page.getByTestId('left-tab-assets').click()
  await expect(page.getByTestId('assets-empty')).toBeVisible()

  await choosePhotoFolder(page, [
    photoFixturePaths.samplePng,
    photoFixturePaths.sampleLossyWebp,
  ])
  await expect(page.getByTestId('assets-row')).toHaveCount(2, {
    timeout: 30_000,
  })

  const ids = await page
    .getByTestId('assets-row')
    .evaluateAll((rows) =>
      rows.map((row) => row.getAttribute('data-asset-id') ?? ''),
    )
  const second = ids[1] ?? ''
  await setStatuses(page, [[second, 'modified']])

  const modified = page.locator(
    `[data-testid="assets-row"][data-asset-id="${second}"]`,
  )
  await expect(modified.getByTestId('assets-update')).toBeVisible()
  await expect(page.getByTestId('assets-row').first()).toHaveAttribute(
    'data-asset-id',
    second,
  )
  await expect(page.getByTestId('assets-row').last()).toContainText('unused')

  await modified.getByTestId('assets-update').click()
  await expect(page.getByTestId('editor-status')).toContainText('Rescan')

  await page.getByText('Uses', { exact: true }).click()
  await expect(page.getByTestId('assets-row')).toHaveCount(2)

  await assertDocumentFitsViewport(page)
})

function writeBulkPngs(count: number): string[] {
  const dir = join(
    tmpdir(),
    `photobooks-assets-bulk-${String(process.pid)}-${String(Date.now())}`,
  )
  mkdirSync(dir, { recursive: true })
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  const files: string[] = []
  for (let i = 0; i < count; i += 1) {
    const path = join(dir, `bulk-${String(i).padStart(4, '0')}.png`)
    writeFileSync(path, png)
    files.push(path)
  }
  return files
}

test('1000-asset panel scroll and sort by status stay LoAF-free', async ({
  page,
}) => {
  test.setTimeout(300_000)
  await enablePerfScenario(page)
  await clearPerfScenario(page)
  const files = writeBulkPngs(1000)
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

  await page.getByTestId('left-tab-assets').click()
  await expect(page.getByTestId('assets-count')).toHaveText('1000')
  const ids = await page
    .getByTestId('assets-row')
    .evaluateAll((rows) =>
      rows.map((row) => row.getAttribute('data-asset-id') ?? ''),
    )
  await setStatuses(
    page,
    ids.slice(0, 5).map((id): [string, 'missing'] => [id, 'missing']),
  )

  await page.evaluate(browserBeginLoafScenarioWindow)
  for (let i = 0; i < 20; i += 1) {
    await page.getByTestId('assets-list').evaluate((node) => {
      node.scrollTop += 240
    })
    await page.waitForTimeout(32)
  }
  await page.getByText('Uses', { exact: true }).click()
  await page.getByText('Status', { exact: true }).click()
  await page.waitForTimeout(100)
  await page.evaluate(browserAssertNoLoaf, 0)

  expect(await page.getByTestId('assets-row').count()).toBeLessThan(60)
  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'assets-list', { axis: 'vertical' })
})
