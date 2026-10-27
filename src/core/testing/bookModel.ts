import assert from 'node:assert/strict'
import { fc } from '@fast-check/vitest'
import { applyBookOp, type BookOp } from '../ops/applyBookOp'
import type { Book } from '../schema'
import { TEMPLATE_IDS, contactSheetId } from '../templates/types'

/** Simple reference model of the book: gallery order plus per-frame placement. */
interface ModelFrame {
  id: string
  assetId?: string
}

interface ModelSpread {
  id: string
  frames: ModelFrame[]
}

export interface BookModel {
  gallery: string[]
  spreads: ModelSpread[]
  serial: number
}

export interface BookRun {
  book: Book
}

type ApplyOp = (book: Book, op: BookOp) => Book

const ASSET_POOL = ['a0', 'a1', 'a2', 'a3', 'a4', 'a5'] as const

export function modelOf(book: Book): BookModel {
  return {
    gallery: [...book.gallery],
    spreads: book.spreads.map((spread) => ({
      id: spread.id,
      frames: spread.frames.map((frame) =>
        frame.assetId === undefined
          ? { id: frame.id }
          : { id: frame.id, assetId: frame.assetId },
      ),
    })),
    serial: 0,
  }
}

function findFrame(
  model: BookModel,
  spreadId: string,
  frameId: string,
): ModelFrame | undefined {
  return model.spreads
    .find((spread) => spread.id === spreadId)
    ?.frames.find((frame) => frame.id === frameId)
}

function clearAsset(frame: ModelFrame): void {
  delete frame.assetId
}

/**
 * Reference semantics of one op. Template-driven frame counts are the only
 * thing taken from the real book (`syncFrameCounts`).
 */
function reduceModel(model: BookModel, op: BookOp): void {
  switch (op.type) {
    case 'addToGallery':
      for (const assetId of op.assetIds) {
        if (!model.gallery.includes(assetId)) {
          model.gallery.push(assetId)
        }
      }
      return
    case 'removeFromGallery':
    case 'removeManyFromGallery': {
      const gone = new Set(
        op.type === 'removeFromGallery' ? [op.assetId] : op.assetIds,
      )
      model.gallery = model.gallery.filter((id) => !gone.has(id))
      for (const spread of model.spreads) {
        for (const frame of spread.frames) {
          if (frame.assetId !== undefined && gone.has(frame.assetId)) {
            clearAsset(frame)
          }
        }
      }
      return
    }
    case 'place': {
      const frame = findFrame(model, op.spreadId, op.frameId)
      if (
        frame !== undefined &&
        frame.assetId === undefined &&
        model.gallery.includes(op.assetId)
      ) {
        frame.assetId = op.assetId
      }
      return
    }
    case 'replace': {
      const frame = findFrame(model, op.spreadId, op.frameId)
      if (frame !== undefined && model.gallery.includes(op.assetId)) {
        frame.assetId = op.assetId
      }
      return
    }
    case 'unplace': {
      const frame = findFrame(model, op.spreadId, op.frameId)
      if (frame !== undefined) {
        clearAsset(frame)
      }
      return
    }
    case 'swap': {
      const a = findFrame(model, op.spreadIdA, op.frameIdA)
      const b = findFrame(model, op.spreadIdB, op.frameIdB)
      if (a === undefined || b === undefined || a === b) {
        return
      }
      const assetA = a.assetId
      const assetB = b.assetId
      clearAsset(a)
      clearAsset(b)
      if (assetB !== undefined) {
        a.assetId = assetB
      }
      if (assetA !== undefined) {
        b.assetId = assetA
      }
      return
    }
    case 'addSpread': {
      const at = Math.max(
        0,
        Math.min(op.index ?? model.spreads.length, model.spreads.length),
      )
      model.spreads.splice(at, 0, { id: op.id ?? '', frames: [] })
      return
    }
    case 'removeSpread':
      if (
        model.spreads.length > 1 &&
        model.spreads.some((spread) => spread.id === op.spreadId)
      ) {
        model.spreads = model.spreads.filter(
          (spread) => spread.id !== op.spreadId,
        )
      }
      return
    case 'duplicateSpread': {
      const at = model.spreads.findIndex((spread) => spread.id === op.spreadId)
      const source = model.spreads[at]
      if (source !== undefined) {
        model.spreads.splice(at + 1, 0, {
          id: op.id ?? '',
          frames: source.frames.map((frame) => ({ ...frame })),
        })
      }
      return
    }
    case 'moveSpread': {
      const from = model.spreads.findIndex(
        (spread) => spread.id === op.spreadId,
      )
      if (from < 0) {
        return
      }
      const to = Math.max(0, Math.min(op.toIndex, model.spreads.length - 1))
      const moved = model.spreads.splice(from, 1)
      model.spreads.splice(to, 0, ...moved)
      return
    }
    case 'applyTemplate':
    case 'setTitle':
      return
  }
}

/**
 * Template ops re-flow frames (count depends on page role). The model keeps
 * the placement prefix by index and adopts only the count and new frame ids.
 */
function syncFrameCounts(model: BookModel, book: Book): void {
  for (const spread of model.spreads) {
    const real = book.spreads.find((candidate) => candidate.id === spread.id)
    if (real === undefined) {
      continue
    }
    spread.frames = real.frames.map((frame, index) => {
      const previous = spread.frames[index]
      return previous ?? { id: frame.id }
    })
  }
}

/** Throws when the real book disagrees with the model or breaks invariants. */
export function assertAgrees(model: BookModel, book: Book): void {
  assert.deepEqual(book.gallery, model.gallery, 'gallery')
  assert.deepEqual(
    Object.keys(book.assets).sort(),
    [...model.gallery].sort(),
    'assets keys = gallery',
  )
  assert.deepEqual(
    book.spreads.map((spread) => spread.id),
    model.spreads.map((spread) => spread.id),
    'spread order',
  )
  const expectedCounts = new Map<string, number>()
  for (const [spreadIndex, spread] of book.spreads.entries()) {
    const expected = model.spreads[spreadIndex]
    assert.ok(expected !== undefined)
    assert.deepEqual(
      spread.frames.map((frame) => ({ id: frame.id, assetId: frame.assetId })),
      expected.frames.map((frame) => ({
        id: frame.id,
        assetId: frame.assetId,
      })),
      `frames of ${spread.id}`,
    )
    for (const frame of spread.frames) {
      assert.equal(
        (frame.crop === undefined) === (frame.assetId === undefined),
        true,
        'crop only with asset',
      )
      if (frame.assetId !== undefined) {
        expectedCounts.set(
          frame.assetId,
          (expectedCounts.get(frame.assetId) ?? 0) + 1,
        )
      }
    }
  }
  const actualCounts = new Map<string, number>()
  for (const spread of book.spreads) {
    for (const frame of spread.frames) {
      if (frame.assetId !== undefined) {
        actualCounts.set(
          frame.assetId,
          (actualCounts.get(frame.assetId) ?? 0) + 1,
        )
      }
    }
  }
  assert.deepEqual(actualCounts, expectedCounts, 'placement counts')
}

class OpCommand implements fc.Command<BookModel, BookRun> {
  constructor(
    private readonly label: string,
    private readonly resolve: (
      model: Readonly<BookModel>,
    ) => BookOp | undefined,
    private readonly apply: ApplyOp,
    private readonly parse: (book: Book) => void,
  ) {}

  check(model: Readonly<BookModel>): boolean {
    return this.resolve(model) !== undefined
  }

  run(model: BookModel, run: BookRun): void {
    const op = this.resolve(model)
    if (op === undefined) {
      return
    }
    run.book = this.apply(run.book, op)
    reduceModel(model, op)
    if (op.type === 'addSpread') {
      model.serial += 1
    }
    if (
      op.type === 'applyTemplate' ||
      op.type === 'addSpread' ||
      op.type === 'removeSpread' ||
      op.type === 'moveSpread'
    ) {
      syncFrameCounts(model, run.book)
    }
    this.parse(run.book)
    assertAgrees(model, run.book)
  }

  toString(): string {
    return this.label
  }
}

function pick<T>(items: readonly T[], index: number): T | undefined {
  return items.length === 0 ? undefined : items[index % items.length]
}

function frameAt(
  model: Readonly<BookModel>,
  spreadIndex: number,
  frameIndex: number,
): { spreadId: string; frameId: string } | undefined {
  const spread = pick(model.spreads, spreadIndex)
  const frame =
    spread === undefined ? undefined : pick(spread.frames, frameIndex)
  return spread === undefined || frame === undefined
    ? undefined
    : { spreadId: spread.id, frameId: frame.id }
}

export interface CommandOptions {
  /** Op applier under test (defaults to the real `applyBookOp`). */
  apply?: ApplyOp
  /** Asserts the book round-trips through the parser. */
  parse: (book: Book) => void
}

/** Named, replayable command constructors (also used for regression cases). */
export function commandFactories(options: CommandOptions) {
  const apply = options.apply ?? applyBookOp
  const make = (
    label: string,
    resolve: (model: Readonly<BookModel>) => BookOp | undefined,
  ): fc.Command<BookModel, BookRun> =>
    new OpCommand(label, resolve, apply, options.parse)
  const asset = (i: number): string => ASSET_POOL[i % ASSET_POOL.length] ?? 'a0'

  return {
    addToGallery: (assets: readonly number[]) =>
      make(`addToGallery(${assets.map(asset).join(',')})`, () => ({
        type: 'addToGallery',
        assetIds: assets.map(asset),
      })),
    removeFromGallery: (a: number) =>
      make(`removeFromGallery(${asset(a)})`, () => ({
        type: 'removeFromGallery',
        assetId: asset(a),
      })),
    place: (s: number, f: number, a: number) =>
      make(`place(s${String(s)},f${String(f)},${asset(a)})`, (model) => {
        const at = frameAt(model, s, f)
        return at && { type: 'place', ...at, assetId: asset(a) }
      }),
    replace: (s: number, f: number, a: number) =>
      make(`replace(s${String(s)},f${String(f)},${asset(a)})`, (model) => {
        const at = frameAt(model, s, f)
        return at && { type: 'replace', ...at, assetId: asset(a) }
      }),
    unplace: (s: number, f: number) =>
      make(`unplace(s${String(s)},f${String(f)})`, (model) => {
        const at = frameAt(model, s, f)
        return at && { type: 'unplace', ...at }
      }),
    swap: (sa: number, fa: number, sb: number, fb: number) =>
      make(
        `swap(s${String(sa)}f${String(fa)},s${String(sb)}f${String(fb)})`,
        (model) => {
          const a = frameAt(model, sa, fa)
          const b = frameAt(model, sb, fb)
          return (
            a &&
            b && {
              type: 'swap',
              spreadIdA: a.spreadId,
              frameIdA: a.frameId,
              spreadIdB: b.spreadId,
              frameIdB: b.frameId,
            }
          )
        },
      ),
    applyTemplate: (s: number, t: number) =>
      make(`applyTemplate(s${String(s)},t${String(t)})`, (model) => {
        const spread = pick(model.spreads, s)
        const templateId = pick(
          [...TEMPLATE_IDS, contactSheetId(2, 2), contactSheetId(3, 4)],
          t,
        )
        return (
          spread &&
          templateId && {
            type: 'applyTemplate',
            spreadId: spread.id,
            templateId,
          }
        )
      }),
    addSpread: (index: number) =>
      make(`addSpread(${String(index)})`, (model) => ({
        type: 'addSpread',
        index,
        id: `new-${String(model.serial)}`,
      })),
    removeSpread: (s: number) =>
      make(`removeSpread(s${String(s)})`, (model) => {
        const spread = pick(model.spreads, s)
        return spread && { type: 'removeSpread', spreadId: spread.id }
      }),
    moveSpread: (s: number, to: number) =>
      make(`moveSpread(s${String(s)},${String(to)})`, (model) => {
        const spread = pick(model.spreads, s)
        return (
          spread && { type: 'moveSpread', spreadId: spread.id, toIndex: to }
        )
      }),
  }
}

/** `fc.commands` arbitrary over the editor command families. */
export function bookCommands(
  options: CommandOptions,
  maxCommands = 40,
): fc.Arbitrary<Iterable<fc.Command<BookModel, BookRun>>> {
  const c = commandFactories(options)
  const idx = fc.nat(7)
  return fc.commands(
    [
      fc.array(idx, { minLength: 1, maxLength: 4 }).map(c.addToGallery),
      idx.map(c.removeFromGallery),
      fc.tuple(idx, idx, idx).map(([s, f, a]) => c.place(s, f, a)),
      fc.tuple(idx, idx, idx).map(([s, f, a]) => c.replace(s, f, a)),
      fc.tuple(idx, idx).map(([s, f]) => c.unplace(s, f)),
      fc.tuple(idx, idx, idx, idx).map(([a, b, d, e]) => c.swap(a, b, d, e)),
      fc.tuple(idx, idx).map(([s, t]) => c.applyTemplate(s, t)),
      idx.map(c.addSpread),
      idx.map(c.removeSpread),
      fc.tuple(idx, idx).map(([s, to]) => c.moveSpread(s, to)),
    ],
    { maxCommands },
  )
}
