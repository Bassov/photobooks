import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  dispatchBookOp,
  getSpreadIdsSnapshot,
  resetBookStore,
} from './bookStore'
import {
  getActiveSpreadId,
  resetActiveSpreadIdForTests,
  setActiveSpreadId,
} from './photoRootSession'
import { SpreadsPanel } from './SpreadsPanel'
import { spreadsRowPx } from './spreadsPanel.test-helpers'

describe('SpreadsPanel', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetActiveSpreadIdForTests()
  })

  it('lists spreads and add-spread appends one', () => {
    const before = getSpreadIdsSnapshot().length
    render(<SpreadsPanel />)
    expect(screen.getByTestId('spreads-panel')).toBeTruthy()
    expect(screen.getByTestId('spreads-list')).toBeTruthy()
    fireEvent.click(screen.getByTestId('add-spread'))
    expect(getSpreadIdsSnapshot().length).toBe(before + 1)
  })

  it('duplicates, adds after and deletes the selected spread by keyboard', () => {
    render(<SpreadsPanel />)
    const [first, second] = getSpreadIdsSnapshot()
    const row = screen.getByTestId(`spread-list-item-${first ?? ''}`)
    fireEvent.keyDown(row, { key: 'd', ctrlKey: true })
    const afterDup = getSpreadIdsSnapshot()
    expect(afterDup[0]).toBe(first)
    expect(afterDup[2]).toBe(second)
    const copy = afterDup[1] ?? ''
    expect(getActiveSpreadId()).toBe(copy)

    fireEvent.keyDown(screen.getByTestId(`spread-list-item-${copy}`), {
      key: 'Enter',
      ctrlKey: true,
    })
    expect(getSpreadIdsSnapshot()).toHaveLength(afterDup.length + 1)
    expect(getSpreadIdsSnapshot().indexOf(copy)).toBe(1)

    // Add-after selected the new spread; Delete acts on the selection.
    const added = getActiveSpreadId() ?? ''
    expect(added).not.toBe(copy)
    const total = getSpreadIdsSnapshot().length
    fireEvent.keyDown(screen.getByTestId(`spread-list-item-${added}`), {
      key: 'Delete',
    })
    expect(getSpreadIdsSnapshot()).toHaveLength(total - 1)
    expect(getSpreadIdsSnapshot()).not.toContain(added)
    expect(getActiveSpreadId()).toBe(second)
  })

  it('keeps the last spread and renders inert thumbnails', () => {
    const [only] = getSpreadIdsSnapshot()
    for (const id of getSpreadIdsSnapshot().slice(1)) {
      dispatchBookOp({ type: 'removeSpread', spreadId: id })
    }
    render(<SpreadsPanel />)
    fireEvent.keyDown(screen.getByTestId(`spread-list-item-${only ?? ''}`), {
      key: 'Delete',
    })
    expect(getSpreadIdsSnapshot()).toEqual([only])
    expect(screen.queryByTestId('spread-view')).toBeNull()
    expect(
      screen
        .getByTestId(`spread-list-item-${only ?? ''}`)
        .querySelector('.spread-view--thumb'),
    ).not.toBeNull()
  })

  it('marks the active spread selected and first-spread data-first', () => {
    const ids = getSpreadIdsSnapshot()
    expect(ids.length).toBeGreaterThan(1)
    const first = ids.at(0) ?? ''
    const target = ids.at(1) ?? ''
    setActiveSpreadId(target)
    render(<SpreadsPanel />)
    expect(
      screen
        .getByTestId(`spread-list-item-${first}`)
        .getAttribute('data-first'),
    ).toBe('true')
    expect(
      screen
        .getByTestId(`spread-list-item-${target}`)
        .getAttribute('data-first'),
    ).toBe('false')
    const btn = screen.getByTestId(`spread-list-item-${target}`)
    expect(btn.getAttribute('aria-selected')).toBe('true')
    expect(btn.querySelector('[data-label]')?.className).toContain(
      'font-semibold',
    )
    expect(
      screen
        .getByTestId(`spread-list-item-${first}`)
        .querySelector('[data-label]')?.className,
    ).toContain('font-normal')
    fireEvent.click(screen.getByTestId(`spread-list-item-${first}`))
    expect(getActiveSpreadId()).toBe(first)
  })
})

describe('SpreadsPanel reorder', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetActiveSpreadIdForTests()
    vi.restoreAllMocks()
  })

  const MIME = 'application/x-photobooks-spread'

  function transfer() {
    return {
      types: [] as string[],
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(function (this: { types: string[] }, type: string) {
        this.types.push(type)
      }),
    }
  }

  /**
   * jsdom has no DragEvent: build the event by hand so `dataTransfer` stays
   * this object and `clientY` reaches the React handler. Returns false when
   * the handler called preventDefault.
   */
  function fireDrag(
    type: 'dragStart' | 'dragOver' | 'drop' | 'dragEnd',
    target: Element,
    dataTransfer: ReturnType<typeof transfer> = transfer(),
    clientY = 0,
  ): boolean {
    const event = createEvent[type](target)
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
    Object.defineProperty(event, 'clientY', { value: clientY })
    return fireEvent(target, event)
  }

  const item = (id: string | undefined) =>
    screen.getByTestId(`spread-list-item-${id ?? ''}`)

  /** The fixed-stride row that carries the drag shift; pitch is the kit row stride. */
  const shift = (rows: number): string =>
    `translateY(${String(Number((rows * spreadsRowPx()).toFixed(2)))}px)`
  const row = (id: string | undefined): HTMLElement =>
    item(id).parentElement ?? item(id)

  it('Alt+ArrowDown / Alt+ArrowUp move the focused spread and keep focus', () => {
    const [a, b] = getSpreadIdsSnapshot()
    render(<SpreadsPanel />)
    expect(fireEvent.keyDown(item(a), { key: 'ArrowDown', altKey: true })).toBe(
      false,
    )
    expect(getSpreadIdsSnapshot().slice(0, 2)).toEqual([b, a])
    expect(document.activeElement).toBe(item(a))
    expect(fireEvent.keyDown(item(a), { key: 'ArrowUp', altKey: true })).toBe(
      false,
    )
    expect(getSpreadIdsSnapshot().slice(0, 2)).toEqual([a, b])
    expect(document.activeElement).toBe(item(a))
  })

  it('leaves plain arrows, other keys and out-of-range moves alone', () => {
    const before = getSpreadIdsSnapshot()
    render(<SpreadsPanel />)
    const first = item(before[0])
    const last = item(before.at(-1))
    expect(fireEvent.keyDown(first, { key: 'ArrowLeft' })).toBe(true)
    expect(fireEvent.keyDown(first, { key: 'ArrowUp', altKey: true })).toBe(
      true,
    )
    expect(fireEvent.keyDown(last, { key: 'ArrowDown', altKey: true })).toBe(
      true,
    )
    expect(fireEvent.keyDown(first, { key: 'Enter', altKey: true })).toBe(true)
    expect(getSpreadIdsSnapshot()).toEqual(before)
  })

  it('dragging shows the target by transform and an insertion line, then drops as one move', () => {
    const [a, b, c] = getSpreadIdsSnapshot()
    render(<SpreadsPanel />)
    // The reveal effect may have scrolled the list to the active row.
    screen.getByTestId('spreads-list').scrollTop = 0
    expect(screen.queryByTestId('spread-drop-line')).toBeNull()
    expect(row(a).style.transform).toBe('')

    const dt = transfer()
    fireDrag('dragStart', item(c), dt)
    expect(dt.setData).toHaveBeenCalledWith(MIME, '2')
    expect(dt.effectAllowed).toBe('move')
    expect(item(c).getAttribute('data-dragging')).toBe('true')
    expect(item(a).hasAttribute('data-dragging')).toBe(false)
    expect(screen.queryByTestId('spread-drop-line')).toBeNull()

    const list = screen.getByTestId('spreads-list')
    expect(fireDrag('dragOver', list, dt, 10)).toBe(false)
    expect(dt.dropEffect).toBe('move')
    expect(row(a).style.transform).toBe(shift(1))
    expect(row(b).style.transform).toBe(shift(1))
    expect(row(c).style.transform).toBe('translateY(0px)')
    expect(screen.getByTestId('spread-drop-line').style.transform).toBe(
      'translateY(0px)',
    )

    fireDrag('dragOver', list, dt, spreadsRowPx() * 0.9)
    expect(row(a).style.transform).toBe('translateY(0px)')
    expect(row(b).style.transform).toBe(shift(1))
    expect(screen.getByTestId('spread-drop-line').style.transform).toBe(
      shift(1),
    )

    expect(fireDrag('drop', list, dt)).toBe(false)
    expect(getSpreadIdsSnapshot()).toEqual([a, c, b])
    expect(screen.queryByTestId('spread-drop-line')).toBeNull()
    expect(row(a).style.transform).toBe('')
    expect(item(c).hasAttribute('data-dragging')).toBe(false)
  })

  it('places the line below the target when dragging down', () => {
    const [a, , c] = getSpreadIdsSnapshot()
    render(<SpreadsPanel />)
    const dt = transfer()
    fireDrag('dragStart', item(a), dt)
    fireDrag(
      'dragOver',
      screen.getByTestId('spreads-list'),
      dt,
      spreadsRowPx() * 2.8,
    )
    const lineY = /translateY\((.+)px\)/.exec(
      screen.getByTestId('spread-drop-line').style.transform,
    )?.[1]
    expect(Number(lineY)).toBeCloseTo(3 * spreadsRowPx(), 2)
    expect(row(c).style.transform).toBe(shift(-1))
  })

  it('adds the list scroll offset to the pointer position', () => {
    const [a, b, c] = getSpreadIdsSnapshot()
    render(<SpreadsPanel />)
    const list = screen.getByTestId('spreads-list')
    list.scrollTop = 100
    const dt = transfer()
    fireDrag('dragStart', item(c), dt)
    fireDrag('dragOver', list, dt, 10)
    fireDrag('drop', list, dt)
    expect(getSpreadIdsSnapshot()).toEqual([a, c, b])
  })

  it('dragend without a drop clears the drag and keeps the order', () => {
    const ids = getSpreadIdsSnapshot()
    render(<SpreadsPanel />)
    const list = screen.getByTestId('spreads-list')
    const dt = transfer()
    fireDrag('dragStart', item(ids.at(-1)), dt)
    fireDrag('dragOver', list, dt, 10)
    expect(screen.getByTestId('spread-drop-line')).toBeTruthy()
    fireDrag('dragEnd', list, dt)
    expect(screen.queryByTestId('spread-drop-line')).toBeNull()
    expect(item(ids[0]).style.transform).toBe('')
    expect(getSpreadIdsSnapshot()).toEqual(ids)
  })

  it('dropping in place keeps the order', () => {
    const ids = getSpreadIdsSnapshot()
    render(<SpreadsPanel />)
    const list = screen.getByTestId('spreads-list')
    const dt = transfer()
    fireDrag('dragStart', item(ids[1]), dt)
    fireDrag('dragOver', list, dt, 100)
    expect(screen.queryByTestId('spread-drop-line')).toBeNull()
    fireDrag('drop', list, dt)
    expect(getSpreadIdsSnapshot()).toEqual(ids)
  })

  it('ignores drags that did not start in the list or carry another type', () => {
    const ids = getSpreadIdsSnapshot()
    render(<SpreadsPanel />)
    const list = screen.getByTestId('spreads-list')
    expect(fireDrag('dragOver', list)).toBe(true)
    expect(fireDrag('drop', list)).toBe(true)
    fireDrag('dragStart', list, transfer())
    expect(fireDrag('dragOver', list, transfer(), 250)).toBe(true)
    const own = transfer()
    fireDrag('dragStart', item(ids[0]), own)
    expect(own.setData).toHaveBeenCalledTimes(1)
    expect(fireDrag('dragOver', list, transfer(), 250)).toBe(true)
    expect(screen.queryByTestId('spread-drop-line')).toBeNull()
    expect(getSpreadIdsSnapshot()).toEqual(ids)
  })

  it('only offers dragging when there is more than one spread', () => {
    const ids = getSpreadIdsSnapshot()
    render(<SpreadsPanel />)
    expect(item(ids[0]).getAttribute('draggable')).toBe('true')
    expect(item(ids[0]).getAttribute('aria-keyshortcuts')).toBe(
      'Alt+ArrowUp Alt+ArrowDown',
    )
    cleanup()
    for (const id of ids.slice(1)) {
      dispatchBookOp({ type: 'removeSpread', spreadId: id })
    }
    render(<SpreadsPanel />)
    expect(item(ids[0]).getAttribute('draggable')).toBe('false')
    expect(item(ids[0]).hasAttribute('aria-keyshortcuts')).toBe(false)
    expect(
      fireEvent.keyDown(item(ids[0]), { key: 'ArrowDown', altKey: true }),
    ).toBe(true)
  })
})
