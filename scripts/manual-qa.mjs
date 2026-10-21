/** Thin repo entry for `pnpm agent manual-qa` → @albasov/ts-agent-rig. */
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

export async function main(argv = process.argv.slice(2)) {
  const mod = await loadManualQa()
  return mod.main(argv)
}

const isDirect =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirect) {
  void main().then((code) => {
    process.exitCode = code
  })
}
