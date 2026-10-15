import { describe, expect, it } from 'vitest'

import type { SessionDirectoryHandle, SessionState } from './types'

export interface SessionStateContractHarness {
  session: SessionState
  setPermissionRequired: (required: boolean) => void
  createHandle: () => SessionDirectoryHandle
}

export function runSessionStateContract(
  createHarness: () => SessionStateContractHarness,
): void {
  describe('SessionState contract', () => {
    it('recalls not-found when no handle was remembered', async () => {
      const { session } = createHarness()

      const recalled = await session.recallLibraryHandle('lib-1')

      expect(recalled).toEqual({ ok: false, code: 'not-found' })
    })

    it('round-trips remember then recall for the same handle', async () => {
      const { session, createHandle } = createHarness()
      const handle = createHandle()

      const remembered = await session.rememberLibraryHandle('lib-1', handle)
      const recalled = await session.recallLibraryHandle('lib-1')

      expect(remembered).toEqual({ ok: true, value: undefined })
      expect(recalled).toEqual({ ok: true, value: handle })
    })

    it('clears a remembered handle so recall is not-found', async () => {
      const { session, createHandle } = createHarness()
      await session.rememberLibraryHandle('lib-1', createHandle())

      const cleared = await session.clearLibraryHandle('lib-1')
      const recalled = await session.recallLibraryHandle('lib-1')

      expect(cleared).toEqual({ ok: true, value: undefined })
      expect(recalled).toEqual({ ok: false, code: 'not-found' })
    })

    it('returns not-found when clearing a missing library id', async () => {
      const { session } = createHarness()

      const cleared = await session.clearLibraryHandle('missing')

      expect(cleared).toEqual({ ok: false, code: 'not-found' })
    })

    it('allows a second acquire after release', async () => {
      const { session } = createHarness()

      const first = await session.acquireBookLock('book-1')
      expect(first.ok).toBe(true)
      if (!first.ok) {
        return
      }
      await first.value.release()

      const second = await session.acquireBookLock('book-1')
      expect(second.ok).toBe(true)
      if (second.ok) {
        await second.value.release()
      }
    })

    it('returns locked-elsewhere while another holder keeps the lock', async () => {
      const { session } = createHarness()

      const first = await session.acquireBookLock('book-1')
      expect(first.ok).toBe(true)
      if (!first.ok) {
        return
      }

      const second = await session.acquireBookLock('book-1')
      expect(second).toEqual({ ok: false, code: 'locked-elsewhere' })

      await first.value.release()
    })

    it('returns permission-required on recall when permission is denied', async () => {
      const { session, setPermissionRequired, createHandle } = createHarness()
      await session.rememberLibraryHandle('lib-1', createHandle())
      setPermissionRequired(true)

      const recalled = await session.recallLibraryHandle('lib-1')

      expect(recalled).toEqual({ ok: false, code: 'permission-required' })
    })
  })
}
