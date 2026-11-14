import type { Page, Route } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'
import { FIXTURE, openFixture } from './fixtures/siteExport'
import { PERF_BUDGETS } from './perf/budgets'
import {
  browserAssertNoLoaf,
  browserBeginLoafScenarioWindow,
  browserStartLoafScripts,
  browserTakeLoafScripts,
  clearPerfScenario,
  collectFrameStatsArtifact,
  enablePerfScenario,
} from './perf/perfFixture'

// Designer spec in-app-publish § Tests: the `?fixture=painter` editor
// publishes to a fake R2 bucket. Every request to the R2 S3 endpoint (from
// the page and the publish worker) is answered here; nothing reaches
// Cloudflare.

const ACCOUNT = '0f3a9c0f3a9c0f3a9c0f3a9c0f3a9c0f'
const KEY = '0000000000000000000000000000' + '9f2c'
const SECRET = '0'.repeat(60) + 'beef'
const R2 = 'https://*.r2.cloudflarestorage.com/**'
const MANIFEST = '_photobooks/publish-manifest.json'
const FOREIGN = 'notes/mine.txt'
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, PUT, DELETE',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': 'ETag',
}

type Mode = 'ok' | 'key' | 'hold'

interface FakeR2 {
  /** Bucket keys and bodies. */
  objects: Map<string, Buffer>
  puts: string[]
  deletes: string[]
  mode: Mode
  /** PUTs of this key answer 503 this many more times. */
  failKey: (key: string) => boolean
  /** Each PUT answers this late (a slow upload). */
  putDelayMs: number
  /** PUTs held by `hold` now. */
  waiting: () => number
  release: () => void
  /** Forget the counted PUTs and DELETEs. */
  reset: () => void
}

function s3Error(code: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code></Error>`
}

/** An in-memory bucket behind the R2 endpoint (path style: /bucket/key). */
async function routeR2(page: Page): Promise<FakeR2> {
  const held: (() => void)[] = []
  const r2: FakeR2 = {
    objects: new Map([[FOREIGN, Buffer.from('mine')]]),
    puts: [],
    deletes: [],
    mode: 'ok',
    failKey: () => false,
    putDelayMs: 0,
    waiting: () => held.length,
    release: () => {
      r2.mode = 'ok'
      for (const resolve of held.splice(0)) resolve()
    },
    reset: () => {
      r2.puts = []
      r2.deletes = []
    },
  }
  const answer = (route: Route, status: number, body: string | Buffer = '') =>
    route.fulfill({ status, headers: CORS, body })
  await page.route(R2, async (route) => {
    const request = route.request()
    const method = request.method()
    if (method === 'OPTIONS') {
      await answer(route, 204)
      return
    }
    const path = decodeURIComponent(new URL(request.url()).pathname)
    const key = path.split('/').slice(2).join('/')
    if (r2.mode === 'key') {
      await answer(route, 403, s3Error('InvalidAccessKeyId'))
      return
    }
    if (r2.mode === 'hold' && method === 'PUT') {
      await new Promise<void>((resolve) => held.push(resolve))
    }
    if (method === 'PUT') {
      await new Promise((resolve) => setTimeout(resolve, r2.putDelayMs))
      if (r2.failKey(key)) {
        await answer(route, 503, s3Error('SlowDown'))
        return
      }
      r2.puts.push(key)
      r2.objects.set(key, request.postDataBuffer() ?? Buffer.alloc(0))
      await answer(route, 200)
    } else if (method === 'DELETE') {
      r2.deletes.push(key)
      r2.objects.delete(key)
      await answer(route, 204)
    } else {
      const body = r2.objects.get(key)
      await (body === undefined
        ? answer(route, 404, s3Error('NoSuchKey'))
        : answer(route, 200, body))
    }
  })
  return r2
}

/** Every PUT of the first asset (not JSON / HTML) answers 503 SlowDown. */
function failFirstAsset(r2: FakeR2): { key: string } {
  const failing = { key: '' }
  r2.failKey = (key) => {
    if (failing.key === '' && !/\.(json|html)$/.test(key)) {
      failing.key = key
    }
    return key === failing.key
  }
  return failing
}

const pill = (page: Page) => page.getByTestId('publish')
const dialog = (page: Page) => page.getByTestId('publish-dialog')

async function openSettingsHosting(page: Page): Promise<void> {
  await page.getByTestId('editor-settings-open').click()
  await page.getByTestId('settings-nav-hosting').click()
  await expect(page.locator('h1')).toHaveText('Hosting')
}

/** Connect the fake bucket in Settings → Hosting, then back to the book. */
async function connect(page: Page, r2: FakeR2): Promise<void> {
  await openSettingsHosting(page)
  await page.getByTestId('hosting-manual').click()
  await page.getByTestId('hosting-account').fill(ACCOUNT)
  await page.getByTestId('hosting-bucket').fill('my-books')
  await page.getByTestId('hosting-key').fill(KEY)
  await page.getByTestId('hosting-secret').fill(SECRET)
  await page.getByTestId('hosting-url').fill('https://books.example.com')
  await page.getByTestId('hosting-connect').click()
  await expect(page.getByTestId('hosting-connected')).toBeVisible()
  await page.getByTestId('editor-settings-back').click()
  await expect(page.getByTestId('editor-settings')).toHaveCount(0)
  r2.reset()
}

/** Pill → Options → Publish; the dialog stays on the run. */
async function startPublish(page: Page): Promise<void> {
  await pill(page).click()
  await expect(dialog(page)).toHaveAttribute('data-step', 'opts')
  await page.getByTestId('publish-go').click()
}

async function publishToDone(page: Page): Promise<void> {
  await startPublish(page)
  await expect(dialog(page)).toHaveAttribute('data-step', 'done', {
    timeout: 60_000,
  })
}

interface PillSample {
  state: string
  width: number
  height: number
}

/** Record the pill box on every state and text change. */
async function recordPill(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as Window & { __pill?: PillSample[] }
    const node = document.querySelector('[data-testid="publish"]')
    if (!(node instanceof HTMLElement)) {
      throw new Error('publish pill missing')
    }
    const sample = () => {
      const rect = node.getBoundingClientRect()
      w.__pill?.push({
        state: node.dataset.state ?? '',
        width: rect.width,
        height: rect.height,
      })
    }
    w.__pill = []
    sample()
    new MutationObserver(sample).observe(node, {
      attributes: true,
      attributeFilter: ['data-state'],
      characterData: true,
      childList: true,
      subtree: true,
    })
  })
}

function pillSamples(page: Page): Promise<PillSample[]> {
  return page.evaluate(
    () => (window as Window & { __pill?: PillSample[] }).__pill ?? [],
  )
}

/** Drag the first canvas frame by a few px per animation frame. */
async function dragFrame(page: Page, steps: number): Promise<void> {
  const frame = page
    .getByTestId('pasteboard-scroll')
    .getByTestId('spread-frame')
    .first()
  const box = await frame.boundingBox()
  if (box === null) {
    throw new Error('frame has no box')
  }
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(x + (step % 40) * 3, y + (step % 40) * 2)
    await nextFrame(page)
  }
  await page.mouse.up()
}

/** Drag frames while the pill runs (at most 20 drags); the drags made running. */
async function dragWhileRunning(page: Page): Promise<number> {
  let drags = 0
  while (
    drags < 20 &&
    (await pill(page).getAttribute('data-state')) === 'running'
  ) {
    await dragFrame(page, 10)
    drags += 1
  }
  return drags
}

async function nextFrame(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          resolve()
        })
      }),
  )
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
})

test('without hosting Publish asks to connect and opens Settings → Hosting', async ({
  page,
}) => {
  const r2 = await routeR2(page)
  await openFixture(page)

  await pill(page).click()
  await expect(dialog(page)).toHaveAttribute('data-step', 'connect')
  await page.getByTestId('publish-open-hosting').click()

  await expect(dialog(page)).toHaveCount(0)
  await expect(page.locator('h1')).toHaveText('Hosting')
  await expect(page.getByTestId('settings-nav-hosting')).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(r2.puts).toEqual([])
})

test('publishes to Done with the link, then republishes only a changed spread', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const r2 = await routeR2(page)
  await openFixture(page)
  await connect(page, r2)
  await page.evaluate(() => {
    const w = window as Window & { __opened?: unknown[] }
    window.open = (...args: unknown[]) => {
      w.__opened = args
      return null
    }
  })

  await publishToDone(page)

  const first = [...r2.puts]
  expect(first).toContain(MANIFEST)
  expect(first.some((key) => key.endsWith('.html'))).toBe(true)
  expect(r2.deletes).toEqual([])
  await expect(page.getByTestId('publish-link')).toHaveText(
    /^https:\/\/books\.example\.com\/.+\/$/,
  )
  await expect(page.getByTestId('publish-summary')).toContainText(
    `${String(first.length - 1)} changed files uploaded · `,
  )
  await page.getByTestId('publish-open-site').click()
  expect(
    await page.evaluate(
      () => (window as Window & { __opened?: unknown[] }).__opened,
    ),
  ).toEqual(['https://books.example.com/', '_blank', 'noopener,noreferrer'])
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(pill(page)).toHaveAttribute('data-state', 'idle', {
    timeout: 10_000,
  })

  // One spread changes: only its keys go up again.
  r2.reset()
  await dragFrame(page, 6)
  await publishToDone(page)

  const second = r2.puts.filter((key) => key !== MANIFEST)
  expect(second.length).toBeGreaterThan(0)
  expect(second.length).toBeLessThan(first.length - 1)
  expect(second.every((key) => /\.(json|html)$/.test(key))).toBe(true)
  const manifest = JSON.parse(
    r2.objects.get(MANIFEST)?.toString('utf8') ?? '{}',
  ) as Record<string, string>
  for (const key of r2.deletes) {
    expect(first).toContain(key)
  }
  expect(r2.objects.has(FOREIGN)).toBe(true)
  expect(Object.keys(manifest)).not.toContain(FOREIGN)
  await expect(page.getByTestId('publish-summary')).toContainText(
    `${String(second.length)} changed file`,
  )
})

test('a 503 ×3 on one asset fails with "x of y"; Try again sends only the rest', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const r2 = await routeR2(page)
  await openFixture(page)
  await connect(page, r2)
  const failing = failFirstAsset(r2)

  await startPublish(page)

  await expect(dialog(page)).toHaveAttribute('data-step', 'failed', {
    timeout: 60_000,
  })
  const sent = r2.puts.filter((key) => key !== MANIFEST)
  expect(failing.key).toMatch(/^.+\/.+\.\w+$/)
  expect(sent).not.toContain(failing.key)
  await expect(page.getByTestId('publish-error')).toHaveText(
    new RegExp(
      `^Cloudflare answered 503 SlowDown\\. ${String(sent.length)} of \\d+ files went up\\. Try again to send the rest\\.$`,
    ),
  )

  r2.failKey = () => false
  r2.reset()
  await page.getByTestId('publish-retry').click()
  await expect(dialog(page)).toHaveAttribute('data-step', 'done', {
    timeout: 60_000,
  })
  const rest = r2.puts.filter((key) => key !== MANIFEST)
  expect(rest).toContain(failing.key)
  for (const key of rest) {
    expect(sent).not.toContain(key)
  }
})

test('a 403 InvalidAccessKeyId fails as the key; Settings → Hosting shows Can’t connect', async ({
  page,
}) => {
  const r2 = await routeR2(page)
  await openFixture(page)
  await connect(page, r2)
  r2.mode = 'key'

  await startPublish(page)

  await expect(dialog(page)).toHaveAttribute('data-step', 'failed', {
    timeout: 60_000,
  })
  await expect(page.getByTestId('publish-error')).toHaveText(
    "Cloudflare doesn't recognise this key. It may have been deleted or rolled. Replace the token in Settings → Hosting.",
  )
  await expect(page.getByTestId('publish-retry')).toHaveCount(0)
  await page.getByTestId('publish-open-hosting').click()
  await expect(page.locator('h1')).toHaveText('Hosting')
  await expect(page.getByTestId('hosting-badge')).toHaveText("Can't connect")
  expect(r2.puts).toEqual([])
})

test('the pill keeps its width in every state; Hide keeps the canvas editable', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const r2 = await routeR2(page)
  await openFixture(page)
  await connect(page, r2)
  await recordPill(page)
  r2.mode = 'hold'

  await startPublish(page)
  // Uploading: the first PUTs wait on the bucket.
  await expect.poll(() => r2.waiting(), { timeout: 60_000 }).toBeGreaterThan(0)
  await page.getByTestId('publish-hide').click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(pill(page)).toHaveAttribute('data-state', 'running')
  // Painted: the progress fill covers the left share, the field the rest.
  const { width } = (await pill(page).boundingBox()) ?? { width: 0 }
  const [filled, field] = await pixelsAt(pill(page), [
    { x: width * 0.15, y: 4 },
    { x: width * 0.85, y: 4 },
  ])
  expect(field).toEqual([215, 215, 215, 255])
  expect(filled).not.toEqual(field)
  await expect(page.getByTestId('undo')).toBeDisabled()
  await dragFrame(page, 6)
  await expect(page.getByTestId('undo')).toBeEnabled()
  await expect(pill(page)).toHaveAttribute('data-state', 'running')

  r2.release()
  await expect(pill(page)).toHaveAttribute('data-state', 'done', {
    timeout: 60_000,
  })
  await expect(pill(page)).toHaveAttribute('data-state', 'idle', {
    timeout: 10_000,
  })
  r2.mode = 'key'
  await startPublish(page)
  await expect(dialog(page)).toHaveAttribute('data-step', 'failed', {
    timeout: 60_000,
  })
  await page.keyboard.press('Escape')

  const samples = await pillSamples(page)
  const states = new Set(samples.map((sample) => sample.state))
  expect([...states].sort()).toEqual(['done', 'failed', 'idle', 'running'])
  const rest = samples[0]
  for (const sample of samples) {
    expect(Math.abs(sample.width - (rest?.width ?? 0))).toBeLessThanOrEqual(0.5)
    expect(sample.height).toBe(32)
  }
})

test.describe('frame-budget gates', () => {
  test('publish-drag: dragging a frame while the site uploads stays within budget', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    const r2 = await routeR2(page)
    await enablePerfScenario(page, `${FIXTURE}&perf=1`)
    await expect(page.getByTestId('spread-view').first()).toBeVisible()
    await connect(page, r2)
    r2.putDelayMs = 150
    // The first gesture warms the frame-drag path (one LoAF either way).
    await dragFrame(page, 5)
    await pill(page).click()
    await expect(dialog(page)).toHaveAttribute('data-step', 'opts')
    await nextFrame(page)
    await clearPerfScenario(page)
    await page.evaluate(browserStartLoafScripts)
    await page.evaluate(browserBeginLoafScenarioWindow)

    await page.getByTestId('publish-go').click()
    await page.getByTestId('publish-hide').click()
    const moves = await dragWhileRunning(page)
    const rows = await page.evaluate(browserTakeLoafScripts)
    console.log(
      `publish-drag: ${String(rows.length)} LoAF, ${String(moves)} drags ${JSON.stringify(rows)}`,
    )
    await page.evaluate(browserAssertNoLoaf, PERF_BUDGETS.loafEntriesMax)
    await collectFrameStatsArtifact(page, testInfo)
    await expect(pill(page)).toHaveAttribute('data-state', 'done', {
      timeout: 60_000,
    })
    expect(moves).toBeGreaterThan(0)
  })
})
