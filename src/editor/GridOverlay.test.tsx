import { act, cleanup, render, screen } from '@testing-library/react'
import { Profiler } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import { dispatchBookOp, resetBookStore } from './bookStore'
import { GridOverlay } from './GridOverlay'
import { setGridVisible } from './gridView'
import { setSnapHint } from './snapHint'

function seed() {
  resetBookStore({
    book: makeBook({
      layoutGrid: {
        columns: 4,
        rows: 3,
        columnGutterMm: 4,
        rowGutterMm: 4,
        margins: { top: 10, bottom: 10, inside: 10, outside: 10 },
      },
      spreads: [
        makeSpread({ id: 's1' }),
        makeSpread({ id: 's2' }),
        makeSpread({ id: 's3' }),
      ],
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

describe('GridOverlay', () => {
  afterEach(() => {
    cleanup()
    setGridVisible(false)
    setSnapHint(null)
    resetBookStore()
  })

  it('renders nothing while the grid is hidden', () => {
    seed()
    render(<GridOverlay spreadId="s2" pxPerMm={1} />)
    expect(screen.queryByTestId('grid-overlay')).toBeNull()
  })

  it('draws a dashed gray content box and C×R bands per page, inert to pointers', () => {
    seed()
    setGridVisible(true)
    render(<GridOverlay spreadId="s2" pxPerMm={2} />)
    const svg = screen.getByTestId('grid-overlay')
    expect(svg.style.pointerEvents).toBe('none')
    const pages = screen.getAllByTestId('grid-overlay-page')
    expect(pages).toHaveLength(2)
    expect(screen.getAllByTestId('grid-overlay-column')).toHaveLength(8)
    expect(screen.getAllByTestId('grid-overlay-row')).toHaveLength(6)
    const box = screen.getAllByTestId('grid-overlay-content')[0]
    expect(box?.getAttribute('stroke-dasharray')).toBeTruthy()
    expect(box?.getAttribute('stroke-width')).toBe('1.5')
    expect(box?.style.stroke).toBe('var(--grid-line)')
    // Content box = page minus margins, scaled by pxPerMm.
    expect(box?.getAttribute('x')).toBe(String(10 * 2))
    expect(screen.getAllByTestId('grid-overlay-column')[0]?.style.fill).toBe(
      'var(--grid-fill)',
    )
    const row = screen.getAllByTestId('grid-overlay-row')[0]
    expect(row?.style.stroke).toBe('var(--grid-line)')
    expect(row?.style.strokeOpacity).toBe('0.5')
    expect(svg.outerHTML).not.toMatch(/#2f9e9a|teal|cyan|blue|#000/i)
  })

  it('appears and disappears with the visibility flag', () => {
    seed()
    render(<GridOverlay spreadId="s1" pxPerMm={1} />)
    act(() => {
      setGridVisible(true)
    })
    expect(screen.getByTestId('grid-overlay')).toBeTruthy()
    act(() => {
      setGridVisible(false)
    })
    expect(screen.queryByTestId('grid-overlay')).toBeNull()
  })

  it('shows the snap label only with the grid visible', () => {
    seed()
    render(<GridOverlay spreadId="s1" pxPerMm={1} />)
    act(() => {
      setSnapHint('snap · column 2')
    })
    expect(screen.queryByTestId('snap-label')).toBeNull()
    act(() => {
      setGridVisible(true)
    })
    const label = screen.getByTestId('snap-label')
    expect(label.textContent).toBe('snap · column 2')
    expect(label.style.pointerEvents).toBe('none')
    act(() => {
      setSnapHint(null)
    })
    expect(screen.queryByTestId('snap-label')).toBeNull()
  })

  it('shows a spread-scoped snap label only on that spread', () => {
    seed()
    act(() => {
      setGridVisible(true)
    })
    render(<GridOverlay spreadId="s1" pxPerMm={1} />)
    act(() => {
      setSnapHint('snap · row 1', 's2')
    })
    expect(screen.queryByTestId('snap-label')).toBeNull()
    act(() => {
      setSnapHint('snap · row 1', 's1')
    })
    expect(screen.getByTestId('snap-label').textContent).toBe('snap · row 1')
  })

  describe('masters', () => {
    function seedMaster() {
      resetBookStore({
        book: makeBook({
          spreads: [
            makeSpread({ id: 's1', parentId: 'pa' }),
            makeSpread({ id: 's2', parentId: 'pa' }),
            makeSpread({ id: 's3' }),
          ],
          parents: [
            {
              id: 'pa',
              name: 'Master A',
              frames: [],
              guides: [],
              layoutGrid: { columns: 3, rows: 1 },
            },
          ],
        }),
        sessionMeta: new Map(),
        importRunning: false,
        importExpectedCount: 0,
      })
    }

    it('master variant: always on, a cell per column × row on both pages', () => {
      seedMaster()
      render(<GridOverlay spreadId="pa" pxPerMm={1} variant="master" />)
      const svg = screen.getByTestId('grid-overlay')
      expect(svg.getAttribute('data-variant')).toBe('master')
      expect(screen.getAllByTestId('grid-overlay-page')).toHaveLength(2)
      expect(screen.getAllByTestId('grid-overlay-cell')).toHaveLength(6)
      expect(screen.getAllByTestId('grid-overlay-cell')[0]?.style.fill).toBe(
        'var(--grid-master-fill)',
      )
      expect(screen.queryByTestId('grid-overlay-row')).toBeNull()
      const content = screen.getAllByTestId('grid-overlay-content')[0]
      expect(content?.style.stroke).toBe('var(--grid-master-line)')
      expect(content?.getAttribute('stroke-width')).toBe('1')
      act(() => {
        dispatchBookOp({
          type: 'setSpreadGrid',
          spreadId: 'pa',
          patch: { columns: 5 },
        })
      })
      expect(screen.getAllByTestId('grid-overlay-cell')).toHaveLength(10)
    })

    it('a spread overlay inherits the master grid; None keeps the book grid', () => {
      seedMaster()
      setGridVisible(true)
      render(
        <>
          <GridOverlay spreadId="s2" pxPerMm={1} />
          <GridOverlay spreadId="s3" pxPerMm={1} />
        </>,
      )
      const [inherit, none] = screen.getAllByTestId('grid-overlay')
      expect(
        inherit?.querySelectorAll('[data-testid="grid-overlay-column"]'),
      ).toHaveLength(6)
      // The book grid is 2 columns; s3 is the last (single) page.
      expect(
        none?.querySelectorAll('[data-testid="grid-overlay-column"]'),
      ).toHaveLength(2)
    })

    it('a master grid edit re-renders only overlays of spreads using it', () => {
      seedMaster()
      setGridVisible(true)
      const commits = new Map<string, number>()
      const count = (id: string) => {
        commits.set(id, (commits.get(id) ?? 0) + 1)
      }
      render(
        <>
          {['s1', 's3'].map((id) => (
            <Profiler key={id} id={id} onRender={count}>
              <GridOverlay spreadId={id} pxPerMm={1} />
            </Profiler>
          ))}
        </>,
      )
      const before = new Map(commits)
      act(() => {
        dispatchBookOp({
          type: 'setSpreadGrid',
          spreadId: 'pa',
          patch: { columns: 4 },
        })
      })
      expect(commits.get('s1')).toBe((before.get('s1') ?? 0) + 1)
      expect(commits.get('s3')).toBe(before.get('s3'))
    })

    it('follows a new spread id', () => {
      seedMaster()
      setGridVisible(true)
      const { rerender } = render(<GridOverlay spreadId="s2" pxPerMm={1} />)
      expect(screen.getAllByTestId('grid-overlay-column')).toHaveLength(6)
      rerender(<GridOverlay spreadId="s3" pxPerMm={1} />)
      expect(screen.getAllByTestId('grid-overlay-column')).toHaveLength(2)
    })

    it('renders nothing for an id that is neither a spread nor a parent', () => {
      seedMaster()
      render(<GridOverlay spreadId="ghost" pxPerMm={1} variant="master" />)
      expect(screen.queryByTestId('grid-overlay')).toBeNull()
    })
  })
})
