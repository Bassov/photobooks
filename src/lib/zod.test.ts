import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { z } from './zod'

const SRC = resolve(process.cwd(), 'src')

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourcesUnder(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('zod under the CSP', () => {
  it('runs jitless, so parsing never probes eval', () => {
    expect(z.config().jitless).toBe(true)
    expect(z.object({ a: z.number() }).parse({ a: 1 })).toEqual({ a: 1 })
  })

  it('every app module takes zod from src/lib/zod', () => {
    const direct = sourcesUnder(SRC)
      .filter((path) =>
        /from 'zod(?:\/[^']*)?'/.test(readFileSync(path, 'utf8')),
      )
      .map((path) => relative(SRC, path))

    expect(direct).toEqual(['lib/zod.ts'])
  })
})
