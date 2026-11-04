import { cleanup, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveSpread, type Frame } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { SPREAD_PX_PER_MM } from './frameBox'
import { SpreadView } from './SpreadView'
import { textLineMm } from './textStyles'

function textFrame(overrides: Partial<Frame> = {}): Frame {
  return makeFrame({
    id: 't1',
    rect: { x: 10, y: 20, width: 60, height: 10 },
    z: 3,
    kind: 'text',
    content: { type: 'static', text: 'Morning on the lake' },
    ...overrides,
  })
}

function paint(
  frame: Frame,
  {
    control = false,
    thumb = false,
  }: { control?: boolean; thumb?: boolean } = {},
) {
  const book = makeBook({ spreads: [makeSpread({ frames: [frame] })] })
  const resolved = resolveSpread(book, 'spread-1')
  if (resolved === undefined) {
    throw new Error('unresolved')
  }
  return render(
    <SpreadView
      spreadId="spread-1"
      resolved={resolved}
      previewUrlFor={() => undefined}
      thumb={thumb}
      {...(control
        ? { frameControlFor: () => ({ label: 'Text', onActivate: vi.fn() }) }
        : {})}
    />,
  )
}

afterEach(cleanup)

describe('SpreadView text frames', () => {
  it('paints a controlled text frame as a text-kind button, not a photo slot', () => {
    paint(textFrame(), { control: true })
    const frame = screen.getByTestId('spread-frame')
    expect(frame.tagName).toBe('BUTTON')
    expect(frame.dataset.kind).toBe('text')
    expect(frame.dataset.filled).toBeUndefined()
    expect(frame.dataset.dropLabel).toBeUndefined()
    expect(screen.queryByTestId('frame-empty-label')).toBeNull()
    expect(screen.getByTestId('frame-text').textContent).toBe(
      'Morning on the lake',
    )
  })

  it('paints no fill: text sits over photos, an empty frame prints nothing', () => {
    const sheet = document.createElement('style')
    sheet.textContent = readFileSync('src/render/SpreadView.css', 'utf8')
    document.head.append(sheet)
    try {
      paint(textFrame({ content: { type: 'static', text: '' } }))
      const frame = screen.getByTestId('spread-frame')
      expect(getComputedStyle(frame).backgroundColor).toBe('transparent')
      expect(screen.getByTestId('frame-text').textContent).toBe('')
    } finally {
      sheet.remove()
    }
  })

  it('shows whole lines only, in the style scaled by px/mm', () => {
    paint(textFrame())
    const text = screen.getByTestId('frame-text')
    // 10 mm holds two 4.34 mm caption lines.
    expect(text.style.height).toBe(
      `${String(2 * textLineMm('caption') * SPREAD_PX_PER_MM)}px`,
    )
    expect(text.style.fontSize).toBe(`${String(3.1 * SPREAD_PX_PER_MM)}px`)
    expect(text.style.textAlign).toBe('left')
    expect(text.style.color).toBe('#232220')
  })

  it('follows the frame style and alignment', () => {
    paint(
      textFrame({
        styleId: 'title',
        align: 'right',
        rect: { x: 0, y: 0, width: 60, height: 25 },
      }),
    )
    const text = screen.getByTestId('frame-text')
    expect(text.style.fontSize).toBe(`${String(9 * SPREAD_PX_PER_MM)}px`)
    expect(text.style.fontWeight).toBe('500')
    expect(text.style.textAlign).toBe('right')
    expect(text.style.height).toBe(
      `${String(2 * textLineMm('title') * SPREAD_PX_PER_MM)}px`,
    )
  })

  it('shows Empty text for an empty frame only with a control', () => {
    const empty = textFrame({ content: { type: 'static', text: '' } })
    paint(empty, { control: true })
    const placeholder = screen.getByTestId('frame-text')
    expect(placeholder.textContent).toBe('Empty text')
    expect(placeholder.dataset.placeholder).toBe('true')
    cleanup()
    paint(empty)
    expect(screen.getByTestId('frame-text').textContent).toBe('')
    expect(screen.getByTestId('frame-text').dataset.placeholder).toBeUndefined()
  })

  it('paints the text in an inert thumbnail without test ids', () => {
    const { container } = paint(textFrame(), { thumb: true })
    expect(screen.queryByTestId('frame-text')).toBeNull()
    const text = container.querySelector('.spread-frame-text')
    expect(text?.textContent).toBe('Morning on the lake')
    expect(text?.closest('.spread-frame')?.getAttribute('data-kind')).toBe(
      'text',
    )
  })
})
