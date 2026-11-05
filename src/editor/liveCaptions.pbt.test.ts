import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fc } from '@fast-check/vitest'
import { applyBookOp, checkBookInvariants, type BookOp } from '../core'
import type { Book, Frame, Spread } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import {
  EMPTY_HISTORY,
  isUndoableOp,
  recordStep,
  redoStep,
  snapshotOf,
  undoStep,
  type History,
  type HistoryMove,
} from './bookHistory'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number; numRuns: number } }

const runs = {
  seed: gates.pbt.seed,
  numRuns: Number(process.env.FC_NUM_RUNS ?? gates.pbt.numRuns),
}

const rect = (x: number, y: number, width = 80, height = 80) => ({
  x,
  y,
  width,
  height,
})

/** Two spreads with photos, an empty frame, live and static captions; a parent. */
function initialBook(): Book {
  const frames = (prefix: string): Frame[] => [
    makeFrame({ id: `${prefix}p1`, assetId: 'a', rect: rect(10, 10) }),
    makeFrame({ id: `${prefix}p2`, z: 1, rect: rect(150, 10) }),
    makeFrame({ id: `${prefix}p3`, z: 2, assetId: 'b', rect: rect(10, 150) }),
    makeFrame({
      id: `${prefix}t1`,
      z: 3,
      kind: 'text',
      rect: rect(10, 100, 60, 6),
      content: { type: 'template', template: '{title} · {date}' },
      anchorFrameId: `${prefix}p1`,
    }),
    makeFrame({
      id: `${prefix}t2`,
      z: 4,
      kind: 'text',
      rect: rect(150, 100, 60, 6),
      content: { type: 'static', text: 'x' },
    }),
  ]
  return makeBook({
    assets: {
      a: { capturedAt: '2025:07:12 08:35:00', meta: { title: 'Lake' } },
      b: { meta: { camera: 'Canon EOS R5' } },
    },
    gallery: ['a', 'b'],
    spreads: [
      makeSpread({ id: 'spread-1', frames: frames('a') }),
      makeSpread({ id: 'spread-2', frames: frames('b') }),
    ],
    parents: [
      {
        id: 'parent-1',
        name: 'Master A',
        frames: [makeFrame({ id: 'logo', rect: rect(5, 5, 20, 20) })],
        guides: [],
      },
    ],
  })
}

/** Op intents pick spreads / frames by index into the book they run on. */
type Intent =
  | { kind: 'op'; make: (book: Book) => BookOp | undefined }
  | { kind: 'undo' }
  | { kind: 'redo' }

const pickOf =
  <T>(items: readonly T[]) =>
  (index: number): T | undefined =>
    items.length === 0 ? undefined : items[index % items.length]

function spreadAt(book: Book, index: number): Spread | undefined {
  return pickOf(book.spreads)(index)
}

function frameAt(
  book: Book,
  spreadIndex: number,
  frameIndex: number,
): { spread: Spread; frame: Frame } | undefined {
  const spread = spreadAt(book, spreadIndex)
  const frame =
    spread === undefined ? spread : pickOf(spread.frames)(frameIndex)
  return spread === undefined || frame === undefined
    ? undefined
    : { spread, frame }
}

const idx = fc.nat({ max: 20 })

const framed = (
  build: (spreadId: string, frameId: string, extra: number) => BookOp,
) =>
  fc.tuple(idx, idx, idx).map(([s, f, extra]): Intent => ({
    kind: 'op',
    make: (book) => {
      const found = frameAt(book, s, f)
      return found === undefined
        ? undefined
        : build(found.spread.id, found.frame.id, extra)
    },
  }))

const spreadOp = (build: (spreadId: string, extra: number) => BookOp) =>
  fc.tuple(idx, idx).map(([s, extra]): Intent => ({
    kind: 'op',
    make: (book) => {
      const spread = spreadAt(book, s)
      return spread === undefined ? undefined : build(spread.id, extra)
    },
  }))

const TEMPLATES = ['one-per-page', '2-up', '4-grid', 'full-bleed'] as const
const TEXTS = ['{date}', '{title} · {camera}', 'plain', '']

const intentArb: fc.Arbitrary<Intent> = fc.oneof(
  framed((spreadId, frameId, n) => ({
    type: 'setTextLive',
    spreadId,
    frameId,
    live: n % 2 === 0,
  })),
  fc.tuple(idx, idx, idx).map(([s, f, a]): Intent => ({
    kind: 'op',
    make: (book) => {
      const found = frameAt(book, s, f)
      const anchor = found && pickOf(found.spread.frames)(a)
      return found === undefined || anchor === undefined
        ? undefined
        : {
            type: 'setTextAnchor',
            spreadId: found.spread.id,
            frameId: found.frame.id,
            anchorFrameId: anchor.id,
          }
    },
  })),
  framed((spreadId, frameId, n) => ({
    type: 'editText',
    spreadId,
    frameId,
    text: TEXTS[n % TEXTS.length] ?? '',
  })),
  framed((spreadId, frameId) => ({
    type: 'removeFrames',
    spreadId,
    frameIds: [frameId],
  })),
  framed((spreadId, frameId) => ({ type: 'unplace', spreadId, frameId })),
  framed((spreadId, frameId, n) => ({
    type: 'place',
    spreadId,
    frameId,
    assetId: n % 2 === 0 ? 'a' : 'b',
  })),
  framed((spreadId, frameId, n) => ({
    type: 'moveFrame',
    spreadId,
    frameId,
    dx: n - 10,
    dy: 5,
  })),
  spreadOp((spreadId) => ({ type: 'duplicateSpread', spreadId })),
  spreadOp((spreadId) => ({ type: 'removeSpread', spreadId })),
  spreadOp((spreadId, n) => ({ type: 'moveSpread', spreadId, toIndex: n })),
  spreadOp((spreadId, n) => ({
    type: 'applyTemplate',
    spreadId,
    templateId: TEMPLATES[n % TEMPLATES.length] ?? 'one-per-page',
  })),
  spreadOp((spreadId, n) => ({
    type: 'addTextFrame',
    spreadId,
    rect: rect(n * 5, 120, 40, 6),
  })),
  spreadOp((spreadId, n) => ({
    type: 'addFrame',
    spreadId,
    rect: rect(n * 7, 40, 30, 30),
  })),
  spreadOp((spreadId, n) => ({
    type: 'setSpreadParent',
    spreadId,
    parentId: n % 2 === 0 ? 'parent-1' : null,
  })),
  spreadOp((spreadId) => ({ type: 'resetSpreadToParent', spreadId })),
  fc.constant<Intent>({ kind: 'undo' }),
  fc.constant<Intent>({ kind: 'redo' }),
)

interface Run {
  book: Book
  history: History
}

function moved(book: Book, move: HistoryMove | null, run: Run): Run {
  return move === null
    ? run
    : { book: { ...book, ...move.snapshot }, history: move.history }
}

function step(run: Run, intent: Intent): Run {
  const { book, history } = run
  if (intent.kind === 'undo') {
    return moved(book, undoStep(history, snapshotOf(book)), run)
  }
  if (intent.kind === 'redo') {
    return moved(book, redoStep(history, snapshotOf(book)), run)
  }
  const op = intent.make(book)
  if (op === undefined) {
    return run
  }
  const next = applyBookOp(book, op)
  if (next === book || !isUndoableOp(op)) {
    return { book: next, history }
  }
  return {
    book: next,
    history: recordStep(history, snapshotOf(book), undefined),
  }
}

describe('live caption anchors under random user ops', () => {
  it('never trip bad-text-anchor, including undo and redo', () => {
    fc.assert(
      fc.property(fc.array(intentArb, { maxLength: 40 }), (intents) => {
        let run: Run = { book: initialBook(), history: EMPTY_HISTORY }
        for (const intent of intents) {
          run = step(run, intent)
          expect(checkBookInvariants(run.book)).toEqual({ ok: true })
        }
      }),
      runs,
    )
  })

  it('undo after deleting the anchor restores the live caption', () => {
    const before = initialBook()
    let run: Run = { book: before, history: EMPTY_HISTORY }
    run = step(run, {
      kind: 'op',
      make: () => ({
        type: 'removeFrames',
        spreadId: 'spread-1',
        frameIds: ['ap1'],
      }),
    })
    const frozen = run.book.spreads[0]?.frames.find((f) => f.id === 'at1')
    expect(frozen?.content).toEqual({
      type: 'static',
      text: 'Lake · 12 Jul 2025',
    })
    run = step(run, { kind: 'undo' })
    expect(run.book.spreads).toBe(before.spreads)
  })
})
