import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { BookSettingsSection } from './BookSettingsSection'
import { resetBookStore } from './bookStore'
import { CoverSection } from './CoverSection'
import { EDITOR_CHROME_CSS, SUB } from './editorChromeTokens'
import { FitCropSection } from './FitCropSection'
import { InspectorHead, InspectorRow, InspectorSec } from './InspectorControls'
import { PhotoRotateSection } from './PhotoRotateSection'
import { PhotoSection } from './PhotoSection'

vi.mock('./thumbCache', () => ({
  getThumbUrl: () => undefined,
  subscribeThumb: () => () => undefined,
}))

const filled = { spreadId: 'spread-1', frameId: 'filled' }
const empty = { spreadId: 'spread-1', frameId: 'empty' }

function seed() {
  resetBookStore({
    book: makeBook({
      assets: { a: { widthPx: 600, heightPx: 400 } },
      gallery: ['a'],
      spreads: [
        makeSpread({
          id: 'spread-1',
          frames: [
            makeFrame({ id: 'filled', assetId: 'a' }),
            makeFrame({ id: 'empty', assetId: undefined }),
          ],
        }),
      ],
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

const trigger = (name: string) => screen.getByRole('button', { name })

afterEach(() => {
  cleanup()
  resetBookStore()
})

// Kit v7 Head / Sec / Row (uikit/src/sandbox/v7.tsx:130-150), Owner Must M59.
describe('kit inspector primitives', () => {
  it('Head: the h2 context title over a muted subline', () => {
    render(<InspectorHead title="Cover" sub="Hardcover" subTestId="sub" />)
    const head = screen.getByTestId('inspector-head')
    expect(head.className).toBe('px-4 pt-4 pb-1')
    const title = screen.getByTestId('inspector-context')
    expect([title.tagName, title.className, title.textContent]).toEqual([
      'H2',
      'inspector-head-title',
      'Cover',
    ])
    const sub = screen.getByTestId('sub')
    expect([sub.tagName, sub.className, sub.textContent]).toEqual([
      'P',
      'inspector-head-sub text-muted-foreground',
      'Hardcover',
    ])
  })

  it('Sec: a px-4 py-4 block with an mb-3 title row, then its rows', () => {
    render(
      <InspectorSec title="Fill" testId="sec">
        <span>row</span>
      </InspectorSec>,
    )
    const sec = screen.getByTestId('sec')
    expect([sec.tagName, sec.className]).toEqual(['SECTION', 'px-4 py-4'])
    const title = screen.getByRole('heading', { level: 3, name: 'Fill' })
    expect(title.className).toBe('inspector-eyebrow inspector-sec-title')
    expect(title.parentElement?.className).toBe(
      'mb-3 flex items-center justify-between',
    )
    expect(sec.lastElementChild?.textContent).toBe('row')
  })

  it('Sec: adds an extra title class when given', () => {
    render(
      <InspectorSec title="Fill" titleClassName="hook">
        <span />
      </InspectorSec>,
    )
    expect(screen.getByRole('heading', { name: 'Fill' }).className).toBe(
      'inspector-eyebrow inspector-sec-title hook',
    )
  })

  it('Row: muted label, then the controls; extra class and test id', () => {
    render(
      <>
        <InspectorRow label="Style" testId="plain">
          <span>pill</span>
        </InspectorRow>
        <InspectorRow label="Same" className="hook" testId="hooked">
          <span>toggle</span>
        </InspectorRow>
      </>,
    )
    const plain = screen.getByTestId('plain')
    expect(plain.className).toBe('inspector-row')
    expect([...plain.children].map((child) => child.textContent)).toEqual([
      'Style',
      'pill',
    ])
    expect((plain.firstElementChild as HTMLElement).style.color).toBe(SUB)
    expect(screen.getByTestId('hooked').className).toBe('inspector-row hook')
  })

  it('Cover and Book settings open on the kit Head and Sec blocks', () => {
    seed()
    render(<CoverSection />)
    expect(screen.getByTestId('inspector-context').className).toBe(
      'inspector-head-title',
    )
    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .map((title) => title.closest('section')?.className),
    ).toEqual(['px-4 py-4', 'px-4 py-4', 'px-4 py-4', 'px-4 py-4'])
    cleanup()
    render(<BookSettingsSection />)
    expect(screen.getByTestId('book-settings-subtitle').className).toBe(
      'inspector-head-sub text-muted-foreground',
    )
    expect(screen.getByTestId('size-preset').className).toContain(
      'insp-size-select',
    )
    // Kit SegC (v7.tsx:138) for the two-way choices (Owner Musts M59, M61).
    expect(
      screen.getByRole('radiogroup', { name: 'Orientation' }).className,
    ).toBe('pb-segmented pb-segmented--inspector')
  })
})

// Owner Musts M61 / M67: the shared control owns its label weight and its
// raised kit pill; the editor chrome no longer re-tints or re-pads segments.
describe('segmented selection in the editor chrome', () => {
  it('leaves the segment look to the shared control', () => {
    expect(EDITOR_CHROME_CSS).not.toContain('.pb-segmented__segment {')
    expect(EDITOR_CHROME_CSS).not.toContain('.pb-segmented__segment--selected')
  })
})

// Kit Photo / Fit & crop / Rotate & flip sections (uikit/src/sandbox/
// inspector.tsx:103-166), Owner Must M60.
describe('photo inspector sections', () => {
  it('open expanded under their collapsible titles', () => {
    seed()
    render(
      <>
        <PhotoSection target={filled} />
        <FitCropSection target={filled} cropping={false} />
        <PhotoRotateSection target={filled} />
      </>,
    )
    for (const name of ['Photo', 'Fit & crop', 'Rotate & flip']) {
      expect(trigger(name).getAttribute('aria-expanded')).toBe('true')
    }
    expect(screen.getByTestId('inspector-photo').parentElement?.className).toBe(
      'px-4 pt-0.5 pb-3',
    )
    expect(screen.getByTestId('inspector-fit-crop').className).toBe(
      'fit-crop flex flex-col gap-3 px-4 pt-0.5 pb-3',
    )
    expect(screen.getByTestId('inspector-rotate').className).toBe(
      'px-4 pt-0.5 pb-3',
    )
    expect(screen.getByTestId('rotate-summary').className).toBe(
      'fit-crop-note mt-2',
    )
    expect(screen.getByTestId('photo-straighten').className).toContain(
      'fit-crop-slider fit-crop-slider--row mt-3',
    )
    expect(screen.getByTestId('crop-zoom').className).toContain(
      'fit-crop-slider fit-crop-slider--row',
    )
  })

  it('collapses Photo from its title and reopens it', () => {
    seed()
    render(<PhotoSection target={filled} />)
    fireEvent.click(trigger('Photo'))
    expect(trigger('Photo').getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger('Photo'))
    expect(trigger('Photo').getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByTestId('photo-remove')).toBeTruthy()
  })

  it('keeps crop mode from the Fit & crop and Rotate & flip titles only', () => {
    seed()
    render(
      <>
        <PhotoSection target={filled} />
        <FitCropSection target={filled} cropping={false} />
        <PhotoRotateSection target={filled} />
      </>,
    )
    const keeps = (name: string) =>
      trigger(name).closest('[data-crop-keep]') !== null
    expect(keeps('Fit & crop')).toBe(true)
    expect(keeps('Rotate & flip')).toBe(true)
    expect(keeps('Photo')).toBe(false)
  })

  it('shows the empty hint inside an open Photo section', () => {
    seed()
    render(<PhotoSection target={empty} />)
    expect(trigger('Photo').getAttribute('aria-expanded')).toBe('true')
    const hint = screen.getByTestId('inspector-photo-empty')
    expect([hint.tagName, hint.textContent]).toEqual([
      'DIV',
      'Empty — drag a photo',
    ])
  })
})
