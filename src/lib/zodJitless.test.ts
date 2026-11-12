import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import './zodJitless'

describe('zod under the CSP', () => {
  it('runs jitless, so building and parsing schemas never probe eval', () => {
    expect(z.config().jitless).toBe(true)
    expect(z.object({ a: z.number() }).parse({ a: 1 })).toEqual({ a: 1 })
  })

  it('the editor entry imports the config first', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8')

    // Compare the module specifier only: quotes and semicolons vary when a tool
    // (stryker's instrumenter) reprints the source.
    const firstImport = /^import\s[^'"]*['"]([^'"]+)['"]/m.exec(source)

    expect(firstImport?.[1]).toBe('./lib/zodJitless')
  })
})
