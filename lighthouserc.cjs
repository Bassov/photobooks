const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')

// LHCI loads CommonJS/JSON configs only (not ESM .mjs).
const gates = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'quality/gates.json'), 'utf8'),
)

function resolveChromePath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH
  }

  const cacheDir = path.join(os.homedir(), '.cache', 'ms-playwright')
  if (!fs.existsSync(cacheDir)) {
    return undefined
  }

  const candidates = fs
    .readdirSync(cacheDir)
    .filter((name) => name.startsWith('chromium'))
    .flatMap((name) => {
      const base = path.join(cacheDir, name)
      return [
        path.join(base, 'chrome-linux64', 'chrome'),
        path.join(
          base,
          'chrome-headless-shell-linux64',
          'chrome-headless-shell',
        ),
      ]
    })
    .filter((candidate) => fs.existsSync(candidate))

  return candidates[0]
}

const chromePath = resolveChromePath()
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lhci-chrome-'))

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      numberOfRuns: gates.lighthouse.numberOfRuns,
      ...(chromePath ? { chromePath } : {}),
      settings: {
        preset: 'desktop',
        budgetsPath: './budget.json',
        chromeFlags: [
          '--headless=new',
          '--no-sandbox',
          '--disable-gpu',
          `--user-data-dir=${userDataDir}`,
        ],
      },
    },
    assert: {
      assertions: gates.lighthouse.assertions,
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}
