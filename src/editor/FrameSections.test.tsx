import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore, undoBook } from './bookStore'
import {
  ArrangeSection,
  DeleteFrameButton,
  GeometrySection,
} from './FrameSections'
import { enterCropMode, exitCropMode } from './cropMode'
import { resetFrameSelection, setFrameSource } from './frameSelection'
import { Inspector } from './Inspector'
import { setActiveSpreadId } from './photoRootSession'

function seed(locked = false) {
  resetBookStore({
    book: makeBook({
      assets: { a: {} },
      gallery: ['a'],
      spreads: [
        makeSpread({
          id: 'spread-1',
          templateId: 'one-per-page',
          frames: [
            makeFrame({
              id: 'f1',
              z: 1,
              assetId: 'a',
              rect: { x: 10, y: 20, width: 50, height: 40 },
              ...(locked ? { locked: true } : {}),
            }),
            makeFrame({ id: 'f2', z: 2 }),
            makeFrame({ id: 'f3', z: 3 }),
          ],
        }),
      ],
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

function select(frameId = 'f1') {
  act(() => {
    setFrameSource({ spreadId: 'spread-1', frameId })
  })
}

function frames() {
  return getBookStoreSnapshot().book.spreads[0]?.frames ?? []
}

function field(name: string) {
  return screen.getByRole<HTMLInputElement>('textbox', { name })
}

function type(name: string, value: string) {
  const input = field(name)
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

/** Section headings / controls of the Frame tab in document order. */
function order() {
  const panel = screen.getByTestId('inspector-panel-frame')
  return [
    'inspector-geometry',
    'inspector-fit-crop',
    'inspector-arrange',
    'frame-delete',
  ].filter((id) => within(panel).queryByTestId(id) !== null)
}

describe('Inspector frame sections', () => {
  afterEach(() => {
    cleanup()
    exitCropMode()
    resetFrameSelection()
    setActiveSpreadId(null)
    resetBookStore()
  })

  it('shows no frame sections with nothing selected', () => {
    seed()
    render(<Inspector />)
    expect(order()).toEqual([])
    expect(screen.queryByTestId('frame-lock')).toBeNull()
  })

  it('orders Geometry, Crop, Arrange, Delete for a selected photo frame', () => {
    seed()
    render(<Inspector />)
    select()
    expect(order()).toEqual([
      'inspector-geometry',
      'inspector-fit-crop',
      'inspector-arrange',
      'frame-delete',
    ])
    const geometry = screen.getByTestId('inspector-geometry')
    const arrange = screen.getByTestId('inspector-arrange')
    expect(
      geometry.compareDocumentPosition(
        screen.getByTestId('inspector-fit-crop'),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      arrange.compareDocumentPosition(screen.getByTestId('frame-delete')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('omits Crop for an empty frame and never renders Align', () => {
    seed()
    render(<Inspector />)
    select('f2')
    expect(order()).toEqual([
      'inspector-geometry',
      'inspector-arrange',
      'frame-delete',
    ])
    expect(screen.queryByText(/align/i)).toBeNull()
  })

  it('keeps the sections in crop mode', () => {
    seed()
    render(<Inspector />)
    act(() => {
      enterCropMode('spread-1', 'f1')
    })
    expect(order()).toContain('inspector-geometry')
    expect(order()).toContain('frame-delete')
  })

  it('shows the frame geometry in mm', () => {
    seed()
    render(<Inspector />)
    select()
    expect(field('X').value).toBe('10')
    expect(field('Y').value).toBe('20')
    expect(field('Width').value).toBe('50')
    expect(field('Height').value).toBe('40')
    expect(field('Rotation').value).toBe('0')
  })

  it('typing X / Y moves, W / H resizes, in one undoable op each', () => {
    seed()
    render(<Inspector />)
    select()
    type('Width', '80')
    expect(frames()[0]?.rect).toEqual({ x: 10, y: 20, width: 80, height: 40 })
    type('Height', '25')
    expect(frames()[0]?.rect.height).toBe(25)
    type('X', '15')
    type('Y', '5')
    expect(frames()[0]?.rect).toEqual({ x: 15, y: 5, width: 80, height: 25 })
    expect(getBookStoreSnapshot().book.spreads[0]?.templateId).toBeUndefined()
  })

  it('clamps W and H to the 5 mm minimum', () => {
    seed()
    render(<Inspector />)
    select()
    type('Width', '1')
    type('Height', '2')
    expect(frames()[0]?.rect.width).toBe(5)
    expect(frames()[0]?.rect.height).toBe(5)
  })

  it('rotates through the degree field, signed in the UI', () => {
    seed()
    render(<Inspector />)
    select()
    type('Rotation', '-90')
    expect(frames()[0]?.rotationDeg).toBe(270)
    expect(field('Rotation').value).toBe('-90')
  })

  it('rotates through the slider', () => {
    seed()
    render(<Inspector />)
    select()
    const slider = within(screen.getByTestId('frame-rotation')).getByRole(
      'slider',
    )
    fireEvent.change(slider, { target: { value: '45' } })
    expect(frames()[0]?.rotationDeg).toBe(45)
  })

  it('disables geometry and rotation when locked; unlock restores them', () => {
    seed(true)
    render(<Inspector />)
    select()
    const lock = screen.getByTestId('frame-lock')
    expect(lock.getAttribute('aria-label')).toBe('Unlock frame')
    for (const name of ['X', 'Y', 'Width', 'Height', 'Rotation']) {
      expect(field(name).disabled).toBe(true)
    }
    expect(
      within(screen.getByTestId('frame-rotation')).getByRole<HTMLInputElement>(
        'slider',
      ).disabled,
    ).toBe(true)

    fireEvent.click(lock)
    expect(frames()[0]?.locked).toBeUndefined()
    expect(field('Width').disabled).toBe(false)
    expect(screen.getByTestId('frame-lock').getAttribute('aria-label')).toBe(
      'Lock frame',
    )

    fireEvent.click(screen.getByTestId('frame-lock'))
    expect(frames()[0]?.locked).toBe(true)
  })

  it('arranges: the layer label follows the z buttons', () => {
    seed()
    render(<Inspector />)
    select()
    const label = () => screen.getByTestId('frame-layer').textContent
    expect(label()).toBe('layer 1 of 3')
    fireEvent.click(screen.getByTestId('z-front'))
    expect(label()).toBe('layer 3 of 3')
    fireEvent.click(screen.getByTestId('z-backward'))
    expect(label()).toBe('layer 2 of 3')
    fireEvent.click(screen.getByTestId('z-back'))
    expect(label()).toBe('layer 1 of 3')
    fireEvent.click(screen.getByTestId('z-forward'))
    expect(label()).toBe('layer 2 of 3')
  })

  it('deletes the frame and leaves the template', () => {
    seed()
    render(<Inspector />)
    select()
    fireEvent.click(screen.getByTestId('frame-delete'))
    expect(frames().map((f) => f.id)).toEqual(['f2', 'f3'])
    expect(getBookStoreSnapshot().book.spreads[0]?.templateId).toBeUndefined()
    expect(screen.queryByTestId('inspector-geometry')).toBeNull()
  })

  it('shows 180° as 180 and clamps the degree field to ±180', () => {
    seed()
    render(<Inspector />)
    select()
    type('Rotation', '180')
    expect(frames()[0]?.rotationDeg).toBe(180)
    expect(field('Rotation').value).toBe('180')
    type('Rotation', '500')
    expect(frames()[0]?.rotationDeg).toBe(180)
    type('Rotation', '-500')
    // −180° and 180° are the same stored angle.
    expect(frames()[0]?.rotationDeg).toBe(180)
    expect(field('Rotation').value).toBe('180')
  })

  it('ignores an emptied field', () => {
    seed()
    render(<Inspector />)
    select()
    type('Width', '')
    expect(frames()[0]?.rect.width).toBe(50)
  })

  it('shows the slider value in degrees and fills the track to it', () => {
    seed()
    render(<Inspector />)
    select()
    const slider = within(screen.getByTestId('frame-rotation'))
    fireEvent.change(slider.getByRole('slider'), { target: { value: '90' } })
    expect(
      screen.getByTestId('frame-rotation').querySelector('output')?.textContent,
    ).toBe('90°')
    const fill = screen
      .getByTestId('frame-rotation')
      .querySelector<HTMLElement>('.fit-crop-fill')
    expect(fill?.style.width).toBe('75%')
  })

  it('folds a slider drag into one undo step; the field is one step per edit', () => {
    seed()
    render(<Inspector />)
    select()
    const slider = within(screen.getByTestId('frame-rotation')).getByRole(
      'slider',
    )
    fireEvent.change(slider, { target: { value: '10' } })
    fireEvent.change(slider, { target: { value: '20' } })
    fireEvent.change(slider, { target: { value: '30' } })
    act(() => {
      undoBook()
    })
    expect(frames()[0]?.rotationDeg).toBeUndefined()

    type('Rotation', '10')
    type('Rotation', '20')
    act(() => {
      undoBook()
    })
    expect(frames()[0]?.rotationDeg).toBe(10)
  })

  it('mutes the layer label', () => {
    seed()
    render(<Inspector />)
    select()
    expect(screen.getByTestId('frame-layer').className).toContain('frame-layer')
  })

  it('renders nothing for a target whose spread or frame is gone', () => {
    seed()
    for (const target of [
      { spreadId: 'nope', frameId: 'f1' },
      { spreadId: 'spread-1', frameId: 'nope' },
    ]) {
      const { container } = render(
        <>
          <GeometrySection target={target} />
          <ArrangeSection target={target} />
          <DeleteFrameButton target={target} />
        </>,
      )
      expect(container.innerHTML).toBe('')
      cleanup()
    }
  })

  it('edits the targeted frame, not the first or another spread', () => {
    resetBookStore({
      book: makeBook({
        spreads: [
          makeSpread({ id: 's1', frames: [makeFrame({ id: 'f1', z: 1 })] }),
          makeSpread({
            id: 's2',
            frames: [
              makeFrame({ id: 'f1', z: 1 }),
              makeFrame({ id: 'f2', z: 2 }),
            ],
          }),
        ],
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<ArrangeSection target={{ spreadId: 's2', frameId: 'f2' }} />)
    expect(screen.getByTestId('frame-layer').textContent).toBe('layer 2 of 2')
    cleanup()
    render(<GeometrySection target={{ spreadId: 's2', frameId: 'f2' }} />)
    fireEvent.click(screen.getByTestId('frame-lock'))
    const spreads = getBookStoreSnapshot().book.spreads
    expect(spreads[1]?.frames.map((f) => f.locked)).toEqual([undefined, true])
    expect(spreads[0]?.frames[0]?.locked).toBeUndefined()
  })
})
