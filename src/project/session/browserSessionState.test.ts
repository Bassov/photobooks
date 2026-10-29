import assert from 'node:assert/strict'
import { describe, expect, it, vi } from 'vitest'

import { createFakeBrowserDirectory } from '../fsa/browserDirectory.test-helpers'
import { createBrowserSessionState } from './browserSessionState'
import type { SessionIdb, SessionIdbGetResult } from './idb'
import type { LockRequestCallback, SessionLocks } from './locks'
import { runSessionStateContract } from './sessionState.contract.test-helpers'

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
    keys() {
      return Promise.resolve([...map.keys()])
    },
    runReadwrite(mutations) {
      for (const mutation of mutations) {
        if (mutation.op === 'set') {
          map.set(mutation.key, mutation.value)
        } else {
          map.delete(mutation.key)
        }
      }
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

runSessionStateContract(() => {
  const idb = createMemoryIdb()
  const locks = createMemoryLocks()
  const session = createBrowserSessionState({ idb, locks })
  const handles = new Map<
    string,
    ReturnType<typeof createFakeBrowserDirectory>
  >()
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
      const handle = createFakeBrowserDirectory({
        name: `fake-${String(handleSeq)}`,
      })
      handles.set(handle.name, handle)
      return handle
    },
  }
})

describe('createBrowserSessionState with failing IndexedDB', () => {
  function createBlockedIdb(): SessionIdb {
    const fail = () => Promise.reject(new Error('indexedDB blocked'))
    return {
      get: fail,
      set: fail,
      del: fail,
      keys: fail,
      runReadwrite: fail,
    }
  }

  function createBlocked() {
    return createBrowserSessionState({
      idb: createBlockedIdb(),
      locks: createMemoryLocks(),
    })
  }

  it('returns storage-unavailable instead of throwing on handle reads', async () => {
    const session = createBlocked()

    expect(await session.recallLibraryHandle('library')).toEqual({
      ok: false,
      code: 'storage-unavailable',
    })
    expect(await session.peekLibraryHandle('library')).toEqual({
      ok: false,
      code: 'storage-unavailable',
    })
  })

  it('returns storage-unavailable instead of throwing on writes', async () => {
    const session = createBlocked()
    const handle = createFakeBrowserDirectory({ name: 'Trip' })

    expect(await session.rememberLibraryHandle('library', handle)).toEqual({
      ok: false,
      code: 'storage-unavailable',
    })
    expect(await session.clearLibraryHandle('library')).toEqual({
      ok: false,
      code: 'storage-unavailable',
    })
    expect(
      await session.setActiveIds({ libraryId: 'library', bookId: 'b1' }),
    ).toEqual({ ok: false, code: 'storage-unavailable' })
  })

  it('returns empty label and active ids instead of throwing', async () => {
    const session = createBlocked()

    expect(await session.getLibraryLabel('library')).toBeNull()
    expect(await session.getActiveIds()).toEqual({
      libraryId: null,
      bookId: null,
    })
  })

  it('returns null label when only the label read fails', async () => {
    const memory = createMemoryIdb()
    const session = createBrowserSessionState({
      idb: {
        ...memory,
        async get(key) {
          if (key === 'library') {
            return { present: false }
          }
          return Promise.reject(new Error('label read failed'))
        },
      },
      locks: createMemoryLocks(),
      skipLegacyMigration: true,
    })

    expect(await session.getLibraryLabel('library')).toBeNull()
  })
})

describe('createBrowserSessionState', () => {
  it('returns permission-required when queryPermission is not granted for readwrite', async () => {
    const idb = createMemoryIdb()
    const session = createBrowserSessionState({
      idb,
      locks: createMemoryLocks(),
    })
    const handle = createFakeBrowserDirectory({ name: 'denied' })
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
    const handle = createFakeBrowserDirectory({ name: 'mode-check' })
    const query = handle.queryPermission.bind(handle)
    handle.queryPermission = (descriptor) => {
      modes.push(descriptor?.mode)
      return query(descriptor)
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
    assert.equal(acquired.ok, true)
    await acquired.value.release()

    expect(names).toEqual(['photobooks:book:spread-9'])
  })

  it('remember replaces prior library handles and keeps reserved keys', async () => {
    const idb = createMemoryIdb()
    const session = createBrowserSessionState({
      idb,
      locks: createMemoryLocks(),
      skipLegacyMigration: true,
    })
    const first = createFakeBrowserDirectory({ name: 'First' })
    const second = createFakeBrowserDirectory({ name: 'Second' })
    await idb.set('__keep', 'reserved')
    await session.rememberLibraryHandle('lib-a', first, 'First')
    await session.rememberLibraryHandle('lib-b', second, 'Second')

    await expect(session.peekLibraryHandle('lib-a')).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(session.peekLibraryHandle('lib-b')).resolves.toEqual({
      ok: true,
      value: second,
    })
    await expect(idb.get('__keep')).resolves.toEqual({
      present: true,
      value: 'reserved',
    })
    await expect(session.getLibraryLabel('lib-b')).resolves.toBe('Second')
  })

  it('getLibraryLabel covers reserved, missing, default-label, and handle fallback', async () => {
    const idb = createMemoryIdb()
    const session = createBrowserSessionState({
      idb,
      locks: createMemoryLocks(),
      skipLegacyMigration: true,
    })

    await expect(session.getLibraryLabel('__recents')).resolves.toBeNull()
    await expect(session.getLibraryLabel('missing')).resolves.toBeNull()

    await idb.set('__libraryLabel', '  Orphan Label  ')
    await expect(session.getLibraryLabel('library')).resolves.toBe(
      'Orphan Label',
    )

    const handle = createFakeBrowserDirectory({ name: 'Named' })
    await session.rememberLibraryHandle('library', handle, '  ')
    await idb.set('__libraryLabel', '   ')
    await expect(session.getLibraryLabel('library')).resolves.toBe('Named')
  })

  it('soft-fails legacy migration errors and still serves handles', async () => {
    const idb = createMemoryIdb()
    const realGet = idb.get.bind(idb)
    let getCount = 0
    idb.get = async (key) => {
      getCount += 1
      if (key === '__recents' && getCount === 1) {
        throw new Error('migrate boom')
      }
      return realGet(key)
    }
    const session = createBrowserSessionState({
      idb,
      locks: createMemoryLocks(),
    })
    const handle = createFakeBrowserDirectory({ name: 'AfterMigrate' })
    await expect(
      session.rememberLibraryHandle('library', handle, 'AfterMigrate'),
    ).resolves.toEqual({ ok: true, value: undefined })
    await expect(session.recallLibraryHandle('library')).resolves.toEqual({
      ok: true,
      value: handle,
    })
  })

  it('skipLegacyMigration avoids migrate and still remembers', async () => {
    const idb = createMemoryIdb()
    const get = vi.spyOn(idb, 'get')
    const session = createBrowserSessionState({
      idb,
      locks: createMemoryLocks(),
      skipLegacyMigration: true,
    })
    const handle = createFakeBrowserDirectory({ name: 'Skip' })
    await session.rememberLibraryHandle('library', handle, 'Skip')
    expect(get).not.toHaveBeenCalledWith('__recents')
    await expect(session.getLibraryLabel('library')).resolves.toBe('Skip')
  })

  it('getLibraryLabel returns null for a non-default missing library', async () => {
    const idb = createMemoryIdb()
    await idb.set('__libraryLabel', 'Orphan')
    const session = createBrowserSessionState({
      idb,
      locks: createMemoryLocks(),
      skipLegacyMigration: true,
    })
    await expect(session.getLibraryLabel('other')).resolves.toBeNull()
  })

  it('remember with no other keys skips deletion batch', async () => {
    const idb = createMemoryIdb()
    const run = vi.spyOn(idb, 'runReadwrite')
    const session = createBrowserSessionState({
      idb,
      locks: createMemoryLocks(),
      skipLegacyMigration: true,
    })
    const handle = createFakeBrowserDirectory({ name: 'Only' })
    await session.rememberLibraryHandle('library', handle, 'Only')
    expect(run).toHaveBeenCalledTimes(1)
    expect(run.mock.calls[0]?.[0]).toEqual([
      { op: 'set', key: 'library', value: handle },
      { op: 'set', key: '__libraryLabel', value: 'Only' },
    ])
  })
})

describe('FSA permission Done-when via hasReadwritePermission / recallLibraryHandle', () => {
  function createSession() {
    return createBrowserSessionState({
      idb: createMemoryIdb(),
      locks: createMemoryLocks(),
    })
  }

  it('deny: queryPermission denied → recallLibraryHandle permission-required', async () => {
    const session = createSession()
    const handle = createFakeBrowserDirectory({ name: 'deny-path' })
    await session.rememberLibraryHandle('lib-deny', handle)
    handle.setPermission('denied')

    await expect(session.recallLibraryHandle('lib-deny')).resolves.toEqual({
      ok: false,
      code: 'permission-required',
    })
  })

  it('prompt: queryPermission prompt → recallLibraryHandle permission-required', async () => {
    const session = createSession()
    const handle = createFakeBrowserDirectory({ name: 'prompt-path' })
    await session.rememberLibraryHandle('lib-prompt', handle)
    handle.setPermission('prompt')

    await expect(session.recallLibraryHandle('lib-prompt')).resolves.toEqual({
      ok: false,
      code: 'permission-required',
    })
  })

  it('re-grant: requestPermission granted updates sticky → recall succeeds', async () => {
    const session = createSession()
    const handle = createFakeBrowserDirectory({
      name: 'regrant-path',
      initialPermission: 'denied',
    })
    await session.rememberLibraryHandle('lib-regrant', handle)

    await expect(session.recallLibraryHandle('lib-regrant')).resolves.toEqual({
      ok: false,
      code: 'permission-required',
    })

    handle.enqueueRequestResults('granted')
    await expect(handle.requestPermission({ mode: 'readwrite' })).resolves.toBe(
      'granted',
    )

    const recalled = await session.recallLibraryHandle('lib-regrant')
    expect(recalled).toEqual({ ok: true, value: handle })
  })
})
