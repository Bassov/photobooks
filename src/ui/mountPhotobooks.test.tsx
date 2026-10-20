import { describe, expect, it, vi } from 'vitest'
import { mountPhotobooks } from './mountPhotobooks'

describe('mountPhotobooks', () => {
  it('applies theme, configures session, and renders the tree', () => {
    const applyTheme = vi.fn()
    const configureSession = vi.fn()
    const createSessionDeps = vi.fn(() => ({}) as never)
    const render = vi.fn()
    const createRoot = vi.fn(() => ({ render }))
    const createTree = vi.fn(() => <div data-testid="tree" />)
    const getSearch = vi.fn(() => '?x=1')
    const root = document.createElement('div')

    mountPhotobooks({
      applyTheme,
      configureSession,
      createSessionDeps,
      shouldEnablePerf: () => false,
      enablePerf: vi.fn(),
      warmWorker: vi.fn(),
      getRootElement: () => root,
      createRoot: createRoot as never,
      createTree,
      getSearch,
    })

    expect(applyTheme).toHaveBeenCalledOnce()
    expect(createSessionDeps).toHaveBeenCalledOnce()
    expect(configureSession).toHaveBeenCalledOnce()
    expect(getSearch).toHaveBeenCalledOnce()
    expect(createTree).toHaveBeenCalledWith('?x=1')
    expect(createRoot).toHaveBeenCalledWith(root)
    expect(render).toHaveBeenCalledOnce()
  })

  it('warms perf hooks when enabled', () => {
    const enablePerf = vi.fn()
    const warmWorker = vi.fn()
    const root = document.createElement('div')

    mountPhotobooks({
      applyTheme: vi.fn(),
      configureSession: vi.fn(),
      createSessionDeps: vi.fn(() => ({}) as never),
      shouldEnablePerf: () => true,
      enablePerf,
      warmWorker,
      getRootElement: () => root,
      createRoot: vi.fn(() => ({ render: vi.fn() })) as never,
      createTree: vi.fn(() => <div />),
      getSearch: () => '',
    })

    expect(enablePerf).toHaveBeenCalledOnce()
    expect(warmWorker).toHaveBeenCalledOnce()
  })

  it('throws when #root is missing', () => {
    expect(() => {
      mountPhotobooks({
        applyTheme: vi.fn(),
        configureSession: vi.fn(),
        createSessionDeps: vi.fn(() => ({}) as never),
        shouldEnablePerf: () => false,
        getRootElement: () => null,
        createRoot: vi.fn() as never,
        createTree: vi.fn(() => <div />),
        getSearch: () => '',
      })
    }).toThrow(/Root element #root not found/)
  })

  it('uses the default theme applicator when none is injected', () => {
    delete document.documentElement.dataset.theme
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const root = document.createElement('div')
    root.id = 'root'
    document.body.appendChild(root)
    const createTree = vi.fn(() => <div />)

    mountPhotobooks({
      configureSession: vi.fn(),
      createSessionDeps: vi.fn(() => ({}) as never),
      shouldEnablePerf: () => false,
      createRoot: vi.fn(() => ({ render: vi.fn() })) as never,
      createTree,
    })

    expect(document.documentElement.dataset.theme).toBe('b')
    expect(document.getElementById('root')).toBe(root)
    expect(createTree).toHaveBeenCalledWith(window.location.search)
    expect(createTree).toHaveBeenCalledWith(expect.any(String))
    root.remove()
    vi.unstubAllGlobals()
  })
})
