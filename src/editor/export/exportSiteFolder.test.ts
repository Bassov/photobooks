import { describe, expect, it, vi } from 'vitest'
import type { SessionIdb } from '../../project/session/idb'
import {
  loadExportFolder,
  pickExportFolder,
  requestFolderWrite,
  saveExportFolder,
} from './exportSiteFolder'

function memoryIdb(): SessionIdb {
  const map = new Map<string, unknown>()
  return {
    get: (key) =>
      Promise.resolve(
        map.has(key)
          ? { present: true, value: map.get(key) }
          : { present: false },
      ),
    set: (key, value) => {
      map.set(key, value)
      return Promise.resolve()
    },
    del: (key) => {
      map.delete(key)
      return Promise.resolve()
    },
    keys: () => Promise.resolve([...map.keys()]),
    runReadwrite: () => Promise.resolve(),
  }
}

const brokenIdb: SessionIdb = {
  get: () => Promise.reject(new Error('blocked')),
  set: () => Promise.reject(new Error('blocked')),
  del: () => Promise.reject(new Error('blocked')),
  keys: () => Promise.reject(new Error('blocked')),
  runReadwrite: () => Promise.reject(new Error('blocked')),
}

const folder = {
  kind: 'directory',
  name: 'Site',
} as unknown as FileSystemDirectoryHandle

describe('export folder memory', () => {
  it('remembers the folder per key', async () => {
    const idb = memoryIdb()

    await saveExportFolder('lib-1', folder, idb)

    expect(await loadExportFolder('lib-1', idb)).toBe(folder)
    expect(await loadExportFolder('session', idb)).toBeNull()
  })

  it('ignores stored values that are not directory handles', async () => {
    const idb = memoryIdb()
    await idb.set('a', { kind: 'file', name: 'x' })
    await idb.set('b', null)

    expect(await loadExportFolder('a', idb)).toBeNull()
    expect(await loadExportFolder('b', idb)).toBeNull()
  })

  it('reads blocked storage as no folder and does not throw on save', async () => {
    await expect(saveExportFolder('k', folder, brokenIdb)).resolves.toBe(
      undefined,
    )
    expect(await loadExportFolder('k', brokenIdb)).toBeNull()
  })
})

describe('pickExportFolder', () => {
  it('opens the readwrite picker with the site id', async () => {
    const showDirectoryPicker = vi.fn(() => Promise.resolve(folder))

    expect(await pickExportFolder({ showDirectoryPicker })).toBe(folder)
    expect(showDirectoryPicker).toHaveBeenCalledWith({
      id: 'photobooks-site',
      mode: 'readwrite',
    })
  })

  it('returns null without a picker or when it is dismissed', async () => {
    expect(await pickExportFolder({})).toBeNull()
    const showDirectoryPicker = () =>
      Promise.reject(new DOMException('no', 'AbortError'))
    expect(await pickExportFolder({ showDirectoryPicker })).toBeNull()
  })
})

describe('requestFolderWrite', () => {
  const withPermission = (result: Promise<PermissionState>) =>
    ({
      kind: 'directory',
      name: 'Site',
      requestPermission: vi.fn(() => result),
    }) as unknown as FileSystemDirectoryHandle & {
      requestPermission: ReturnType<typeof vi.fn>
    }

  it('asks for readwrite and is true only when granted', async () => {
    const granted = withPermission(Promise.resolve('granted'))
    expect(await requestFolderWrite(granted)).toBe(true)
    expect(granted.requestPermission).toHaveBeenCalledWith({
      mode: 'readwrite',
    })
    expect(
      await requestFolderWrite(withPermission(Promise.resolve('denied'))),
    ).toBe(false)
    expect(
      await requestFolderWrite(withPermission(Promise.reject(new Error('x')))),
    ).toBe(false)
  })

  it('treats a handle without the permission API as granted', async () => {
    expect(await requestFolderWrite(folder)).toBe(true)
  })
})
