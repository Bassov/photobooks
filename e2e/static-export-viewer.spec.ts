import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { dirname, extname, join, normalize } from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'
import { exportToDone, openFixture, useOpfsFolder } from './fixtures/siteExport'

// An exported `dist/` works on its own: served by a plain static server, a
// book page loads the viewer CSS and JS copied into `dist/viewer/`.

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
}

/** `dist/` of an OPFS folder: path → base64 bytes. */
async function readDistFiles(
  page: Page,
  name: string,
): Promise<Record<string, string>> {
  return page.evaluate(async (name) => {
    const out: Record<string, string> = {}
    const base64 = (buffer: ArrayBuffer) => {
      let text = ''
      for (const byte of new Uint8Array(buffer))
        text += String.fromCharCode(byte)
      return btoa(text)
    }
    const walk = async (dir: FileSystemDirectoryHandle, prefix: string) => {
      for await (const entry of (
        dir as unknown as {
          values: () => AsyncIterable<
            FileSystemDirectoryHandle | FileSystemFileHandle
          >
        }
      ).values()) {
        if (entry.kind === 'directory') {
          await walk(entry, `${prefix}${entry.name}/`)
        } else {
          out[`${prefix}${entry.name}`] = base64(
            await (await entry.getFile()).arrayBuffer(),
          )
        }
      }
    }
    const root = await navigator.storage.getDirectory()
    const folder = await root.getDirectoryHandle(name)
    await walk(await folder.getDirectoryHandle('dist'), '')
    return out
  }, name)
}

/** Plain static file server over `root` (`dir/` → `dir/index.html`). */
async function serveStatic(
  root: string,
): Promise<{ server: Server; url: string }> {
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(
      new URL(request.url ?? '/', 'http://x').pathname,
    )
    const file = normalize(
      join(root, pathname.endsWith('/') ? `${pathname}index.html` : pathname),
    )
    const inside = file.startsWith(`${normalize(root)}/`)
    ;(inside ? readFile(file) : Promise.reject(new Error('outside'))).then(
      (bytes) => {
        response.writeHead(200, {
          'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
        })
        response.end(bytes)
      },
      () => {
        response.writeHead(404)
        response.end()
      },
    )
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return { server, url: `http://127.0.0.1:${String(port)}/` }
}

/** Writes the exported `dist/` of the `served` folder to disk. */
async function writeDist(
  page: Page,
): Promise<{ files: Record<string, string>; root: string }> {
  const files = await readDistFiles(page, 'served')
  const root = test.info().outputPath('dist')
  for (const [path, bytes] of Object.entries(files)) {
    const file = join(root, path)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, Buffer.from(bytes, 'base64'))
  }
  return { files, root }
}

/** Failed (≥ 400 or aborted) request urls of `viewer`. */
function failedRequests(viewer: Page): string[] {
  const failed: string[] = []
  viewer.on('response', (response) => {
    if (response.status() >= 400) failed.push(response.url())
  })
  viewer.on('requestfailed', (request) => failed.push(request.url()))
  return failed
}

test('a served export ships the UI fonts and every page loads them', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openFixture(page)
  await useOpfsFolder(page, 'served')
  await exportToDone(page, true)
  const { files, root } = await writeDist(page)
  const fonts = Object.keys(files).filter((path) =>
    path.startsWith('viewer/fonts/'),
  )
  expect(fonts).toContain('viewer/fonts/fonts.css')
  expect(fonts.filter((path) => path.endsWith('.woff2'))).toHaveLength(9)
  const site = JSON.parse(
    Buffer.from(files['site.json'] ?? '', 'base64').toString(),
  ) as { books: { path: string }[] }
  const { server, url } = await serveStatic(root)

  try {
    for (const path of ['', site.books[0]?.path ?? '']) {
      const viewer = await page.context().newPage()
      const failed = failedRequests(viewer)

      await viewer.goto(`${url}${path}`)
      const loaded = await viewer.evaluate(async () => {
        const faces = await Promise.all(
          ['Inter Variable', 'Lora Variable'].map((family) =>
            document.fonts.load(`16px "${family}"`, 'Aa'),
          ),
        )
        return faces.map((list) =>
          list.map((face) => `${face.family}:${face.status}`),
        )
      })
      await viewer.waitForLoadState('networkidle')

      expect(loaded, `fonts at /${path}`).toEqual([
        ['Inter Variable:loaded'],
        ['Lora Variable:loaded'],
      ])
      expect(failed, `failed requests at /${path}`).toEqual([])
      await viewer.close()
    }
  } finally {
    server.close()
  }
})

test('a served export opens a styled book page whose pages turn, at phone and desktop sizes', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openFixture(page)
  await useOpfsFolder(page, 'served')
  await exportToDone(page, true)
  const { files, root } = await writeDist(page)
  const site = JSON.parse(
    Buffer.from(files['site.json'] ?? '', 'base64').toString(),
  ) as { viewer?: string; books: { path: string }[] }
  expect(site.viewer).toMatch(/^viewer\/assets\/site-[\w-]+\.js$/)
  expect(
    Object.keys(files).filter((path) => path.startsWith('viewer/')),
  ).toEqual(
    expect.arrayContaining([site.viewer, expect.stringMatching(/\.css$/)]),
  )
  const { server, url } = await serveStatic(root)

  try {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
    ]) {
      const viewer = await page.context().newPage()
      await viewer.setViewportSize(viewport)
      const errors: string[] = []
      const failed = failedRequests(viewer)
      viewer.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })
      viewer.on('pageerror', (error) => errors.push(error.message))

      await viewer.goto(`${url}${site.books[0]?.path ?? ''}`)

      const book = viewer.getByTestId('site-book-page')
      await expect(book).toBeVisible()
      // Viewer CSS: the `.site` field paints --site-bg, not the default white.
      const [field] = await pixelsAt(book, [{ x: 2, y: 2 }])
      expect(field?.slice(0, 3)).toEqual([0xe1, 0xe1, 0xe1])
      const next = viewer.getByRole('button', { name: 'Next spread' })
      await expect(next).toHaveCSS('background-color', 'rgb(215, 215, 215)')
      // Viewer JS: the hydrated pager turns to the next slide.
      const indicator = viewer.getByTestId('site-page-indicator')
      const first = await indicator.textContent()
      await expect(async () => {
        await next.click()
        await expect(indicator).not.toHaveText(first ?? '', { timeout: 500 })
      }).toPass({ timeout: 10_000 })
      await viewer.waitForLoadState('networkidle')

      expect(errors, `console errors at ${String(viewport.width)}`).toEqual([])
      expect(failed, `failed requests at ${String(viewport.width)}`).toEqual([])
      await viewer.close()
    }
  } finally {
    server.close()
  }
})
