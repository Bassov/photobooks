import { describe, expect, it, vi } from 'vitest'
import type { ExportFileHandle } from '../../project'
import {
  createPrintStore,
  PRINT_IDLE,
  reducePrint,
  type PrintOutcome,
  type PrintState,
} from './printStore'

const handle = { kind: 'file', name: 'a.pdf' } as ExportFileHandle
const outcome: PrintOutcome = {
  file: 'a.pdf',
  sheets: 20,
  bytes: 1_200_000,
  skipped: { count: 0, pages: [] },
  handle,
  library: 'Photobooks',
}
const running: PrintState = {
  kind: 'running',
  painted: 10,
  sheets: 20,
  percent: 48,
  saving: false,
}

describe('reducePrint', () => {
  it('starts at page 0 of the sheets, never twice', () => {
    expect(reducePrint(PRINT_IDLE, { type: 'start', sheets: 20 })).toEqual({
      kind: 'running',
      painted: 0,
      sheets: 20,
      percent: 0,
      saving: false,
    })
    expect(reducePrint(running, { type: 'start', sheets: 4 })).toBe(running)
  })

  it('turns painted sheets into 95 % and never goes back', () => {
    expect(reducePrint(running, { type: 'progress', painted: 20 })).toEqual({
      ...running,
      painted: 20,
      percent: 95,
    })
    expect(reducePrint(running, { type: 'progress', painted: 10 })).toBe(
      running,
    )
    expect(reducePrint(PRINT_IDLE, { type: 'progress', painted: 3 })).toBe(
      PRINT_IDLE,
    )
  })

  it('saves at 97 % and ignores late paint progress', () => {
    const saving = reducePrint(running, { type: 'saving' })
    expect(saving).toEqual({
      ...running,
      painted: 20,
      percent: 97,
      saving: true,
    })
    expect(reducePrint(saving, { type: 'saving' })).toBe(saving)
    expect(reducePrint(saving, { type: 'progress', painted: 21 })).toBe(saving)
    expect(reducePrint(PRINT_IDLE, { type: 'saving' })).toBe(PRINT_IDLE)
  })

  it('ends a run as done or failed; idle ignores both', () => {
    expect(reducePrint(running, { type: 'done', ...outcome })).toEqual({
      kind: 'done',
      ...outcome,
    })
    expect(
      reducePrint(running, { type: 'failed', code: 'full', library: 'L' }),
    ).toEqual({ kind: 'failed', code: 'full', library: 'L' })
    expect(reducePrint(PRINT_IDLE, { type: 'done', ...outcome })).toBe(
      PRINT_IDLE,
    )
    expect(
      reducePrint(PRINT_IDLE, { type: 'failed', code: 'full', library: 'L' }),
    ).toBe(PRINT_IDLE)
  })

  it('expires only done and clears only a seen failure', () => {
    const done: PrintState = { kind: 'done', ...outcome }
    const failed: PrintState = { kind: 'failed', code: 'other', library: 'L' }
    expect(reducePrint(done, { type: 'expire' })).toBe(PRINT_IDLE)
    expect(reducePrint(failed, { type: 'expire' })).toBe(failed)
    expect(reducePrint(failed, { type: 'seen' })).toBe(PRINT_IDLE)
    expect(reducePrint(done, { type: 'seen' })).toBe(done)
  })
})

describe('createPrintStore', () => {
  it('shows PDF ready for 4 s, then rests', () => {
    let timers: { at: number; run: () => void }[] = []
    let now = 0
    const store = createPrintStore({
      now: () => now,
      setTimer: (run, ms) => {
        timers.push({ at: now + ms, run })
        return 0 as unknown as ReturnType<typeof setTimeout>
      },
      clearTimer: () => {
        timers = []
      },
      requestFrame: (run) => {
        run()
      },
    })
    const listener = vi.fn()
    store.subscribe(listener)

    store.dispatch({ type: 'start', sheets: 2 })
    store.dispatch({ type: 'done', ...outcome })
    expect(store.getSnapshot().kind).toBe('done')
    now = 4000
    for (const timer of timers.filter((t) => t.at <= now)) timer.run()

    expect(store.getSnapshot()).toBe(PRINT_IDLE)
    expect(listener).toHaveBeenCalledTimes(3)
  })
})
