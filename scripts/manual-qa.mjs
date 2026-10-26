/** Repo manual-qa entry: kit welcome → session editor, then rig scenario checks. */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'

export function resolveManualQaEntry(
  requireFn = createRequire(import.meta.url),
) {
  const pkgDir = path.dirname(
    requireFn.resolve('@albasov/ts-agent-rig/package.json'),
  )
  return path.join(pkgDir, 'src', 'manual-qa.mjs')
}

export async function loadManualQa(requireFn = createRequire(import.meta.url)) {
  const entry = resolveManualQaEntry(requireFn)
  return import(pathToFileURL(entry).href)
}

/**
 * Enter editor shell from kit welcome (or legacy home-screen).
 * @param {import('playwright').Page} page
 * @param {string} baseURL
 */
async function ensureEditorShell(page, baseURL) {
  await page.goto(`${baseURL}/?perf=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  if (
    await page
      .getByTestId('editor-shell')
      .isVisible()
      .catch(() => false)
  ) {
    return
  }
  if (
    await page
      .getByTestId('welcome-screen')
      .isVisible()
      .catch(() => false)
  ) {
    await page.evaluate(() => {
      const api = window.__photobooksProject
      if (!api?.startSessionEditor) {
        throw new Error('startSessionEditor missing')
      }
      api.startSessionEditor()
    })
    await page
      .getByTestId('editor-shell')
      .waitFor({ state: 'visible', timeout: 15_000 })
    return
  }
  if (
    await page
      .getByTestId('home-screen')
      .isVisible()
      .catch(() => false)
  ) {
    const start = page.getByTestId('start-session')
    if (await start.isVisible().catch(() => false)) {
      await start.click()
      await page
        .getByTestId('editor-shell')
        .waitFor({ state: 'visible', timeout: 15_000 })
    }
  }
}

/** @param {Record<string, unknown>} [opts] */
export async function runManualQa(opts = {}) {
  const requireFn = createRequire(import.meta.url)
  const rig = await loadManualQa(requireFn)
  const root = /** @type {string} */ (
    opts.root ??
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  )
  const slug = /** @type {string | undefined} */ (opts.slug)
  const fromMd = rig.parseManualScenarios(rig.loadScenarioSources(root, slug))
  const scenarios = /** @type {string[] | undefined} */ (opts.scenarios)?.length
    ? /** @type {string[]} */ (opts.scenarios)
    : fromMd.length
      ? fromMd
      : ['smoke: branded editor shell shows Photobooks']

  let baseURL = /** @type {string | undefined} */ (opts.baseUrl)
  /** @type {import('node:child_process').ChildProcess | null} */
  let preview = null
  if (!baseURL) {
    const port = String(process.env.E2E_PORT || '4173')
    baseURL = `http://127.0.0.1:${port}`
    const probe = spawnSync(
      process.execPath,
      [
        '-e',
        `fetch(${JSON.stringify(baseURL)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))`,
      ],
      { cwd: root, encoding: 'utf8' },
    )
    if (probe.status !== 0) {
      // Match Playwright webServer: expose `__photobooksProject` for session entry.
      const buildEnv = { ...process.env, VITE_E2E: '1' }
      const build = spawnSync('pnpm', ['build'], {
        cwd: root,
        encoding: 'utf8',
        env: buildEnv,
      })
      if (build.status !== 0) {
        return {
          ok: false,
          lines: ['1. bootstrap: expected / observed — pnpm build failed'],
        }
      }
      preview = spawn(
        'pnpm',
        ['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', port],
        {
          cwd: root,
          env: process.env,
          stdio: 'ignore',
        },
      )
      await new Promise((r) => setTimeout(r, 1500))
    }
  }

  /** @type {string[]} */
  const lines = []
  /** @type {string[]} */
  const problems = []
  try {
    const { chromium } = requireFn('playwright')
    const browser = await chromium.launch({
      headless: true,
      executablePath: opts.chromiumPath || process.env.CHROME_PATH || undefined,
    })
    const page = await browser.newPage()
    const client = await page.context().newCDPSession(page)
    await client.send('Emulation.setCPUThrottlingRate', {
      rate: rig.MANUAL_QA_CPU_THROTTLE,
    })

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i]
      const isPerf = /^perf:/i.test(scenario)
      try {
        await ensureEditorShell(page, baseURL)
        if (
          !(await page
            .getByTestId('editor-shell')
            .isVisible()
            .catch(() => false))
        ) {
          problems.push(
            `${i + 1}. ${scenario}: expected editor-shell visible / observed missing`,
          )
          continue
        }
        if (isPerf) {
          await page.evaluate(() =>
            window.__photobooksPerf?.clearLoafEntries?.(),
          )
          await page.mouse.wheel(0, 400)
          await page.waitForTimeout(500)
          const loaf = await page.evaluate(
            () => window.__photobooksPerf?.getLoafEntries?.()?.length ?? -1,
          )
          if (loaf > 0) {
            problems.push(
              `${i + 1}. ${scenario}: expected 0 LoAF / observed ${loaf}`,
            )
            continue
          }
          if (loaf < 0) {
            problems.push(
              `${i + 1}. ${scenario}: expected __photobooksPerf LoAF API / observed missing`,
            )
            continue
          }
        }
        const brand = await page
          .getByText('Photobooks')
          .first()
          .isVisible()
          .catch(() => false)
        if (!brand && /photobooks|brand|shell/i.test(scenario)) {
          problems.push(
            `${i + 1}. ${scenario}: expected Photobooks brand / observed missing`,
          )
          continue
        }
        lines.push(`OK ${scenario}`)
      } catch (err) {
        problems.push(
          `${i + 1}. ${scenario}: expected pass / observed ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }
    await browser.close()
  } catch (err) {
    problems.push(
      `1. playwright: expected launch / observed ${err instanceof Error ? err.message : String(err)}`,
    )
  } finally {
    if (preview?.pid) {
      try {
        process.kill(preview.pid, 'SIGTERM')
      } catch {
        /* ignore */
      }
    }
  }
  return problems.length ? { ok: false, lines: problems } : { ok: true, lines }
}

export async function main(argv = process.argv.slice(2)) {
  let slug
  let baseUrl
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--change' || argv[i] === '--slug') slug = argv[++i]
    else if (argv[i] === '--base-url') baseUrl = argv[++i]
  }
  const result = await runManualQa({ slug, baseUrl })
  for (const line of result.lines) console.log(line)
  return result.ok ? 0 : 1
}

const isDirect =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirect) {
  void main().then((code) => {
    process.exitCode = code
  })
}
