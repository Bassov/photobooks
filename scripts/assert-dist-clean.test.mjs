import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { MARKERS, assertDistClean, main } from './assert-dist-clean.mjs'

/** @type {string[]} */
const temps = []

afterEach(() => {
  for (const t of temps.splice(0)) {
    fs.rmSync(t, { recursive: true, force: true })
  }
})

function tmpRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-clean-'))
  temps.push(root)
  return root
}

function writeAsset(root, name, text) {
  const assets = path.join(root, 'dist', 'assets')
  fs.mkdirSync(assets, { recursive: true })
  fs.writeFileSync(path.join(assets, name), text)
}

describe('assertDistClean', () => {
  it('fails when dist/assets is missing', () => {
    expect(assertDistClean(tmpRoot())).toEqual({
      ok: false,
      hits: [{ file: 'dist/assets', marker: 'missing-app-assets-dir' }],
    })
  })

  it('passes a clean deploy bundle and ignores dist/uikit', () => {
    const root = tmpRoot()
    writeAsset(root, 'index-abc.js', 'console.log("app")')
    const kit = path.join(root, 'dist', 'uikit', 'assets')
    fs.mkdirSync(kit, { recursive: true })
    fs.writeFileSync(path.join(kit, 'kit.js'), `kit uses ${MARKERS[0]}`)
    expect(assertDistClean(root)).toEqual({ ok: true })
  })

  it.each(MARKERS.map((m) => [m]))(
    'fails when a deploy asset contains marker %s',
    (marker) => {
      const root = tmpRoot()
      writeAsset(root, 'index-x.js', `PROBE::${marker}::END`)
      expect(assertDistClean(root)).toEqual({
        ok: false,
        hits: expect.arrayContaining([
          { file: 'dist/assets/index-x.js', marker },
        ]),
      })
    },
  )

  it('main exits 1 on a reintroduced marker and 0 when clean', () => {
    const root = tmpRoot()
    writeAsset(root, 'index-x.js', 'ok')
    expect(main(root)).toBe(0)
    writeAsset(root, 'index-x.js', 'window.__photobooksProject = {}')
    expect(main(root)).toBe(1)
  })
})
