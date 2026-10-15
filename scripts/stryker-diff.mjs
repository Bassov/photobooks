#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { loadMutatePatterns, selectMutableChanges } from './mutation-scope.mjs'

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

const mutateFiles = selectMutableChanges(
  [...changed],
  loadMutatePatterns(),
).filter((file) => existsSync(file))

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
