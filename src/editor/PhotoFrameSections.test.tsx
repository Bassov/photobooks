import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { frameStylePresets } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { dispatchBookOp, resetBookStore } from './bookStore'
import { resetFrameSelection, setFrameSource } from './frameSelection'
import { Inspector } from './Inspector'
import { setActiveSpreadId } from './photoRootSession'
import { frameSectionSummaries } from './frameSectionSummaries'

const spread = makeSpread({
  id: 'spread-1',
  templateId: 'one-per-page',
  frames: [
    makeFrame({ id: 'f1', z: 1, assetId: 'a' }),
    makeFrame({ id: 'f2', z: 2 }),
    makeFrame({ id: 'f3', z: 3 }),
  ],
})

function frame(id: string) {
  const found = spread.frames.find((item) => item.id === id)
  if (found === undefined) {
    throw new Error(id)
  }
  return found
}

describe('frameSectionSummaries (kit collapsed rows)', () => {
  it('reads None, no Adjust summary and the bottom layer for a plain frame', () => {
    expect(frameSectionSummaries(spread, frame('f1'))).toEqual({
      adjust: undefined,
      style: 'None',
      arrange: 'z 1',
    })
  })

  it('counts the layer from the bottom of the stack', () => {
    expect(frameSectionSummaries(spread, frame('f3')).arrange).toBe('z 3')
  })

  it('names preset and custom frame styles', () => {
    const preset = frameStylePresets()[1]
    expect(preset).toBeDefined()
    const withPreset = { ...frame('f1'), frameStyleId: preset?.id }
    expect(frameSectionSummaries(spread, withPreset).style).toBe(preset?.name)
    const custom = { ...frame('f1'), frameStyleId: 'style-7' }
    expect(frameSectionSummaries(spread, custom).style).toBe('Style 7')
  })

  it('marks an adjusted photo as Edited and a zeroed one as not', () => {
    const adjust = { brightness: 0, contrast: 12, saturation: 0 }
    expect(
      frameSectionSummaries(spread, { ...frame('f1'), adjust }).adjust,
    ).toBe('Edited')
    const zero = { brightness: 0, contrast: 0, saturation: 0 }
    expect(
      frameSectionSummaries(spread, { ...frame('f1'), adjust: zero }).adjust,
    ).toBeUndefined()
  })
})

describe('PhotoFrameSections in the Inspector', () => {
  afterEach(() => {
    cleanup()
    resetFrameSelection()
    setActiveSpreadId(null)
    resetBookStore()
  })

  function seed() {
    resetBookStore({
      book: makeBook({ assets: { a: {} }, gallery: ['a'], spreads: [spread] }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<Inspector />)
    act(() => {
      setFrameSource({ spreadId: 'spread-1', frameId: 'f1' })
    })
  }

  const summary = (id: string) => screen.queryByTestId(`${id}-summary`)

  it('shows the Frame style and Arrange summaries from book state', () => {
    seed()
    expect(summary('inspector-style-disclosure')?.textContent).toBe('None')
    expect(summary('inspector-arrange-disclosure')?.textContent).toBe('z 1')
    expect(summary('inspector-adjust-disclosure')).toBeNull()
    expect(summary('inspector-geometry-disclosure')).toBeNull()

    act(() => {
      dispatchBookOp({
        type: 'reorderFrame',
        spreadId: 'spread-1',
        frameId: 'f1',
        move: 'forward',
      })
    })
    expect(summary('inspector-arrange-disclosure')?.textContent).toBe('z 2')

    const preset = frameStylePresets()[1]
    act(() => {
      dispatchBookOp({
        type: 'applyFrameStyle',
        spreadId: 'spread-1',
        frameId: 'f1',
        styleId: preset?.id,
      })
    })
    expect(summary('inspector-style-disclosure')?.textContent).toBe(
      preset?.name,
    )

    act(() => {
      dispatchBookOp({
        type: 'setFrameAdjust',
        spreadId: 'spread-1',
        frameId: 'f1',
        patch: { brightness: 20 },
      })
    })
    expect(summary('inspector-adjust-disclosure')?.textContent).toBe('Edited')
  })

  it('names triggers by title and describes them with the summary', () => {
    seed()
    const arrange = screen.getByRole('button', { name: 'Arrange' })
    const described = arrange.getAttribute('aria-describedby') ?? ''
    expect(document.getElementById(described)?.textContent).toBe('z 1')
    fireEvent.click(arrange)
    expect(summary('inspector-arrange-disclosure')).toBeNull()
    expect(arrange.hasAttribute('aria-describedby')).toBe(false)
  })

  it('lays Adjust and Frame style out on the kit Section rhythm', () => {
    seed()
    fireEvent.click(screen.getByRole('button', { name: 'Adjust' }))
    expect(screen.getByTestId('adjust').className).toBe(
      'flex flex-col gap-2 px-4 pt-0.5 pb-3',
    )
    for (const key of ['brightness', 'contrast', 'saturation']) {
      expect(screen.getByTestId(`adjust-${key}`).className).toContain(
        'fit-crop-slider fit-crop-slider--row',
      )
    }
    const reset = screen.getByTestId('adjust-reset')
    expect(reset.className).toContain('pb-button--ghost pb-button--sm w-full')
    expect(reset.hasAttribute('disabled')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Frame style' }))
    expect(screen.getByTestId('frame-style').className).toBe(
      'flex flex-col px-4 pt-0.5 pb-3',
    )
    expect(screen.getByTestId('style-new').className).toContain('mt-2 ')

    fireEvent.click(screen.getByRole('button', { name: 'Position & size' }))
    expect(screen.getByTestId('frame-rotation').className).toContain(
      'fit-crop-slider fit-crop-slider--row',
    )
  })

  it('opens the style sliders 24 px under the chips', () => {
    seed()
    act(() => {
      dispatchBookOp({
        type: 'applyFrameStyle',
        spreadId: 'spread-1',
        frameId: 'f1',
        styleId: frameStylePresets()[1]?.id,
      })
    })
    fireEvent.click(screen.getByRole('button', { name: 'Frame style' }))
    expect(screen.getByTestId('style-mat').parentElement?.className).toBe(
      'mt-6 flex flex-col gap-2',
    )
  })

  it('puts the lock on the Position & size title row while expanded', () => {
    seed()
    expect(screen.queryByTestId('frame-lock')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Position & size' }))
    const disclosure = screen.getByTestId('inspector-geometry-disclosure')
    const header = disclosure.querySelector('.pb-disclosure__header')
    expect(header).not.toBeNull()
    expect(within(header as HTMLElement).getByTestId('frame-lock')).toBeTruthy()
    expect(
      within(screen.getByTestId('inspector-geometry')).queryByTestId(
        'frame-lock',
      ),
    ).toBeNull()
  })
})
