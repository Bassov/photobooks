import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkUikitInDist } from './assert-uikit-in-dist.mjs'

function dist(files) {
  const d = mkdtempSync(join(tmpdir(), 'uikit-dist-'))
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(d, rel, '..'), { recursive: true })
    writeFileSync(join(d, rel), body)
  }
  return d
}

describe('checkUikitInDist', () => {
  it('passes when dist/uikit has the kit index and bundle', () => {
    const d = dist({
      'uikit/index.html': '<script src="./assets/kit.js"></script>',
      'uikit/assets/kit.js': '',
    })
    expect(checkUikitInDist(d)).toBeNull()
  })
  it('fails when dist/uikit is missing (app SPA fallback would serve /uikit/)', () => {
    const d = dist({ 'index.html': '<title>Photobooks</title>' })
    expect(checkUikitInDist(d)).toMatch(/missing .*uikit.*index\.html/)
  })
  it('fails when dist/uikit/index.html is not the kit', () => {
    const d = dist({
      'uikit/index.html': '<script src="/assets/index-x.js"></script>',
    })
    expect(checkUikitInDist(d)).toMatch(/does not load the kit bundle/)
  })
  it('fails when the kit bundle file is missing', () => {
    const d = dist({
      'uikit/index.html': '<script src="./assets/kit.js"></script>',
    })
    expect(checkUikitInDist(d)).toMatch(/missing .*kit\.js/)
  })
})
