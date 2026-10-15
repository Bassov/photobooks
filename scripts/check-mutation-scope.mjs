#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs'
import {
  findExcludeReasonGaps,
  findUnclassifiedProductionFiles,
  loadMutatePatterns,
} from './mutation-scope.mjs'

function productionFiles(root = 'src') {
  return readdirSync(root, { recursive: true })
    .map((entry) => `${root}/${String(entry).replaceAll('\\', '/')}`)
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .sort()
}

const patterns = loadMutatePatterns()
const files = productionFiles()
const unclassified = findUnclassifiedProductionFiles(files, patterns)
const gaps = findExcludeReasonGaps(
  patterns,
  readFileSync('stryker.mutate.md', 'utf8'),
)

if (
  unclassified.length > 0 ||
  gaps.missing.length > 0 ||
  gaps.extra.length > 0
) {
  if (unclassified.length > 0) {
    console.error(
      `Production files are neither in mutation scope nor excluded:\n${unclassified.join('\n')}`,
    )
  }
  if (gaps.missing.length > 0) {
    console.error(
      `Exclude patterns missing a reason in stryker.mutate.md:\n${gaps.missing.join('\n')}`,
    )
  }
  if (gaps.extra.length > 0) {
    console.error(
      `stryker.mutate.md documents excludes that are not in stryker.config.json:\n${gaps.extra.join('\n')}`,
    )
  }
  process.exit(1)
}

console.log(
  `Mutation scope covers ${String(files.length)} production files under src/.`,
)
