import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getEditorStatus, setEditorStatus } from './editorStatus'
import { FilmstripDock } from './FilmstripDock'

afterEach(() => {
  cleanup()
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

describe('FilmstripDock chrome', () => {
  it('has no thumbnail size slider', () => {
    render(<FilmstripDock />)
    expect(screen.queryByRole('slider')).toBeNull()
  })

  it('has no resize separator and a fixed kit thumb height', () => {
    render(<FilmstripDock />)
    expect(screen.queryByRole('separator')).toBeNull()
    expect(screen.queryByTestId('film-splitter')).toBeNull()
    expect(
      screen.getByTestId('dock').style.getPropertyValue('--film-thumb-h'),
    ).toBe('76px')
  })

  it('Add folder… calls the chooser and respects importDisabled', () => {
    const choose = vi.fn(() => Promise.resolve())
    const { rerender } = render(<FilmstripDock onChoosePhotoFolder={choose} />)
    fireEvent.click(screen.getByTestId('film-add-folder'))
    expect(choose).toHaveBeenCalledTimes(1)
    rerender(<FilmstripDock onChoosePhotoFolder={choose} importDisabled />)
    fireEvent.click(screen.getByTestId('film-add-folder'))
    expect(choose).toHaveBeenCalledTimes(1)
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
