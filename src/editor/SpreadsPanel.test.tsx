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

  /** Items are 96px tall + 4px gap → 100px pitch, stacked from 0. */
  function stubLayout(): void {
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(
      function (this: HTMLElement) {
        const siblings = Array.from(
          this.parentElement?.querySelectorAll('[data-item]') ?? [],
        )
        return siblings.indexOf(this) * 100
      },
    )
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(96)
  }

  const item = (id: string | undefined) =>
    screen.getByTestId(`spread-list-item-${id ?? ''}`)

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
    expect(fireEvent.keyDown(first, { key: 'ArrowDown' })).toBe(true)
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
    stubLayout()
    const [a, b, c] = getSpreadIdsSnapshot()
    render(<SpreadsPanel />)
    expect(screen.queryByTestId('spread-drop-line')).toBeNull()
    expect(item(a).style.transform).toBe('')

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
    expect(item(a).style.transform).toBe('translateY(100px)')
    expect(item(b).style.transform).toBe('translateY(100px)')
    expect(item(c).style.transform).toBe('translateY(0px)')
    expect(screen.getByTestId('spread-drop-line').style.transform).toBe(
      'translateY(0px)',
    )

    fireDrag('dragOver', list, dt, 90)
    expect(item(a).style.transform).toBe('translateY(0px)')
    expect(item(b).style.transform).toBe('translateY(100px)')
    expect(screen.getByTestId('spread-drop-line').style.transform).toBe(
      'translateY(100px)',
    )

    expect(fireDrag('drop', list, dt)).toBe(false)
    expect(getSpreadIdsSnapshot()).toEqual([a, c, b])
    expect(screen.queryByTestId('spread-drop-line')).toBeNull()
    expect(item(a).style.transform).toBe('')
    expect(item(c).hasAttribute('data-dragging')).toBe(false)
  })

  it('places the line below the target when dragging down', () => {
    stubLayout()
    const [a, , c] = getSpreadIdsSnapshot()
    render(<SpreadsPanel />)
    const dt = transfer()
    fireDrag('dragStart', item(a), dt)
    fireDrag('dragOver', screen.getByTestId('spreads-list'), dt, 290)
    expect(screen.getByTestId('spread-drop-line').style.transform).toBe(
      'translateY(300px)',
    )
    expect(item(c).style.transform).toBe('translateY(-100px)')
  })

  it('adds the list scroll offset to the pointer position', () => {
    stubLayout()
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
    stubLayout()
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
    stubLayout()
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
    stubLayout()
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
