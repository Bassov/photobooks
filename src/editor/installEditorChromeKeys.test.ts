import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_EDITOR_PANELS } from './editorChromePanels'
import { installEditorChromeKeys } from './installEditorChromeKeys'

describe('installEditorChromeKeys', () => {
  let dispose: (() => void) | undefined

  afterEach(() => {
    dispose?.()
    dispose = undefined
  })

  function mount() {
    let panels = { ...DEFAULT_EDITOR_PANELS }
    const setPanels = vi.fn((next) => {
      panels = next
    })
    const setSpaceDown = vi.fn()
    dispose = installEditorChromeKeys({
      getPanels: () => panels,
      setPanels,
      setSpaceDown,
    })
    return { panels: () => panels, setPanels, setSpaceDown }
  }

  it('toggles each panel key and Cmd+.', () => {
    const { setPanels } = mount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '[' }))
    // Default panels are all open (kit: uikit/src/sandbox/chrome.tsx:139).
    expect(setPanels).toHaveBeenCalledWith({ l: false, b: true, r: true })
    setPanels.mockClear()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '\\' }))
    expect(setPanels).toHaveBeenCalledWith({ l: false, b: false, r: true })
    setPanels.mockClear()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }))
    expect(setPanels).toHaveBeenCalledWith({ l: false, b: false, r: false })
    setPanels.mockClear()
    // Restore open panels then toggle all
    setPanels({ l: true, b: true, r: true })
    setPanels.mockClear()
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: '.', metaKey: true }),
    )
    expect(setPanels).toHaveBeenCalledWith({ l: false, b: false, r: false })
  })

  it('arms and clears Space pan; ignores typing and filmstrip targets', () => {
    const { setPanels, setSpaceDown } = mount()
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'Space',
        key: ' ',
        bubbles: true,
      }),
    )
    // target defaults to window — pan arms
    expect(setSpaceDown).toHaveBeenCalledWith(true)
    setSpaceDown.mockClear()
    window.dispatchEvent(
      new KeyboardEvent('keyup', { code: 'Space', key: ' ' }),
    )
    expect(setSpaceDown).toHaveBeenCalledWith(false)
    setSpaceDown.mockClear()
    setPanels.mockClear()
    window.dispatchEvent(new Event('blur'))
    expect(setSpaceDown).toHaveBeenCalledWith(false)

    // While Space is held, panel keys are ignored
    setSpaceDown.mockClear()
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'Space', key: ' ' }),
    )
    setPanels.mockClear()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '[' }))
    expect(setPanels).not.toHaveBeenCalled()
    window.dispatchEvent(
      new KeyboardEvent('keyup', { code: 'Space', key: ' ' }),
    )
    setSpaceDown.mockClear()

    const film = document.createElement('div')
    film.dataset.testid = 'filmstrip'
    const tile = document.createElement('div')
    tile.setAttribute('role', 'option')
    film.appendChild(tile)
    document.body.appendChild(film)
    tile.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'Space',
        key: ' ',
        bubbles: true,
      }),
    )
    expect(setSpaceDown).not.toHaveBeenCalled()
    film.remove()
  })

  it('ignores panel keys with alt / plain letters', () => {
    const { setPanels } = mount()
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: '[', altKey: true }),
    )
    expect(setPanels).not.toHaveBeenCalled()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }))
    expect(setPanels).not.toHaveBeenCalled()
  })

  it('disposes listeners so later keys do nothing', () => {
    const { setPanels, setSpaceDown } = mount()
    dispose?.()
    dispose = undefined
    setPanels.mockClear()
    setSpaceDown.mockClear()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '[' }))
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'Space', key: ' ' }),
    )
    expect(setPanels).not.toHaveBeenCalled()
    expect(setSpaceDown).not.toHaveBeenCalled()
  })
})
