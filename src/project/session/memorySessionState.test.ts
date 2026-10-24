import assert from 'node:assert/strict'
import { describe, expect, it } from 'vitest'

import { createMemorySessionState } from './memorySessionState'
import { runSessionStateContract } from './sessionState.contract.test-helpers'

runSessionStateContract(() => {
  const session = createMemorySessionState()
  return {
    session,
    setPermissionRequired: session.setPermissionRequired,
    createHandle: () => ({ name: `memory-handle-${String(Math.random())}` }),
  }
})

describe('createMemorySessionState', () => {
  it('keeps handle object identity across remember and recall', async () => {
    const session = createMemorySessionState()
    const handle = { id: 'same' }

    await session.rememberLibraryHandle('lib-a', handle)
    const recalled = await session.recallLibraryHandle('lib-a')

    expect(recalled).toEqual({ ok: true, value: handle })
    assert.equal(recalled.ok, true)
    expect(recalled.value).toBe(handle)
  })

  it('returns permission-required for remember, clear, and acquire when gated', async () => {
    const session = createMemorySessionState()
    session.setPermissionRequired(true)

    await expect(
      session.rememberLibraryHandle('lib-a', { id: 1 }),
    ).resolves.toEqual({ ok: false, code: 'permission-required' })
    await expect(session.clearLibraryHandle('lib-a')).resolves.toEqual({
      ok: false,
      code: 'permission-required',
    })
    await expect(session.acquireBookLock('book-a')).resolves.toEqual({
      ok: false,
      code: 'permission-required',
    })
  })

  it('rejects recall/peek/clear/label for the wrong or empty library id', async () => {
    const session = createMemorySessionState()
    await session.rememberLibraryHandle('lib-a', { name: 'A' }, 'A')

    await expect(session.recallLibraryHandle('lib-b')).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(session.peekLibraryHandle('lib-b')).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(session.clearLibraryHandle('lib-b')).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(session.getLibraryLabel('lib-b')).resolves.toBeNull()
    await expect(session.getLibraryLabel('lib-a')).resolves.toBe('A')

    await session.clearLibraryHandle('lib-a')
    await expect(session.getLibraryLabel('lib-a')).resolves.toBeNull()
    await expect(session.recallLibraryHandle('lib-a')).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
  })

  it('rejects reserved keys on recall and peek while a library is remembered', async () => {
    const session = createMemorySessionState()
    await session.rememberLibraryHandle('lib-a', { name: 'A' }, 'A')

    await expect(session.recallLibraryHandle('__recents')).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(session.peekLibraryHandle('__active')).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(session.clearLibraryHandle('__libraryLabel')).resolves.toEqual(
      {
        ok: false,
        code: 'not-found',
      },
    )
    await expect(session.getLibraryLabel('lib-a')).resolves.toBe('A')
  })
})
