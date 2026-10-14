#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const base = process.env.STRYKER_DIFF_BASE ?? 'origin/main'

function gitLines(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  if (result.status !== 0) {
    console.error(result.stderr || `git ${args.join(' ')} failed`)
    process.exit(result.status ?? 1)
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

const changed = new Set([
  ...gitLines(['diff', '--name-only', '--diff-filter=ACMR', base]),
  ...gitLines(['diff', '--name-only', '--diff-filter=ACMR', '--cached', base]),
  ...gitLines(['ls-files', '--others', '--exclude-standard']),
])

const PURE_PHOTO = new Set([
  'src/photo/aspectRatio.ts',
  'src/photo/formatBytes.ts',
  'src/photo/mime.ts',
  'src/photo/normalizeOrientation.ts',
  'src/photo/exifOrientationLabel.ts',
])

const mutateFiles = [...changed]
  .filter((file) => file.startsWith('src/'))
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .filter((file) => !/\.(test|spec|bench|benchmark)\.(ts|tsx)$/.test(file))
  .filter((file) => !file.endsWith('.d.ts'))
  .filter((file) => !file.endsWith('photo.worker.ts'))
  .filter((file) => {
    if (file.startsWith('src/photo/')) {
      return PURE_PHOTO.has(file)
    }
    if (file.startsWith('src/lib/')) {
      return true
    }
    if (file.startsWith('src/core/')) {
      // Skip barrel and test fixtures; mutate production core modules only.
      return !file.endsWith('/index.ts') && !file.includes('/testing/')
    }
    return false
  })
  .filter((file) => existsSync(file))
  .sort()

if (mutateFiles.length === 0) {
  console.log(`No mutable src files changed vs ${base}; skipping Stryker.`)
  process.exit(0)
}

console.log(
  `Stryker mutate (${String(mutateFiles.length)} files):\n${mutateFiles.join('\n')}`,
)

const result = spawnSync(
  'pnpm',
  ['exec', 'stryker', 'run', '--mutate', mutateFiles.join(','), '--allowEmpty'],
  { stdio: 'inherit' },
)

process.exit(result.status ?? 1)
