import { readFileSync } from 'node:fs'
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
})
