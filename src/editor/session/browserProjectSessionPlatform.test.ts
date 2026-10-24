import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryDirectory } from '../../project'
import {
  createFakeBrowserDirectory,
  createFakeDirectoryPicker,
} from '../../project/fsa/browserDirectory.test-helpers'
import {
  browserPickDirectory,
  browserRequestReadPermission,
  browserRequestReadwritePermission,
  browserTimers,
  createBrowserProjectSessionDeps,
  createDefaultSession,
  defaultStorageFromHandle,
} from './browserProjectSessionPlatform'

describe('browserProjectSessionPlatform', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'showDirectoryPicker')
    vi.unstubAllGlobals()
  })

  it('browserPickDirectory maps AbortError to null', async () => {
    Object.defineProperty(globalThis, 'showDirectoryPicker', {
      value: createFakeDirectoryPicker({ outcomes: ['abort'] }),
      configurable: true,
      writable: true,
    })
    await expect(browserPickDirectory()).resolves.toBeNull()
  })

  it('browserPickDirectory returns null when the picker API is missing', async () => {
    Reflect.deleteProperty(globalThis, 'showDirectoryPicker')
    await expect(browserPickDirectory()).resolves.toBeNull()
  })

  it('browserPickDirectory returns a picked handle with readwrite mode', async () => {
    const handle = createFakeBrowserDirectory({ name: 'Picked' })
    const picker = vi.fn(createFakeDirectoryPicker({ outcomes: [handle] }))
    Object.defineProperty(globalThis, 'showDirectoryPicker', {
      value: picker,
      configurable: true,
      writable: true,
    })
    await expect(browserPickDirectory()).resolves.toBe(handle)
    expect(picker).toHaveBeenCalledWith({ mode: 'readwrite' })
  })

  it('browserPickDirectory rethrows non-abort errors', async () => {
    Object.defineProperty(globalThis, 'showDirectoryPicker', {
      value: () =>
        Promise.reject(new DOMException('Blocked', 'NotAllowedError')),
      configurable: true,
      writable: true,
    })
    await expect(browserPickDirectory()).rejects.toMatchObject({
      name: 'NotAllowedError',
    })
  })

  it('browserPickDirectory does not treat plain errors named AbortError as cancel', async () => {
    Object.defineProperty(globalThis, 'showDirectoryPicker', {
      value: () => {
        const error = new Error('cancel-shaped')
        error.name = 'AbortError'
        return Promise.reject(error)
      },
      configurable: true,
      writable: true,
    })
    await expect(browserPickDirectory()).rejects.toMatchObject({
      name: 'AbortError',
    })
  })

  it('browserRequestReadwritePermission reports granted and denied', async () => {
    const granted = createFakeBrowserDirectory({
      name: 'Granted',
      initialPermission: 'granted',
    })
    await expect(browserRequestReadwritePermission(granted)).resolves.toBe(
      'granted',
    )

    const denied = createFakeBrowserDirectory({
      name: 'Denied',
      initialPermission: 'prompt',
    })
    denied.enqueueRequestResults('denied')
    await expect(browserRequestReadwritePermission(denied)).resolves.toBe(
      'denied',
    )
  })

  it('browserRequestReadwritePermission requests readwrite mode', async () => {
    const handle = createFakeBrowserDirectory({ name: 'Mode' })
    const spy = vi.spyOn(handle, 'requestPermission')
    await browserRequestReadwritePermission(handle)
    expect(spy).toHaveBeenCalledWith({ mode: 'readwrite' })
  })

  it('browserRequestReadwritePermission reports unavailable without the method', async () => {
    await expect(
      browserRequestReadwritePermission({ id: 'opaque' }),
    ).resolves.toBe('unavailable')
  })

  it('browserRequestReadwritePermission maps thrown errors to denied', async () => {
    const handle = {
      requestPermission: () => Promise.reject(new Error('boom')),
    }
    await expect(browserRequestReadwritePermission(handle)).resolves.toBe(
      'denied',
    )
  })

  it('browserRequestReadPermission reports granted and denied', async () => {
    const granted = createFakeBrowserDirectory({
      name: 'ReadGranted',
      initialPermission: 'granted',
    })
    await expect(browserRequestReadPermission(granted)).resolves.toBe('granted')

    const denied = createFakeBrowserDirectory({
      name: 'ReadDenied',
      initialPermission: 'prompt',
    })
    denied.enqueueRequestResults('denied')
    await expect(browserRequestReadPermission(denied)).resolves.toBe('denied')
  })

  it('browserRequestReadPermission requests read mode', async () => {
    const handle = createFakeBrowserDirectory({ name: 'ReadMode' })
    const spy = vi.spyOn(handle, 'requestPermission')
    await browserRequestReadPermission(handle)
    expect(spy).toHaveBeenCalledWith({ mode: 'read' })
  })

  it('browserRequestReadPermission reports unavailable without the method', async () => {
    await expect(browserRequestReadPermission({ id: 'opaque' })).resolves.toBe(
      'unavailable',
    )
  })

  it('browserRequestReadPermission maps thrown errors to denied', async () => {
    const handle = {
      requestPermission: () => Promise.reject(new Error('boom')),
    }
    await expect(browserRequestReadPermission(handle)).resolves.toBe('denied')
  })

  it('createBrowserProjectSessionDeps wires browser defaults and sessionStorage', () => {
    const deps = createBrowserProjectSessionDeps()
    expect(deps.pickDirectory).toBe(browserPickDirectory)
    expect(deps.requestReadwritePermission).toBe(
      browserRequestReadwritePermission,
    )
    expect(deps.timers).toBe(browserTimers)
    expect(deps.createStorage).toBe(defaultStorageFromHandle)
    expect(typeof deps.session.recallLibraryHandle).toBe('function')
    expect(deps.storageKey).toBe(sessionStorage)
  })

  it('createBrowserProjectSessionDeps omits storageKey when sessionStorage is missing', () => {
    vi.stubGlobal('sessionStorage', undefined)
    const deps = createBrowserProjectSessionDeps()
    expect('storageKey' in deps).toBe(false)
  })

  it('browserTimers pass through to globalThis', () => {
    const spy = vi.spyOn(globalThis, 'setTimeout')
    const handle = browserTimers.setTimeout(() => undefined, 0)
    expect(spy).toHaveBeenCalled()
    browserTimers.clearTimeout(handle)
    spy.mockRestore()
  })

  it('createDefaultSession uses the browser adapter when indexedDB exists', () => {
    vi.stubGlobal('indexedDB', { open: vi.fn() })
    const session = createDefaultSession()
    expect('setPermissionRequired' in session).toBe(false)
  })

  it('createDefaultSession uses memory when indexedDB is missing', () => {
    vi.stubGlobal('indexedDB', undefined)
    const session = createDefaultSession()
    expect('setPermissionRequired' in session).toBe(true)
  })

  it('defaultStorageFromHandle accepts a library protocol root', async () => {
    const storage = defaultStorageFromHandle(createMemoryDirectory())
    const listed = await storage.listBooks()
    expect(listed.ok).toBe(true)
  })

  it('defaultStorageFromHandle accepts a browser directory handle', async () => {
    const storage = defaultStorageFromHandle(
      createFakeBrowserDirectory({ name: 'fs-lib' }),
    )
    const listed = await storage.listBooks()
    expect(listed.ok).toBe(true)
  })
})
