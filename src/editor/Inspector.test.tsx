import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  makeBook,
  makeBookWithAsset,
  makeFrame,
  makeSpread,
} from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import {
  enterCropMode,
  exitCropMode,
  getCropTarget,
  getCropTargetKey,
} from './cropMode'
import { resetFrameSelection, setFrameSource } from './frameSelection'
import { Inspector } from './Inspector'
import { setActiveSpreadId } from './photoRootSession'

// Pass-through so a test can hand the panel a stale crop target.
vi.mock('./cropMode', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./cropMode')>()
  return {
    ...actual,
    getCropTarget: vi.fn(actual.getCropTarget),
    getCropTargetKey: vi.fn(actual.getCropTargetKey),
  }
})

const realCrop =
  await vi.importActual<typeof import('./cropMode')>('./cropMode')

function staleCropTarget(spreadId: string, frameId: string) {
  vi.mocked(getCropTargetKey).mockImplementation(() => `${spreadId}/${frameId}`)
  vi.mocked(getCropTarget).mockImplementation(() => ({ spreadId, frameId }))
}

function seedBook(book: ReturnType<typeof makeBook>) {
  resetBookStore({
    book,
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

function crop() {
  return getBookStoreSnapshot().book.spreads[0]?.frames[0]?.crop
}

function seed() {
  resetBookStore({
    book: makeBookWithAsset('a'),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

describe('Inspector', () => {
  afterEach(() => {
    vi.mocked(getCropTarget).mockImplementation(realCrop.getCropTarget)
    vi.mocked(getCropTargetKey).mockImplementation(realCrop.getCropTargetKey)
    cleanup()
    exitCropMode()
    resetFrameSelection()
    setActiveSpreadId(null)
    resetBookStore()
  })

  it('shows the empty hint and no crop section with nothing selected', () => {
    render(<Inspector />)
    const panel = screen.getByTestId('inspector-panel')
    expect(panel.getAttribute('data-inspector-view')).toBe('empty')
    expect(screen.getByTestId('inspector-empty').textContent).toMatch(
      /Select a spread or a photo/,
    )
    expect(screen.queryByTestId('inspector-fit-crop')).toBeNull()
  })

  it('shows spread properties for the active spread, Esc returns to empty', () => {
    seed()
    render(<Inspector />)
    act(() => {
      setActiveSpreadId('spread-1')
    })
    const panel = screen.getByTestId('inspector-panel')
    expect(panel.getAttribute('data-inspector-view')).toBe('spread')
    expect(screen.getByTestId('inspector-name').textContent).toBe('Cover')
    expect(screen.getByText('Frames')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(panel.getAttribute('data-inspector-view')).toBe('empty')
  })

  it('shows photo identity for a selected frame', () => {
    seed()
    render(<Inspector />)
    act(() => {
      setFrameSource({ spreadId: 'spread-1', frameId: 'frame-1' })
    })
    expect(
      screen.getByTestId('inspector-panel').getAttribute('data-inspector-view'),
    ).toBe('frame')
    expect(screen.getByTestId('inspector-name').textContent).toBe('a')
    expect(screen.getByText('Used')).toBeTruthy()
  })

  it('collapses through the header button', () => {
    const onCollapse = vi.fn()
    render(<Inspector onCollapse={onCollapse} />)
    fireEvent.click(screen.getByTestId('panel-collapse-right'))
    expect(onCollapse).toHaveBeenCalled()
  })

  it('zooms via the slider and resets to cover', () => {
    seed()
    render(<Inspector />)
    act(() => {
      enterCropMode('spread-1', 'frame-1')
    })
    const reset = screen.getByTestId<HTMLButtonElement>('crop-reset')
    expect(reset.disabled).toBe(true)

    fireEvent.change(screen.getByTestId('crop-zoom'), {
      target: { value: '2' },
    })
    expect(crop()?.zoom).toBe(2)
    expect(reset.disabled).toBe(false)

    fireEvent.click(reset)
    expect(crop()).toEqual({ zoom: 1, center: { x: 0.5, y: 0.5 } })
  })

  it('shows no crop section when the target frame has no photo', () => {
    seed()
    render(<Inspector />)
    act(() => {
      enterCropMode('spread-1', 'missing')
    })
    expect(screen.queryByTestId('inspector-fit-crop')).toBeNull()
  })

  it('shows no crop section when the target spread is gone', () => {
    seed()
    render(<Inspector />)
    act(() => {
      enterCropMode('gone', 'frame-1')
    })
    expect(screen.queryByTestId('inspector-fit-crop')).toBeNull()
  })

  it.each([
    ['x', { x: 0.3, y: 0.5 }],
    ['y', { x: 0.5, y: 0.3 }],
  ])('enables reset when only the %s center is off cover', (_axis, center) => {
    const base = makeBookWithAsset('a')
    const [spread] = base.spreads
    const book = {
      ...base,
      spreads: [
        {
          ...spread,
          frames: spread?.frames.map((item) => ({
            ...item,
            crop: { zoom: 1, center },
          })),
        },
      ],
    } as typeof base
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<Inspector />)
    act(() => {
      enterCropMode('spread-1', 'frame-1')
    })
    expect(screen.getByTestId<HTMLButtonElement>('crop-reset').disabled).toBe(
      false,
    )
  })

  it('drops the section when crop mode ends', () => {
    seed()
    render(<Inspector />)
    act(() => {
      enterCropMode('spread-1', 'frame-1')
    })
    expect(screen.getByTestId('inspector-fit-crop')).toBeTruthy()
    act(() => {
      exitCropMode()
    })
    expect(screen.queryByTestId('inspector-fit-crop')).toBeNull()
  })

  it.each([
    ['frame', 'spread-1', 'missing'],
    ['spread', 'gone', 'frame-1'],
  ])('ignores a stale crop target whose %s is gone', (_what, spreadId, id) => {
    seed()
    staleCropTarget(spreadId, id)
    render(<Inspector />)
    expect(screen.getByTestId('inspector-panel')).toBeTruthy()
    expect(screen.queryByTestId('inspector-fit-crop')).toBeNull()
  })

  it('crops the targeted frame, not the first one', () => {
    const zoomed = { zoom: 2, center: { x: 0.5, y: 0.5 } }
    seedBook(
      makeBook({
        assets: { a: {} },
        gallery: ['a'],
        spreads: [
          makeSpread({
            id: 'spread-1',
            frames: [makeFrame({ id: 'frame-1', assetId: 'a' })],
          }),
          makeSpread({
            id: 'spread-2',
            frames: [
              makeFrame({ id: 'frame-1', assetId: 'a' }),
              makeFrame({ id: 'frame-2', assetId: 'a', crop: zoomed }),
            ],
          }),
        ],
      }),
    )
    render(<Inspector />)
    act(() => {
      enterCropMode('spread-2', 'frame-2')
    })
    expect(
      screen.getByTestId<HTMLInputElement>('crop-zoom').valueAsNumber,
    ).toBe(2)
    expect(screen.getByTestId<HTMLButtonElement>('crop-reset').disabled).toBe(
      false,
    )
  })

  it('names an empty frame and counts uses of a placed photo', () => {
    seedBook(
      makeBook({
        assets: { a: {} },
        gallery: ['a'],
        spreads: [
          makeSpread({
            id: 'spread-1',
            frames: [
              makeFrame({ id: 'frame-1', assetId: 'a' }),
              makeFrame({ id: 'frame-2' }),
            ],
          }),
        ],
      }),
    )
    render(<Inspector />)
    act(() => {
      setFrameSource({ spreadId: 'spread-1', frameId: 'frame-2' })
    })
    expect(screen.getByTestId('inspector-name').textContent).toBe('Empty frame')
    expect(screen.getByText('Photo')).toBeTruthy()
    expect(screen.queryByText('Used')).toBeNull()

    act(() => {
      setFrameSource({ spreadId: 'spread-1', frameId: 'frame-1' })
    })
    expect(screen.getByText('Used').nextElementSibling?.textContent).toBe('1×')
  })

  it('titles the empty panel without meta', () => {
    render(<Inspector />)
    const name = screen.getByTestId('inspector-name')
    expect(name.textContent).toBe('Inspector')
    expect(name.nextElementSibling).toBeNull()
  })
})
