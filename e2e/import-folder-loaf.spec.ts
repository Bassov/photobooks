import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import {
  browserBeginLoafScenarioWindow,
  browserStartLoafScripts,
  browserTakeLoafScripts,
  enablePerfScenario,
  type LoafScriptRow,
  waitFrames,
} from './perf/perfFixture'
import { PERF_BUDGETS } from './perf/budgets'
import {
  clearReactCommits,
  installReactCommitProbe,
  reactCommitsOutside,
} from './fixtures/reactCommits'

/** QA-4 folder: the 10 kit photos, one 24 MP JPEG and 3 small fixtures. */
const KIT_PHOTO_DIR = 'uikit/public/photos/hi'

function qaFolderPaths(): string[] {
  ensurePhotoFixtures()
  return [
    ...readdirSync(KIT_PHOTO_DIR)
      .filter((name) => name.endsWith('.jpg'))
      .sort()
      .map((name) => join(KIT_PHOTO_DIR, name)),
    photoFixturePaths.largeJpeg,
    photoFixturePaths.samplePng,
    photoFixturePaths.metaLake,
    photoFixturePaths.metaHill,
  ]
}

/**
 * Writes the folder into a real OPFS directory and points
 * `showDirectoryPicker` at it, so "Add folder…" walks real handles (the
 * user path) and no base64 decode lands inside the measured window.
 */
async function stageOpfsFolder(
  page: Page,
  paths: readonly string[],
): Promise<void> {
  for (const path of paths) {
    await page.evaluate(
      async ({ name, base64 }) => {
        const root = await navigator.storage.getDirectory()
        const dir = await root.getDirectoryHandle('qa-import-loaf', {
          create: true,
        })
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i)
        }
        const handle = await dir.getFileHandle(name, { create: true })
        const writable = await handle.createWritable()
        await writable.write(bytes)
        await writable.close()
      },
      { name: basename(path), base64: readFileSync(path).toString('base64') },
    )
  }
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle('qa-import-loaf')
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: () => Promise.resolve(dir),
    })
  })
}

/** Our bundle (same origin) owns at least one script of the frame. */
function attributedToApp(row: LoafScriptRow, origin: string): boolean {
  return row.scripts.some((script) => script.url.startsWith(origin))
}

/** Every photo listed, import done, every visible tile painted. */
async function waitImportSettled(page: Page, count: number): Promise<void> {
  await expect(page.getByTestId('filmstrip')).toHaveAttribute(
    'data-gallery-count',
    String(count),
    { timeout: 90_000 },
  )
  await expect(page.getByTestId('import-progress')).toBeHidden({
    timeout: 90_000,
  })
  await expect(page.getByTestId('filmstrip-placeholder')).toHaveCount(0, {
    timeout: 90_000,
  })
  await waitFrames(page, 30)
}

test('folder import does not re-render the layout inspector', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const paths = qaFolderPaths()
  await installReactCommitProbe(page)
  await enablePerfScenario(page)
  await expect(page.getByTestId('spread-master-spacing')).toBeVisible()
  await stageOpfsFolder(page, paths)
  await waitFrames(page, 4)
  await clearReactCommits(page)

  await page.getByTestId('film-add-folder').click()
  await waitImportSettled(page, paths.length)

  // Gallery chunks publish a new book; the spread inspector reads layout
  // fields only and must bail out of every one of those commits.
  const commits = await reactCommitsOutside(page, '[data-testid="inspector"]')
  expect(commits.commits).toBeGreaterThan(0)
  expect(commits.rendered - commits.outside.length).toBe(0)
  await expect(page.getByTestId('filmstrip-thumb').first()).toBeVisible()
})

test.describe('frame-budget gates', () => {
  test('first folder import with a 24 MP photo keeps app LoAF in budget', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000)
    const paths = qaFolderPaths()
    await enablePerfScenario(page)
    await stageOpfsFolder(page, paths)
    await waitFrames(page, 4)

    await page.evaluate(browserBeginLoafScenarioWindow)
    await page.evaluate(browserStartLoafScripts)
    await page.getByTestId('film-add-folder').click()
    await waitImportSettled(page, paths.length)

    const origin = new URL(page.url()).origin
    const rows = await page.evaluate(browserTakeLoafScripts)
    const app = rows.filter((row) => attributedToApp(row, origin))
    const summary = rows.map(
      (row) =>
        `${String(row.blocking)}ms${attributedToApp(row, origin) ? '*' : ''}`,
    )
    console.log(
      `import-folder-loaf rows: ${JSON.stringify(
        rows.map((row) => ({
          ...row,
          scripts: row.scripts.map((s) => ({
            ...s,
            url: s.url.replace(origin, ''),
          })),
        })),
      )}`,
    )
    testInfo.annotations.push({
      type: 'loaf-window',
      description: `entries=${String(rows.length)} app=${String(app.length)} blockingMs=[${summary.join(', ')}]`,
    })

    // Same buckets as `assertNoLoafEntries`, restricted to frames our code ran in.
    const real = app.filter(
      (row) => row.blocking > PERF_BUDGETS.loafNoiseBlockingMs,
    )
    const noise = app.filter(
      (row) =>
        row.blocking > 0 && row.blocking <= PERF_BUDGETS.loafNoiseBlockingMs,
    )
    expect(real.map((row) => row.blocking)).toHaveLength(
      PERF_BUDGETS.loafEntriesMax,
    )
    expect(noise.length).toBeLessThanOrEqual(PERF_BUDGETS.loafNoiseEntriesMax)
  })
})
