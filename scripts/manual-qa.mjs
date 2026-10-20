#!/usr/bin/env node
/** Thin repo entry for `pnpm agent manual-qa` → @albasov/ts-agent-rig. */
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const pkgDir = path.dirname(
  require.resolve('@albasov/ts-agent-rig/package.json'),
)
const entry = path.join(pkgDir, 'src', 'manual-qa.mjs')
const mod = await import(pathToFileURL(entry).href)
process.exitCode = await mod.main(process.argv.slice(2))
