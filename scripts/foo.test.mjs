import { describe, expect, it } from 'vitest'
import {
  isScriptProductionPath,
  isScriptTestPath,
  isThinDelegatingCli,
} from './foo.mjs'

describe('foo script path helpers', () => {
  it('classifies production vs test script paths', () => {
    expect(isScriptProductionPath('scripts/foo.mjs')).toBe(true)
    expect(isScriptProductionPath('scripts/foo.test.mjs')).toBe(false)
    expect(isScriptTestPath('scripts/foo.test.mjs')).toBe(true)
    expect(isScriptTestPath('scripts/foo.mjs')).toBe(false)
    expect(isScriptProductionPath('src/x.ts')).toBe(false)
    expect(isScriptProductionPath('scripts/x.ts')).toBe(false)
    expect(isScriptProductionPath(/** @type {any} */ (null))).toBe(false)
  })

  it('accepts only ≤10-line sole sibling .mjs import CLIs', () => {
    expect(isThinDelegatingCli(null)).toBe(false)
    expect(isThinDelegatingCli(undefined)).toBe(false)
    expect(isThinDelegatingCli('')).toBe(false)
    expect(
      isThinDelegatingCli(`#!/usr/bin/env node
import { main } from './agent.mjs'

main(process.argv.slice(2), process)
`),
    ).toBe(true)
    expect(
      isThinDelegatingCli(`#!/usr/bin/env node
import path from 'node:path'
import { run } from './check-gate-ratchet.mjs'
process.exitCode = run()
`),
    ).toBe(false)
    expect(
      isThinDelegatingCli(`import { a } from './a.mjs'
import { b } from './b.mjs'
a(); b()
`),
    ).toBe(false)
    expect(
      isThinDelegatingCli(`import { a } from '../outside.mjs'
a()
`),
    ).toBe(false)
    expect(
      isThinDelegatingCli(`import { a } from './a.ts'
a()
`),
    ).toBe(false)
    expect(
      isThinDelegatingCli(`import { a } from "yaml"
a()
`),
    ).toBe(false)
    expect(
      isThinDelegatingCli(`import { a } from ./missing-quotes.mjs
a()
`),
    ).toBe(false)
    expect(
      isThinDelegatingCli(`import { a } from './unterminated
a()
`),
    ).toBe(false)
    expect(
      isThinDelegatingCli(`${'x\n'.repeat(11)}import { a } from './a.mjs'\n`),
    ).toBe(false)
    expect(isThinDelegatingCli('#!/usr/bin/env node\nmain()\n')).toBe(false)
    expect(
      isThinDelegatingCli(`import { a } from "./agent.mjs"
a()
`),
    ).toBe(true)
    expect(isThinDelegatingCli(`import { a } from './a.mjs'`)).toBe(false)
    expect(
      isThinDelegatingCli(`import { main } from './agent.mjs'
main(process.argv.slice(2), process)
`),
    ).toBe(true)
  })
})
