import { describe, expect, it } from 'vitest'

import { createBrowserSessionState } from './browserSessionState'
import type { SessionIdb, SessionIdbGetResult } from './idb'
import type { LockRequestCallback, SessionLocks } from './locks'
import { runSessionStateContract } from './sessionState.contract.test-helpers'
import type { SessionDirectoryHandle } from './types'

function createMemoryIdb(): SessionIdb {
  const map = new Map<string, unknown>()
  return {
    get(key): Promise<SessionIdbGetResult> {
      if (!map.has(key)) {
        return Promise.resolve({ present: false })
      }
      return Promise.resolve({ present: true, value: map.get(key) })
    },
    set(key, value) {
      map.set(key, value)
      return Promise.resolve()
    },
    del(key) {
      map.delete(key)
      return Promise.resolve()
    },
  }
}

function createMemoryLocks(): SessionLocks {
  const held = new Set<string>()
  return {
    async request(name, options, callback: LockRequestCallback) {
      if (options.ifAvailable && held.has(name)) {
        await callback(null)
        return
      }
      held.add(name)
      try {
        await callback({ name } as Lock)
      } finally {
        held.delete(name)
      }
    },
  }
}

interface FakeDirectoryHandle extends SessionDirectoryHandle {
  kind: 'directory'
  name: string
  queryPermission: (
    descriptor?: FileSystemHandlePermissionDescriptor,
  ) => Promise<PermissionState>
  setPermission: (state: PermissionState) => void
}

function createFakeDirectoryHandle(name: string): FakeDirectoryHandle {
  let permission: PermissionState = 'granted'
  return {
    kind: 'directory',
    name,
    setPermission(state) {
      permission = state
    },
    queryPermission(descriptor) {
      if (descriptor?.mode !== undefined && descriptor.mode !== 'readwrite') {
        return Promise.resolve('prompt')
      }
      return Promise.resolve(permission)
    },
  }
}

runSessionStateContract(() => {
  const idb = createMemoryIdb()
  const locks = createMemoryLocks()
  const session = createBrowserSessionState({ idb, locks })
  const handles = new Map<string, FakeDirectoryHandle>()
  let handleSeq = 0

  return {
    session,
    setPermissionRequired(required) {
      for (const handle of handles.values()) {
        handle.setPermission(required ? 'prompt' : 'granted')
      }
    },
    createHandle() {
      handleSeq += 1
      const handle = createFakeDirectoryHandle(`fake-${String(handleSeq)}`)
      handles.set(handle.name, handle)
      return handle
    },
  }
})

describe('createBrowserSessionState', () => {
  it('returns permission-required when queryPermission is not granted for readwrite', async () => {
    const idb = createMemoryIdb()
    const session = createBrowserSessionState({
      idb,
      locks: createMemoryLocks(),
    })
    const handle = createFakeDirectoryHandle('denied')
    await session.rememberLibraryHandle('lib-1', handle)
    handle.setPermission('denied')

    const recalled = await session.recallLibraryHandle('lib-1')

    expect(recalled).toEqual({ ok: false, code: 'permission-required' })
  })

  it('returns not-found when stored value is not a directory handle', async () => {
    const idb = createMemoryIdb()
    await idb.set('lib-1', { kind: 'file', name: 'not-a-dir' })
    await idb.set('lib-2', 'plain-string')
    await idb.set('lib-3', null)
    const session = createBrowserSessionState({
      idb,
      locks: createMemoryLocks(),
    })

    await expect(session.recallLibraryHandle('lib-1')).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(session.recallLibraryHandle('lib-2')).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(session.recallLibraryHandle('lib-3')).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
  })

  it('treats a handle without queryPermission as granted', async () => {
    const idb = createMemoryIdb()
    const handle = {
      kind: 'directory' as const,
      name: 'no-query',
    }
    await idb.set('lib-1', handle)
    const session = createBrowserSessionState({
      idb,
      locks: createMemoryLocks(),
    })

    await expect(session.recallLibraryHandle('lib-1')).resolves.toEqual({
      ok: true,
      value: handle,
    })
  })

  it('queries permission with readwrite mode', async () => {
    const idb = createMemoryIdb()
    const modes: (string | undefined)[] = []
    const handle = {
      kind: 'directory' as const,
      name: 'mode-check',
      queryPermission(descriptor?: FileSystemHandlePermissionDescriptor) {
        modes.push(descriptor?.mode)
        return Promise.resolve('granted' as PermissionState)
      },
    }
    await idb.set('lib-1', handle)
    const session = createBrowserSessionState({
      idb,
      locks: createMemoryLocks(),
    })

    await session.recallLibraryHandle('lib-1')

    expect(modes).toEqual(['readwrite'])
  })

  it('requests an exclusive lock named photobooks:book:<id>', async () => {
    const idb = createMemoryIdb()
    const names: string[] = []
    const locks: SessionLocks = {
      async request(name, _options, callback) {
        names.push(name)
        await callback({ name } as Lock)
      },
    }
    const session = createBrowserSessionState({ idb, locks })

    const acquired = await session.acquireBookLock('spread-9')
    expect(acquired.ok).toBe(true)
    if (acquired.ok) {
      await acquired.value.release()
    }

    expect(names).toEqual(['photobooks:book:spread-9'])
  })
})
