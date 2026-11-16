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
  layout: 'single',
  sheets: 20,
  bytes: 1_200_000,
  skipped: { count: 0, pages: [], cover: false },
  handle,
  cover: { file: 'a-cover.pdf', bytes: 300_000, handle },
  library: 'Photobooks',
}
const running: PrintState = {
  kind: 'running',
  painted: 10,
  sheets: 20,
  percent: 48,
  saving: false,
  layout: 'single',
  imposing: null,
}

describe('reducePrint', () => {
  it('starts at page 0 of the sheets, never twice', () => {
    expect(reducePrint(PRINT_IDLE, { type: 'start', sheets: 20 })).toEqual({
      kind: 'running',
      painted: 0,
      sheets: 20,
      percent: 0,
      saving: false,
      layout: 'single',
      imposing: null,
    })
    expect(
      reducePrint(PRINT_IDLE, { type: 'start', sheets: 20, layout: '4up' }),
    ).toMatchObject({ layout: '4up' })
    expect(reducePrint(running, { type: 'start', sheets: 4 })).toBe(running)
  })

  it('paints a booklet to 80 %, then imposes to 95 %, never back', () => {
    const booklet: PrintState = { ...running, layout: '2up' }
    expect(reducePrint(booklet, { type: 'progress', painted: 20 })).toEqual({
      ...booklet,
      painted: 20,
      percent: 80,
    })
    const started = reducePrint(booklet, {
      type: 'imposing',
      imposed: 0,
      sheets: 5,
    })
    expect(started).toEqual({
      ...booklet,
      painted: 20,
      percent: 80,
      imposing: { imposed: 0, sheets: 5 },
    })
    const imposed = reducePrint(started, {
      type: 'imposing',
      imposed: 5,
      sheets: 5,
    })
    expect(imposed).toMatchObject({
      percent: 95,
      imposing: { imposed: 5, sheets: 5 },
    })
    expect(
      reducePrint(imposed, { type: 'imposing', imposed: 5, sheets: 5 }),
    ).toBe(imposed)
    expect(
      reducePrint(imposed, { type: 'imposing', imposed: 2, sheets: 5 }),
    ).toBe(imposed)
    expect(reducePrint(imposed, { type: 'progress', painted: 21 })).toBe(
      imposed,
    )
    const saving = reducePrint(imposed, { type: 'saving' })
    expect(
      reducePrint(saving, { type: 'imposing', imposed: 6, sheets: 5 }),
    ).toBe(saving)
    expect(
      reducePrint(PRINT_IDLE, { type: 'imposing', imposed: 1, sheets: 5 }),
    ).toBe(PRINT_IDLE)
  })

  it('turns painted sheets and the cover into 95 % and never goes back', () => {
    // cover-pdf §2.2: 20 sheets + the cover = 21 units.
    expect(reducePrint(running, { type: 'progress', painted: 20 })).toEqual({
      ...running,
      painted: 20,
      percent: 90,
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
