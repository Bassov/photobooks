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
    if (recalled.ok) {
      expect(recalled.value).toBe(handle)
    }
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
})
