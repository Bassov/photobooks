import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveSpread, type ResolvedItem } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { SpreadView, type FrameControl } from './SpreadView'

const PX_PER_MM = 2

function renderWith(
  control: (item: ResolvedItem) => Partial<FrameControl>,
): void {
  const book = makeBook({
    spreads: [
      makeSpread({
        id: 's',
        frames: [
          makeFrame({ id: 'a', rect: { x: 10, y: 10, width: 20, height: 10 } }),
          makeFrame({
            id: 'b',
            rect: { x: 50, y: 40, width: 20, height: 10 },
            rotationDeg: 90,
          }),
          makeFrame({
            id: 'c',
            rect: { x: 100, y: 10, width: 10, height: 10 },
          }),
        ],
      }),
    ],
  })
  const resolved = resolveSpread(book, 's')
  assert(resolved !== undefined, 'expected resolved spread')
  render(
    <SpreadView
      spreadId="s"
      resolved={resolved}
      previewUrlFor={() => undefined}
      pxPerMm={PX_PER_MM}
      frameControlFor={(item) => ({
        label: 'Frame',
        onActivate: vi.fn(),
        ...control(item),
      })}
    />,
  )
}

const pressed =
  (...ids: string[]) =>
  (item: ResolvedItem): Partial<FrameControl> =>
    ids.includes(item.frameId) ? { pressed: true } : {}

describe('SpreadView multi-selection', () => {
  afterEach(cleanup)

  it('places the group box on the union, rotated corners included, and no handles', () => {
    renderWith(pressed('a', 'b'))
    const box = screen.getByTestId('group-box')
    // a: x 10–30, y 10–20 mm. b turned 90° about (60, 45): x 55–65, y 35–55 mm.
    expect(box.style.left).toBe(`${String(10 * PX_PER_MM)}px`)
    expect(box.style.top).toBe(`${String(10 * PX_PER_MM)}px`)
    expect(box.style.width).toBe(`${String(55 * PX_PER_MM)}px`)
    expect(box.style.height).toBe(`${String(45 * PX_PER_MM)}px`)
    expect(box.getAttribute('aria-hidden')).toBe('true')
    // The camera writes --cam-scale on it each live-zoom frame.
    expect(box.hasAttribute('data-camera-frame')).toBe(true)
    expect(screen.queryAllByTestId('spread-frame-handles')).toHaveLength(0)
    expect(
      screen
        .getAllByTestId('spread-frame')
        .filter((el) => el.getAttribute('aria-pressed') === 'true'),
    ).toHaveLength(2)
  })

  it('keeps handles and no group box for one selected frame', () => {
    renderWith(pressed('c'))
    expect(screen.queryByTestId('group-box')).toBeNull()
    expect(screen.getAllByTestId('spread-frame-handles')).toHaveLength(1)
  })

  it('hides the group box while a frame on the spread is in crop mode', () => {
    renderWith((item) => ({
      ...pressed('a', 'b')(item),
      ...(item.frameId === 'c' ? { cropActive: true } : {}),
    }))
    expect(screen.queryByTestId('group-box')).toBeNull()
  })

  it('paints the box 4 screen px out as a 1px dashed mark outline that takes no pointer', () => {
    const css = readFileSync('src/render/SpreadView.css', 'utf8')
    const rule = /\.spread-group-box \{([^}]*)\}/.exec(css)?.[1] ?? ''
    const line = /\.spread-group-box::after \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(line).toContain('outline: 1px dashed var(--color-mark)')
    // Screen px through a live zoom: the gap and the outline undo --cam-scale.
    expect(rule).toContain('box-sizing: content-box')
    expect(rule).toContain('padding: calc(4px / var(--cam-scale, 1))')
    expect(rule).toContain('margin: calc(-4px / var(--cam-scale, 1))')
    expect(line).toContain('width: calc(100% * var(--cam-scale, 1))')
    expect(line).toContain('scale: calc(1 / var(--cam-scale, 1))')
    expect(rule).toContain('pointer-events: none')
    expect(rule).not.toContain('background')
  })
})
