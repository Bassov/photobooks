import { describe, expect, it } from 'vitest'

import { createFakeBrowserDirectory } from '../fsa/browserDirectory.test-helpers'
import {
  clearBookPhotoRoot,
  clearSourceRootHandle,
  getBookPhotoRoot,
  peekSourceRootHandle,
  recallSourceRootHandle,
  rememberSourceRootHandle,
  setBookPhotoRoot,
} from './browserSourceRootHandles'
import type { SessionIdb, SessionIdbGetResult } from './idb'

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

function opts() {
  return {
    sourceRootIdb: createMemoryIdb(),
    bookPhotoRootIdb: createMemoryIdb(),
  }
}

describe('browserSourceRootHandles', () => {
  it('remembers, peeks, and clears a source-root handle', async () => {
    const options = opts()
    const handle = createFakeBrowserDirectory({ name: 'photos' })

    await expect(
      rememberSourceRootHandle('root-1', handle, options),
    ).resolves.toEqual({ ok: true, value: undefined })
    await expect(peekSourceRootHandle('root-1', options)).resolves.toEqual({
      ok: true,
      value: handle,
    })
    await expect(clearSourceRootHandle('root-1', options)).resolves.toEqual({
      ok: true,
      value: undefined,
    })
    await expect(peekSourceRootHandle('root-1', options)).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
  })

  it('peek does not require permission', async () => {
    const options = opts()
    const handle = createFakeBrowserDirectory({ name: 'denied-peek' })
    await rememberSourceRootHandle('root-peek', handle, options)
    handle.setPermission('denied')

    await expect(peekSourceRootHandle('root-peek', options)).resolves.toEqual({
      ok: true,
      value: handle,
    })
  })

  it('returns not-found when stored value is not a directory handle', async () => {
    const options = opts()
    await options.sourceRootIdb.set('root-1', { kind: 'file', name: 'x' })
    await options.sourceRootIdb.set('root-2', 'plain-string')
    await options.sourceRootIdb.set('root-3', null)

    await expect(recallSourceRootHandle('root-1', options)).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(recallSourceRootHandle('root-2', options)).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(recallSourceRootHandle('root-3', options)).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
  })

  it('treats a handle without queryPermission as granted', async () => {
    const options = opts()
    const handle = {
      kind: 'directory' as const,
      name: 'no-query',
    }
    await options.sourceRootIdb.set('root-1', handle)

    await expect(recallSourceRootHandle('root-1', options)).resolves.toEqual({
      ok: true,
      value: handle,
    })
  })

  it('queries permission with read mode', async () => {
    const options = opts()
    const modes: (string | undefined)[] = []
    const handle = createFakeBrowserDirectory({ name: 'mode-check' })
    const query = handle.queryPermission.bind(handle)
    handle.queryPermission = (descriptor) => {
      modes.push(descriptor?.mode)
      return query(descriptor)
    }
    await options.sourceRootIdb.set('root-1', handle)

    await recallSourceRootHandle('root-1', options)

    expect(modes).toEqual(['read'])
  })

  it('sets, gets, and clears a book photo root binding', async () => {
    const options = opts()

    await expect(
      setBookPhotoRoot(
        'book-1',
        { sourceRootId: 'root-1', label: 'Vacation' },
        options,
      ),
    ).resolves.toEqual({ ok: true, value: undefined })
    await expect(getBookPhotoRoot('book-1', options)).resolves.toEqual({
      ok: true,
      value: { sourceRootId: 'root-1', label: 'Vacation' },
    })
    await expect(clearBookPhotoRoot('book-1', options)).resolves.toEqual({
      ok: true,
      value: undefined,
    })
    await expect(getBookPhotoRoot('book-1', options)).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
  })

  it('rejects empty ids and malformed book photo root records', async () => {
    const options = opts()

    await expect(
      rememberSourceRootHandle('', createFakeBrowserDirectory(), options),
    ).resolves.toEqual({ ok: false, code: 'not-found' })
    await expect(clearSourceRootHandle('', options)).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(peekSourceRootHandle('', options)).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(getBookPhotoRoot('', options)).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(clearBookPhotoRoot('', options)).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(
      setBookPhotoRoot('book-1', { sourceRootId: '' }, options),
    ).resolves.toEqual({ ok: false, code: 'not-found' })
    await expect(
      setBookPhotoRoot('', { sourceRootId: 'root-1' }, options),
    ).resolves.toEqual({ ok: false, code: 'not-found' })
    await options.bookPhotoRootIdb.set('book-bad', { label: 'no-root' })
    await expect(getBookPhotoRoot('book-bad', options)).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(clearBookPhotoRoot('missing-book', options)).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(
      clearSourceRootHandle('missing-root', options),
    ).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
  })
})

describe('FSA permission Done-when via hasReadPermission / recallSourceRootHandle', () => {
  it('deny: queryPermission denied → recallSourceRootHandle permission-required', async () => {
    const options = opts()
    const handle = createFakeBrowserDirectory({ name: 'deny-path' })
    await rememberSourceRootHandle('root-deny', handle, options)
    handle.setPermission('denied')

    await expect(recallSourceRootHandle('root-deny', options)).resolves.toEqual(
      {
        ok: false,
        code: 'permission-required',
      },
    )
  })

  it('prompt: queryPermission prompt → recallSourceRootHandle permission-required', async () => {
    const options = opts()
    const handle = createFakeBrowserDirectory({ name: 'prompt-path' })
    await rememberSourceRootHandle('root-prompt', handle, options)
    handle.setPermission('prompt')

    await expect(
      recallSourceRootHandle('root-prompt', options),
    ).resolves.toEqual({
      ok: false,
      code: 'permission-required',
    })
  })

  it('re-grant: requestPermission granted updates sticky → recall succeeds', async () => {
    const options = opts()
    const handle = createFakeBrowserDirectory({
      name: 'regrant-path',
      initialPermission: 'denied',
    })
    await rememberSourceRootHandle('root-regrant', handle, options)

    await expect(
      recallSourceRootHandle('root-regrant', options),
    ).resolves.toEqual({
      ok: false,
      code: 'permission-required',
    })

    handle.enqueueRequestResults('granted')
    await expect(handle.requestPermission({ mode: 'read' })).resolves.toBe(
      'granted',
    )

    const recalled = await recallSourceRootHandle('root-regrant', options)
    expect(recalled).toEqual({ ok: true, value: handle })
  })
})
