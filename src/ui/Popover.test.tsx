import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Button } from './Button'
import { ListSelect } from './ListSelect'
import { Menu, MenuItem, MenuPopover, MenuTrigger } from './Menu'
import { Popover, PopoverDialog, PopoverTrigger } from './Popover'
import { useScaledGaps } from './scaledOverlay'
import { Tooltip, TooltipTrigger } from './Tooltip'
import { applyUiScale, setUiScaleChoice } from './uiScale'

describe('Popover', () => {
  afterEach(() => {
    cleanup()
  })

  it('opens from a trigger', async () => {
    render(
      <PopoverTrigger>
        <Button>More</Button>
        <Popover>
          <PopoverDialog>
            <p>Popover body</p>
          </PopoverDialog>
        </Popover>
      </PopoverTrigger>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(await screen.findByText('Popover body')).toBeTruthy()
  })
})

// Interface size §4: the positioned element stays unzoomed, its one content
// root (.pb-overlay-box) zooms and takes the consumer classes; gaps × s.
describe('positioned overlays at interface scale', () => {
  const start = { w: window.innerWidth, h: window.innerHeight }
  const setWindow = (w: number, h: number) => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: w,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: h,
    })
  }

  afterEach(() => {
    cleanup()
    setWindow(start.w, start.h)
    localStorage.clear()
    applyUiScale()()
  })

  it.each([
    [1, { offset: 4, crossOffset: 0, containerPadding: 12 }],
    [1.25, { offset: 5, crossOffset: 0, containerPadding: 15 }],
    [1.5, { offset: 6, crossOffset: 0, containerPadding: 18 }],
  ] as const)('gaps at s = %s', (s, gaps) => {
    setWindow(3840, 2160)
    setUiScaleChoice(s)
    const { result } = renderHook(() => useScaledGaps({ offset: 4 }))
    expect(result.current).toEqual(gaps)
  })

  it('scales a given cross offset and edge padding', () => {
    setWindow(3840, 2160)
    setUiScaleChoice(1.5)
    const { result } = renderHook(() =>
      useScaledGaps({ offset: 6, crossOffset: -2, containerPadding: 8 }),
    )
    expect(result.current).toEqual({
      offset: 9,
      crossOffset: -3,
      containerPadding: 12,
    })
  })

  it('re-renders with the new gaps when the scale changes', () => {
    setWindow(3840, 2160)
    const { result } = renderHook(() => useScaledGaps({ offset: 6 }))
    expect(result.current.offset).toBe(6)
    act(() => {
      setUiScaleChoice(1.25)
    })
    expect(result.current.offset).toBe(7.5)
  })

  /** React Aria's inline `top` on the positioned element (jsdom rects are 0). */
  const topAt = async (
    s: number,
    open: () => void,
    of: () => Promise<HTMLElement | null>,
  ) => {
    setWindow(3840, 2160)
    setUiScaleChoice(s)
    open()
    const top = Number.parseFloat((await of())?.style.top ?? '')
    cleanup()
    return top
  }

  it('popover: the default 6 px offset grows to 9 at s = 1.5', async () => {
    const open = () => {
      render(
        <PopoverTrigger>
          <Button>More</Button>
          <Popover placement="bottom">
            <p>Body</p>
          </Popover>
        </PopoverTrigger>,
      )
      fireEvent.click(screen.getByRole('button', { name: 'More' }))
    }
    const of = async () =>
      (await screen.findByText('Body')).closest<HTMLElement>('.pb-popover')
    const [at1, at15] = [await topAt(1, open, of), await topAt(1.5, open, of)]
    expect(at15 - at1).toBe(3)
  })

  it('list select: the 4 px gap grows to 6 at s = 1.5', async () => {
    const open = () => {
      render(
        <ListSelect
          aria-label="Size"
          value="a"
          onChange={() => undefined}
          options={[{ value: 'a', label: 'A4' }]}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: /A4/ }))
    }
    const of = async () =>
      (await screen.findByRole('listbox')).closest<HTMLElement>(
        '.pb-list-select__popover',
      )
    const [at1, at15] = [await topAt(1, open, of), await topAt(1.5, open, of)]
    expect(at15 - at1).toBe(2)
  })

  it('menu: the positioned element keeps its classes, one zoomed box takes them too', async () => {
    render(
      <MenuTrigger>
        <Button>Sort</Button>
        <MenuPopover className="w-56">
          <Menu aria-label="Sort">
            <MenuItem id="a">A</MenuItem>
          </Menu>
        </MenuPopover>
      </MenuTrigger>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sort' }))
    const box = (await screen.findByRole('menu')).parentElement
    expect(box?.className).toBe('pb-overlay-box pb-menu-popover__box w-56')
    expect(box?.parentElement?.className).toBe('pb-menu-popover w-56')
  })

  it('popover: render-prop children land inside the box', async () => {
    render(
      <PopoverTrigger>
        <Button>More</Button>
        <Popover className="wide" placement="bottom">
          {({ placement }) => <p>placed {String(placement)}</p>}
        </Popover>
      </PopoverTrigger>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    const body = await screen.findByText(/^placed /)
    expect(body.parentElement?.className).toBe(
      'pb-overlay-box pb-popover__box wide',
    )
    expect(body.parentElement?.parentElement?.className).toBe('pb-popover wide')
  })

  it('tooltip: text sits in the zoomed box', () => {
    render(
      <TooltipTrigger delay={0} isOpen>
        <Button>Snap</Button>
        <Tooltip className="tip">Snap to grid</Tooltip>
      </TooltipTrigger>,
    )
    const tip = screen.getByRole('tooltip', { name: 'Snap to grid' })
    const box = tip.querySelector('.pb-overlay-box')
    expect(box?.className).toBe('pb-overlay-box pb-tooltip__box tip')
    expect(box?.textContent).toBe('Snap to grid')
  })

  it('list select: the list sits in the zoomed box', async () => {
    render(
      <ListSelect
        aria-label="Size"
        value="a"
        onChange={() => undefined}
        options={[
          { value: 'a', label: 'A4' },
          { value: 'b', label: 'A5' },
        ]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /A4/ }))
    const list = await screen.findByRole('listbox')
    expect(list.parentElement?.className).toBe(
      'pb-overlay-box pb-list-select__box',
    )
    expect(list.parentElement?.parentElement?.className).toBe(
      'pb-list-select__popover',
    )
  })
})
