#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

const SPEC_RE = /^e2e\/.+\.spec\.ts$/
const HELPER_RE = /^e2e\/helpers\/.+\.[cm]?[jt]sx?$/

export function isE2eSpec(path) {
  return SPEC_RE.test(path.replaceAll('\\', '/'))
}

export function isE2eHelper(path) {
  return HELPER_RE.test(path.replaceAll('\\', '/'))
}

function normalize(path) {
  return path.replaceAll('\\', '/')
}

function listSpecFiles(root) {
  const e2eDir = join(root, 'e2e')
  if (!existsSync(e2eDir)) return []
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      const rel = normalize(relative(root, full))
      if (isE2eSpec(rel)) out.push(rel)
    }
  }
  walk(e2eDir)
  return out.sort()
}

function helperLeaf(helperPath) {
  const norm = normalize(helperPath)
  const file = norm.slice(norm.lastIndexOf('/') + 1)
  return file.replace(/\.[^.]+$/, '')
}

export function importsHelper(specSource, helperPath) {
  const leaf = helperLeaf(helperPath).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    `['"](?:\\.\\.?/)*helpers/${leaf}(?:\\.[cm]?[jt]sx?)?['"]`,
  )
  return re.test(specSource)
}

/**
 * @param {string[]} changedPaths
 * @param {{ readFile?: (path: string) => string, listSpecs?: () => string[] }} [io]
 */
export function selectBurnInTargets(changedPaths, io = {}) {
  const readFile = io.readFile ?? ((path) => readFileSync(path, 'utf8'))
  const listSpecs = io.listSpecs ?? (() => listSpecFiles(process.cwd()))
  const changed = changedPaths.map(normalize)
  const targets = new Set()

  for (const path of changed) {
    if (isE2eSpec(path)) targets.add(path)
  }

  const changedHelpers = changed.filter(isE2eHelper)
  if (changedHelpers.length === 0) return [...targets].sort()

  for (const spec of listSpecs()) {
    let source
    try {
      source = readFile(spec)
    } catch {
      continue
    }
    if (changedHelpers.some((helper) => importsHelper(source, helper))) {
      targets.add(spec)
    }
  }

  return [...targets].sort()
}

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

export function collectChangedPaths(
  base = process.env.STRYKER_DIFF_BASE ?? 'origin/main',
) {
  return [
    ...gitLines(['diff', '--name-only', '--diff-filter=ACMR', base]),
    ...gitLines([
      'diff',
      '--name-only',
      '--diff-filter=ACMR',
      '--cached',
      base,
    ]),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ]
}

function main() {
  const base = process.env.STRYKER_DIFF_BASE ?? 'origin/main'
  const changed = collectChangedPaths(base)
  const targets = selectBurnInTargets(changed).filter(
    (path) => existsSync(path) && statSync(path).isFile(),
  )
  if (targets.length === 0) process.exit(0)
  process.stdout.write(`${targets.join('\n')}\n`)
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  main()
}
