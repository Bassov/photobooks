import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getEditorStatus, setEditorStatus } from './editorStatus'
import { FilmstripDock } from './FilmstripDock'
import {
  getFilmstripThumbHeight,
  resetFilmstripThumbHeightForTests,
  setFilmstripThumbHeight,
} from './filmstripSize'

afterEach(() => {
  cleanup()
  resetFilmstripThumbHeightForTests()
  setEditorStatus('')
})

function dropData(items: unknown[], types = ['Files']): DataTransfer {
  return { types, items, dropEffect: 'none' } as unknown as DataTransfer
}

function handleItem(handle: { kind: string }): unknown {
  return { kind: 'file', getAsFileSystemHandle: () => Promise.resolve(handle) }
}

async function dropOn(items: unknown[], types?: string[]): Promise<boolean> {
  let notPrevented = true
  await act(async () => {
    notPrevented = fireEvent.drop(screen.getByTestId('dock'), {
      dataTransfer: dropData(items, types),
    })
    await Promise.resolve()
  })
  return notPrevented
}

describe('FilmstripDock resize', () => {
  it('changes the height with arrow keys and ignores other keys', () => {
    render(<FilmstripDock />)
    const splitter = screen.getByTestId('film-splitter')
    expect(fireEvent.keyDown(splitter, { key: 'ArrowUp' })).toBe(false)
    expect(getFilmstripThumbHeight()).toBe(104)
    expect(splitter.getAttribute('aria-valuenow')).toBe('104')
    fireEvent.keyDown(splitter, { key: 'ArrowDown' })
    fireEvent.keyDown(splitter, { key: 'ArrowDown' })
    expect(getFilmstripThumbHeight()).toBe(88)
    expect(fireEvent.keyDown(splitter, { key: 'a' })).toBe(true)
    expect(getFilmstripThumbHeight()).toBe(88)
  })

  it('previews through CSS vars while dragging and commits once on release', () => {
    render(<FilmstripDock />)
    const dock = screen.getByTestId('dock')
    const splitter = screen.getByTestId('film-splitter')
    const capture = vi.fn()
    Object.assign(splitter, { setPointerCapture: capture })
    fireEvent.pointerDown(splitter, { clientY: 300, pointerId: 7 })
    expect(capture).toHaveBeenCalledWith(7)
    fireEvent.pointerMove(splitter, { clientY: 252, pointerId: 7 })
    expect(dock.getAttribute('data-film-resizing')).toBe('true')
    expect(dock.style.getPropertyValue('--film-preview-scale')).toBe('1.5')
    expect(getFilmstripThumbHeight()).toBe(96)
    fireEvent.pointerUp(splitter, { pointerId: 7 })
    expect(getFilmstripThumbHeight()).toBe(144)
    expect(dock.hasAttribute('data-film-resizing')).toBe(false)
    expect(dock.style.getPropertyValue('--film-preview-scale')).toBe('')
    expect(dock.style.getPropertyValue('--film-thumb-h')).toBe('144px')
    // A move after release no longer previews.
    fireEvent.pointerMove(splitter, { clientY: 100, pointerId: 7 })
    expect(dock.hasAttribute('data-film-resizing')).toBe(false)
  })

  it('does not preview on a move without a pointer press, nor change size on a plain click', () => {
    setFilmstripThumbHeight(128)
    render(<FilmstripDock />)
    const dock = screen.getByTestId('dock')
    const splitter = screen.getByTestId('film-splitter')
    Object.assign(splitter, { setPointerCapture: vi.fn() })
    fireEvent.pointerMove(splitter, { clientY: 10 })
    expect(dock.hasAttribute('data-film-resizing')).toBe(false)
    fireEvent.pointerDown(splitter, { clientY: 10, pointerId: 1 })
    fireEvent.pointerUp(splitter, { pointerId: 1 })
    expect(getFilmstripThumbHeight()).toBe(128)
  })

  it('cancel drops the draft without committing', () => {
    render(<FilmstripDock />)
    const dock = screen.getByTestId('dock')
    const splitter = screen.getByTestId('film-splitter')
    Object.assign(splitter, { setPointerCapture: vi.fn() })
    fireEvent.pointerDown(splitter, { clientY: 300, pointerId: 1 })
    fireEvent.pointerMove(splitter, { clientY: 250, pointerId: 1 })
    fireEvent.pointerCancel(splitter, { pointerId: 1 })
    expect(getFilmstripThumbHeight()).toBe(96)
    expect(dock.hasAttribute('data-film-resizing')).toBe(false)
    fireEvent.pointerMove(splitter, { clientY: 200, pointerId: 1 })
    expect(dock.hasAttribute('data-film-resizing')).toBe(false)
  })

  it('clears the preview when the draft equals the committed height', () => {
    render(<FilmstripDock />)
    const dock = screen.getByTestId('dock')
    const slider = screen.getByTestId('film-size')
    fireEvent.change(slider, { target: { value: '144' } })
    fireEvent.change(slider, { target: { value: '96' } })
    expect(dock.getAttribute('data-film-resizing')).toBe('true')
    fireEvent.keyUp(slider, { key: 'ArrowRight' })
    expect(getFilmstripThumbHeight()).toBe(96)
    expect(dock.hasAttribute('data-film-resizing')).toBe(false)
    expect(dock.style.getPropertyValue('--film-preview-scale')).toBe('')
    expect(dock.style.getPropertyValue('--film-preview-origin')).toBe('')
  })

  it('previews around the strip scroll offset', () => {
    render(<FilmstripDock />)
    const dock = screen.getByTestId('dock')
    const scroller = dock.querySelector<HTMLElement>('.filmstrip-scroll')
    expect(scroller).not.toBeNull()
    Object.defineProperty(scroller, 'scrollLeft', {
      configurable: true,
      value: 240,
    })
    fireEvent.change(screen.getByTestId('film-size'), {
      target: { value: '144' },
    })
    expect(dock.style.getPropertyValue('--film-preview-origin')).toBe('240px')
  })

  it('slider previews on change and commits on release', () => {
    render(<FilmstripDock />)
    const slider = screen.getByTestId('film-size')
    const dock = screen.getByTestId('dock')
    fireEvent.change(slider, { target: { value: '144' } })
    expect(dock.style.getPropertyValue('--film-preview-scale')).toBe('1.5')
    expect(getFilmstripThumbHeight()).toBe(96)
    fireEvent.keyUp(slider, { key: 'Tab' })
    expect(getFilmstripThumbHeight()).toBe(96)
    fireEvent.keyUp(slider, { key: 'ArrowRight' })
    expect(getFilmstripThumbHeight()).toBe(144)
  })
})

describe('FilmstripDock desktop drop', () => {
  it('imports a dropped folder and clears the hover', async () => {
    const onDrop = vi.fn(() => Promise.resolve())
    render(<FilmstripDock onDropPhotoFolder={onDrop} />)
    const dock = screen.getByTestId('dock')
    const directory = { kind: 'directory', name: 'trip' }
    expect(fireEvent.dragOver(dock, { dataTransfer: dropData([]) })).toBe(false)
    expect(dock.getAttribute('data-drop-hover')).toBe('true')
    expect(await dropOn([handleItem(directory)])).toBe(false)
    expect(dock.hasAttribute('data-drop-hover')).toBe(false)
    expect(onDrop).toHaveBeenCalledWith(directory)
    expect(getEditorStatus()).toBe('')
  })

  it('says loose files were ignored when a folder comes with files', async () => {
    const onDrop = vi.fn(() => Promise.resolve())
    render(<FilmstripDock onDropPhotoFolder={onDrop} />)
    await dropOn([
      handleItem({ kind: 'file' }),
      handleItem({ kind: 'directory' }),
    ])
    expect(onDrop).toHaveBeenCalledTimes(1)
    expect(getEditorStatus()).toContain('loose files were ignored')
  })

  it('explains that loose files are not imported', async () => {
    const onDrop = vi.fn(() => Promise.resolve())
    render(<FilmstripDock onDropPhotoFolder={onDrop} />)
    await dropOn([handleItem({ kind: 'file' })])
    expect(onDrop).not.toHaveBeenCalled()
    expect(getEditorStatus()).toContain('Drop a folder')
  })

  it('ignores in-app drags and docks without an import handler', async () => {
    const onDrop = vi.fn(() => Promise.resolve())
    const { unmount } = render(<FilmstripDock onDropPhotoFolder={onDrop} />)
    const dock = screen.getByTestId('dock')
    expect(
      fireEvent.dragOver(dock, {
        dataTransfer: dropData([], ['application/x-photobooks-asset']),
      }),
    ).toBe(true)
    expect(dock.hasAttribute('data-drop-hover')).toBe(false)
    expect(
      await dropOn([handleItem({ kind: 'directory' })], ['text/plain']),
    ).toBe(true)
    expect(onDrop).not.toHaveBeenCalled()
    unmount()

    render(<FilmstripDock />)
    expect(
      fireEvent.dragOver(screen.getByTestId('dock'), {
        dataTransfer: dropData([]),
      }),
    ).toBe(true)
    expect(await dropOn([handleItem({ kind: 'directory' })])).toBe(true)
  })

  it('shows the kit drop overlay only during an external drag', async () => {
    render(<FilmstripDock onDropPhotoFolder={() => Promise.resolve()} />)
    const dock = screen.getByTestId('dock')
    expect(screen.queryByTestId('film-drop-overlay')).toBeNull()
    fireEvent.dragOver(dock, {
      dataTransfer: dropData([], ['application/x-photobooks-asset']),
    })
    expect(screen.queryByTestId('film-drop-overlay')).toBeNull()
    fireEvent.dragOver(dock, { dataTransfer: dropData([]) })
    expect(screen.getByTestId('film-drop-overlay').textContent).toBe(
      'Drop a folder to add its photos',
    )
    fireEvent.dragLeave(dock, { relatedTarget: null })
    expect(screen.queryByTestId('film-drop-overlay')).toBeNull()
    fireEvent.dragOver(dock, { dataTransfer: dropData([]) })
    await dropOn([handleItem({ kind: 'directory' })])
    expect(screen.queryByTestId('film-drop-overlay')).toBeNull()
  })

  it('clears the hover only when the drag leaves the dock', () => {
    render(<FilmstripDock onDropPhotoFolder={() => Promise.resolve()} />)
    const dock = screen.getByTestId('dock')
    fireEvent.dragOver(dock, { dataTransfer: dropData([]) })
    act(() => {
      dock.dispatchEvent(
        new MouseEvent('dragleave', {
          bubbles: true,
          relatedTarget: screen.getByTestId('film-head'),
        }),
      )
    })
    expect(dock.getAttribute('data-drop-hover')).toBe('true')
    fireEvent.dragLeave(dock, { relatedTarget: null })
    expect(dock.hasAttribute('data-drop-hover')).toBe(false)
  })
})
