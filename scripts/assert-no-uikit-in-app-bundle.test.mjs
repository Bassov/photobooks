import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  MARKERS,
  assertNoUikitInAppBundle,
} from './assert-no-uikit-in-app-bundle.mjs'

/** @type {string[]} */
const temps = []

afterEach(() => {
  for (const t of temps.splice(0)) {
    fs.rmSync(t, { recursive: true, force: true })
  }
})

function tmpRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uikit-assert-'))
  temps.push(root)
  return root
}

describe('assertNoUikitInAppBundle', () => {
  it('fails when dist/assets is missing', () => {
    const root = tmpRoot()
    const r = assertNoUikitInAppBundle(root)
    expect(r).toEqual({
      ok: false,
      hits: [{ file: 'dist/assets', marker: 'missing-app-assets-dir' }],
    })
  })

  it('passes when app assets have no uikit markers', () => {
    const root = tmpRoot()
    const assets = path.join(root, 'dist', 'assets')
    fs.mkdirSync(assets, { recursive: true })
    fs.writeFileSync(path.join(assets, 'index-abc.js'), 'console.log("app")')
    const kit = path.join(root, 'dist', 'uikit', 'assets')
    fs.mkdirSync(kit, { recursive: true })
    fs.writeFileSync(
      path.join(kit, 'kit.js'),
      `marker ${MARKERS[0]} should not be scanned via dist/assets`,
    )
    expect(assertNoUikitInAppBundle(root)).toEqual({ ok: true })
  })

  it.each(MARKERS.map((m) => [m]))(
    'fails when app asset contains marker %s',
    (marker) => {
      const root = tmpRoot()
      const assets = path.join(root, 'dist', 'assets')
      fs.mkdirSync(assets, { recursive: true })
      // Unique payload so overlapping substrings among MARKERS do not matter.
      const payload = `UIKIT_MARKER_PROBE::${marker}::END`
      fs.writeFileSync(path.join(assets, 'index-x.js'), payload)
      expect(assertNoUikitInAppBundle(root)).toEqual(
        expect.objectContaining({
          ok: false,
          hits: expect.arrayContaining([
            { file: 'dist/assets/index-x.js', marker },
          ]),
        }),
      )
    },
  )
})
