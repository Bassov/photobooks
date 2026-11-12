import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The personal site (every `src/site/**` module and the `site.html` viewer
 * entry) must never reach the hosting token store, directly or transitively.
 */
const ROOT = process.cwd()
const SITE_DIR = resolve(ROOT, 'src/site')
const CREDENTIALS = resolve(ROOT, 'src/publish/credentials.ts')
const EXTENSIONS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']

const SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\bnew\s+URL\s*\(\s*)['"]([^'"]+)['"]/g

function isTest(path: string): boolean {
  return /\.(test|test-helpers)\.tsx?$/.test(path)
}

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourcesUnder(path)
    return /\.tsx?$/.test(name) && !isTest(path) ? [path] : []
  })
}

/** Relative / root-absolute specifier → source file, or `undefined` for packages. */
function resolveImport(from: string, specifier: string): string | undefined {
  const bare = specifier.replace(/\?.*$/, '')
  if (!bare.startsWith('.') && !bare.startsWith('/')) return undefined
  const base = bare.startsWith('/')
    ? resolve(ROOT, `.${bare}`)
    : resolve(dirname(from), bare)
  return EXTENSIONS.map((ext) => `${base}${ext}`).find(
    (path) => existsSync(path) && statSync(path).isFile(),
  )
}

/** Relative or alias-looking specifiers the walk could not follow. */
const unresolved: string[] = []

function importsOf(path: string): string[] {
  if (!/\.tsx?$/.test(path)) return []
  const text = readFileSync(path, 'utf8')
  return [...text.matchAll(SPECIFIER)].flatMap((match) => {
    const specifier = match[1] ?? ''
    const target = resolveImport(path, specifier)
    if (target === undefined && /^(\.|\/|@\/|~|#|src\/)/.test(specifier)) {
      unresolved.push(`${relative(ROOT, path)}: ${specifier}`)
    }
    return target === undefined ? [] : [target]
  })
}

/** Every module reachable from `roots`, each mapped to one importer chain. */
function closure(roots: readonly string[]): Map<string, string[]> {
  const chains = new Map<string, string[]>(roots.map((root) => [root, [root]]))
  const queue = [...roots]
  for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
    const chain = chains.get(path) ?? []
    for (const target of importsOf(path)) {
      if (!chains.has(target)) {
        chains.set(target, [...chain, target])
        queue.push(target)
      }
    }
  }
  return chains
}

function viewerEntries(): string[] {
  const html = readFileSync(resolve(ROOT, 'site.html'), 'utf8')
  return [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].flatMap((match) => {
    const target = resolveImport(resolve(ROOT, 'site.html'), match[1] ?? '')
    return target === undefined ? [] : [target]
  })
}

describe('publish credentials import boundary', () => {
  it('finds the viewer entry and the site modules', () => {
    expect(viewerEntries()).toEqual([resolve(ROOT, 'src/site/main.tsx')])
    expect(sourcesUnder(SITE_DIR).length).toBeGreaterThan(10)
    expect(existsSync(CREDENTIALS)).toBe(true)
  })

  it('no site module or viewer entry reaches src/publish/credentials', () => {
    const chains = closure([...viewerEntries(), ...sourcesUnder(SITE_DIR)])

    const chain = (chains.get(CREDENTIALS) ?? []).map((path) =>
      relative(ROOT, path),
    )
    expect(chain).toEqual([])
    // An alias or unresolved path would hide an edge from this walk.
    expect(unresolved).toEqual([])
    expect(chains.size).toBeGreaterThan(sourcesUnder(SITE_DIR).length)
  })

  it('only src/publish modules open the raw credential store', () => {
    const publishDir = resolve(ROOT, 'src/publish')
    const sources = sourcesUnder(resolve(ROOT, 'src'))

    const outside = sources
      .filter((path) => !path.startsWith(`${publishDir}/`))
      .filter((path) =>
        readFileSync(path, 'utf8').includes('createCredentialStore'),
      )
      .map((path) => relative(ROOT, path))

    expect(outside).toEqual([])
    expect(
      sources.filter((path) =>
        readFileSync(path, 'utf8').includes('createCredentialStore('),
      ).length,
    ).toBeGreaterThan(1)
  })
})
