import { readFileSync } from 'node:fs'
import type { Locator, Page } from '@playwright/test'
import { createBookViaLibrary } from './fixtures/createBookViaLibrary'
import { expect, test } from './fixtures/coverage'
import { dropAssetOnFrame } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { applyContactSheet } from './fixtures/layoutTiles'

const COUNT = 12
const FRAME_DRAG_MIME = 'application/x-photobooks-frame'

/** Real OPFS folder (survives reload, unlike the picker double). */
async function pickOpfsPhotoFolder(page: Page): Promise<void> {
  const base64 = readFileSync(photoFixturePaths.sampleOrient6).toString(
    'base64',
  )
  await page.evaluate(
    async ({ count, data }) => {
      const root = await navigator.storage.getDirectory()
      const dir = await root.getDirectoryHandle('blob-revoke-photos', {
        create: true,
      })
      const binary = atob(data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i)
      }
      for (let i = 0; i < count; i += 1) {
        const name = `photo-${String(i).padStart(2, '0')}.jpg`
        const handle = await dir.getFileHandle(name, { create: true })
        const writable = await handle.createWritable()
        // One distinct byte per file so identities differ.
        await writable.write(new Uint8Array([...bytes, i]))
        await writable.close()
      }
      Object.defineProperty(window, 'showDirectoryPicker', {
        configurable: true,
        value: () => Promise.resolve(dir),
      })
    },
    { count: COUNT, data: base64 },
  )
  await page.getByTestId('film-add-folder').click()
}

function frames(page: Page): Locator {
  return page
    .getByTestId('spread-view')
    .first()
    .locator('[data-testid="spread-frame"]')
}

/** Frame-body drag of frame 0 onto frame 1 (photo swap). */
async function swapFirstTwoFrames(page: Page): Promise<void> {
  const image = frames(page).first().getByTestId('spread-frame-image')
  const before = await image.getAttribute('src')
  const swapped = await page.evaluate((mime) => {
    const view = document.querySelector('[data-testid="spread-view"]')
    const all = view?.querySelectorAll<HTMLElement>('[data-frame-id]') ?? []
    const [source, target] = Array.from(all)
    const body = source?.querySelector<HTMLElement>(
      '.spread-frame-body[draggable="true"]',
    )
    const spreadId = source
      ?.closest('[data-spread-id]')
      ?.getAttribute('data-spread-id')
    const scroll = document.querySelector('[data-testid="pasteboard-scroll"]')
    if (
      body === null ||
      body === undefined ||
      target === undefined ||
      spreadId === null ||
      spreadId === undefined ||
      !(scroll instanceof HTMLElement)
    ) {
      return false
    }
    const dataTransfer = new DataTransfer()
    dataTransfer.setData(
      mime,
      `${spreadId}\n${source?.getAttribute('data-frame-id') ?? ''}`,
    )
    body.dispatchEvent(
      new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      }),
    )
    const box = target.getBoundingClientRect()
    const point = {
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    }
    for (const type of ['dragover', 'drop'] as const) {
      scroll.dispatchEvent(
        new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          ...point,
        }),
      )
    }
    body.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
    return true
  }, FRAME_DRAG_MIME)
  expect(swapped).toBe(true)
  await expect(image).not.toHaveAttribute('src', before ?? '')
}

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test('swap drags, reload and reopen request no revoked blob URL', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const failedBlobs: string[] = []
  page.on('requestfailed', (request) => {
    if (request.url().startsWith('blob:')) {
      failedBlobs.push(`${request.url()} ${request.failure()?.errorText ?? ''}`)
    }
  })
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      message.text().includes('ERR_FILE_NOT_FOUND')
    ) {
      failedBlobs.push(message.text())
    }
  })

  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 15_000,
  })
  page.once('dialog', (dialog) => {
    void dialog.accept('Blob revoke')
  })
  await createBookViaLibrary(page)
  await pickOpfsPhotoFolder(page)
  const filmstrip = page.getByTestId('filmstrip')
  await expect(filmstrip).toHaveAttribute('data-gallery-count', String(COUNT), {
    timeout: 60_000,
  })
  await expect(page.getByTestId('import-progress')).toBeHidden({
    timeout: 60_000,
  })

  await applyContactSheet(page, 2, 2)
  const items = page.getByTestId('filmstrip-item')
  for (let i = 0; i < 4; i += 1) {
    const assetId = await items.nth(i).getAttribute('data-asset-id')
    expect(assetId).toBeTruthy()
    await dropAssetOnFrame(
      page,
      assetId ?? '',
      page
        .getByTestId('spread-view')
        .first()
        .getByRole('button', { name: 'Place photo', exact: true })
        .first(),
    )
  }
  await expect(frames(page).getByTestId('spread-frame-image')).toHaveCount(4, {
    timeout: 30_000,
  })

  for (let i = 0; i < 3; i += 1) {
    await swapFirstTwoFrames(page)
  }

  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('editor-status')).toHaveText('Book saved', {
    timeout: 60_000,
  })
  await page.reload()
  await expect(page.getByTestId('editor-status')).toHaveText('Book restored', {
    timeout: 30_000,
  })
  await expect(frames(page).getByTestId('spread-frame-image')).toHaveCount(4, {
    timeout: 30_000,
  })
  await swapFirstTwoFrames(page)

  // Reopen the book from the library.
  await page.getByTestId('go-library').click()
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.locator('[data-testid^="library-book-"]').first().click()
  await expect(page.getByTestId('editor-shell')).toBeVisible({
    timeout: 15_000,
  })
  await expect(frames(page).getByTestId('spread-frame-image')).toHaveCount(4, {
    timeout: 30_000,
  })
  await swapFirstTwoFrames(page)
  await expect(page.getByTestId('filmstrip-thumb').first()).toBeVisible({
    timeout: 30_000,
  })

  // Every image fetch has settled (loaded or failed) before the assert.
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Array.from(document.images).every((img) => img.complete),
        ),
      { timeout: 15_000 },
    )
    .toBe(true)
  expect(failedBlobs).toEqual([])
})
