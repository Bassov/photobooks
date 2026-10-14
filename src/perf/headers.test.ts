import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const HEADER_SNIPPETS = [
  'Cross-Origin-Opener-Policy: same-origin',
  'Cross-Origin-Embedder-Policy: credentialless',
] as const

describe('isolation headers', () => {
  it('public/_headers declares COOP and COEP for all paths', () => {
    const contents = readFileSync(
      resolve(import.meta.dirname, '../../public/_headers'),
      'utf8',
    )
    for (const snippet of HEADER_SNIPPETS) {
      expect(contents).toContain(snippet)
    }
  })

  it('dist/_headers is present after build with the same COOP/COEP', () => {
    const distHeaders = resolve(import.meta.dirname, '../../dist/_headers')
    if (!existsSync(distHeaders)) {
      if (process.env.CI) {
        throw new Error(
          'dist/_headers missing in CI; run pnpm build before tests',
        )
      }
      // Local `pnpm test` without a prior build — covered by verify/e2e build.
      return
    }
    const contents = readFileSync(distHeaders, 'utf8')
    for (const snippet of HEADER_SNIPPETS) {
      expect(contents).toContain(snippet)
    }
  })
})
