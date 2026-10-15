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

// Pure helpers + production modules with unit coverage (skip workers / thick UI).
const PHOTO_MUTATE = new Set([
  'src/photo/aspectRatio.ts',
  'src/photo/formatBytes.ts',
  'src/photo/mime.ts',
  'src/photo/normalizeOrientation.ts',
  'src/photo/exifOrientationLabel.ts',
  'src/photo/pickPhoto.ts',
  'src/photo/pickPhotos.ts',
  'src/photo/assetPool.ts',
  'src/photo/objectUrlLru.ts',
])

const EDITOR_MUTATE = new Set([
  'src/editor/bookStore.ts',
  'src/editor/camera.ts',
  'src/editor/cameraStore.ts',
  'src/editor/importPhotos.ts',
  'src/editor/pasteboardWindow.ts',
  'src/editor/thumbCache.ts',
])

const RENDER_MUTATE = new Set(['src/render/frameBox.ts'])

const mutateFiles = [...changed]
  .filter((file) => file.startsWith('src/'))
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .filter((file) => !/\.(test|spec|bench|benchmark)\.(ts|tsx)$/.test(file))
  .filter((file) => !file.endsWith('.d.ts'))
  .filter((file) => !file.endsWith('photo.worker.ts'))
  .filter((file) => {
    if (file.startsWith('src/photo/')) {
      return PHOTO_MUTATE.has(file)
    }
    if (file.startsWith('src/editor/')) {
      return EDITOR_MUTATE.has(file)
    }
    if (file.startsWith('src/render/')) {
      return RENDER_MUTATE.has(file)
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
