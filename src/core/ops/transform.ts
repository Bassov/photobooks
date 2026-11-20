import { clampCrop, shownCropRect } from '../geometry/cropRect'
import { orientedAspect } from '../pdf/pdfGeometry'
import { spreadFrames, updateSpread, withChangedCopies } from '../update'
import type { Book, Frame } from '../schema'
import { MIN_FRAME_EDGE_MM, detached } from './frames'

type Rect = Frame['rect']
type Crop = NonNullable<Frame['crop']>

export type AlignEdge =
  'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY'

export type DistributeAxis = 'horizontal' | 'vertical'

/**
 * Locked frames are skipped: every op below returns the book unchanged for
 * them. Local copies of parent items move too; only own frames detach.
 */
function transformFrames(
  book: Book,
  spreadId: string,
  frameIds: readonly string[],
  next: (frames: Frame[]) => Map<string, Frame>,
): Book {
  return updateSpread(book, spreadId, (spread) => {
    const wanted = new Set(frameIds)
    const targets = spreadFrames(spread).filter(
      (frame) => wanted.has(frame.id) && frame.locked !== true,
    )
    const changed = next(targets)
    if (changed.size === 0) {
      return spread
    }
    const own = spread.frames.some((frame) => changed.has(frame.id))
      ? detached(
          spread,
          spread.frames.map((frame) => changed.get(frame.id) ?? frame),
        )
      : spread
    return withChangedCopies(own, changed)
  })
}

function sameRect(a: Rect, b: Rect): boolean {
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  )
}

function finiteRect(rect: Rect): boolean {
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height)
  )
}

/** Translate one frame by (dx, dy) mm. Non-finite or zero delta, locked → unchanged. */
export function moveFrame(
  book: Book,
  spreadId: string,
  frameId: string,
  dx: number,
  dy: number,
): Book {
  return moveFrames(book, spreadId, [frameId], dx, dy)
}

/**
 * Translate every listed frame by the same (dx, dy) mm (group move, one undo
 * step). Locked frames stay; non-finite or zero delta → unchanged.
 */
export function moveFrames(
  book: Book,
  spreadId: string,
  frameIds: readonly string[],
  dx: number,
  dy: number,
): Book {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) {
    return book
  }
  return transformFrames(
    book,
    spreadId,
    frameIds,
    (frames) =>
      new Map(
        frames.map((frame) => [
          frame.id,
          {
            ...frame,
            rect: { ...frame.rect, x: frame.rect.x + dx, y: frame.rect.y + dy },
          },
        ]),
      ),
  )
}

/**
 * Set one frame's rect (resize, with the origin free to move for edge handles).
 * An edge under `MIN_FRAME_EDGE_MM`, a non-finite value, an identical rect or a
 * locked frame → unchanged.
 */
export function resizeFrame(
  book: Book,
  spreadId: string,
  frameId: string,
  rect: Rect,
): Book {
  return resizeOne(book, spreadId, frameId, rect, (frame) => ({
    ...frame,
    rect,
  }))
}

/**
 * Resize one frame with its photo fixed on the page (direct crop): the crop is
 * recomputed so the photo keeps its page size and place. In Fill a photo that
 * would no longer cover the frame scales up by the minimum about the frame
 * edge / corner opposite the moved one; Fit has no cover scale. Guards as
 * `resizeFrame`; a frame without a photo just takes the rect. `aspectRatio`
 * (the shown photo's) defaults to the asset record's oriented pixel size.
 */
export function resizeFrameKeepPhoto(
  book: Book,
  spreadId: string,
  frameId: string,
  rect: Rect,
  aspectRatio?: number,
): Book {
  return resizeOne(book, spreadId, frameId, rect, (frame) =>
    frame.assetId === undefined
      ? { ...frame, rect }
      : keepPhoto(frame, rect, aspectRatio ?? assetAspect(book, frame.assetId)),
  )
}

function resizeOne(
  book: Book,
  spreadId: string,
  frameId: string,
  rect: Rect,
  resized: (frame: Frame) => Frame,
): Book {
  if (
    !finiteRect(rect) ||
    rect.width < MIN_FRAME_EDGE_MM ||
    rect.height < MIN_FRAME_EDGE_MM
  ) {
    return book
  }
  return transformFrames(book, spreadId, [frameId], (frames) => {
    const changed = new Map<string, Frame>()
    const frame = frames[0]
    if (frame !== undefined && !sameRect(frame.rect, rect)) {
      changed.set(frame.id, resized(frame))
    }
    return changed
  })
}

interface Vec {
  x: number
  y: number
}

/** Edges at most this far apart (mm, ~1e-6) count as not moved by a resize. */
const FIXED_EDGE_MM = 2 ** -20

const COVER: Crop = { zoom: 1, center: { x: 0.5, y: 0.5 } }

/** NaN without a pixel size: `shownCropRect` reads that as a square photo. */
function assetAspect(book: Book, assetId: string): number {
  const asset = book.assets[assetId]
  return orientedAspect(
    asset?.widthPx ?? Number.NaN,
    asset?.heightPx ?? Number.NaN,
    asset?.orientation,
  )
}

/** Clockwise on a y-down page, like CSS `rotate()`. */
function turned(v: Vec, deg: number): Vec {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos }
}

function centreOf(rect: Rect): Vec {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

/**
 * The photo is `size` mm with its centre `offset` mm from the frame centre, in
 * photo axes (frame rotation + straighten about the frame centre), as the
 * painters lay it out from the shown crop window.
 */
function keepPhoto(frame: Frame, rect: Rect, aspect: number): Frame {
  const crop = frame.crop ?? COVER
  const straightenDeg = crop.straightenDeg ?? 0
  const photoDeg = (frame.rotationDeg ?? 0) + straightenDeg
  const win = shownCropRect(frame.rect, crop, aspect, frame.fit)
  const size = {
    x: frame.rect.width / win.width,
    y: frame.rect.height / win.height,
  }
  const prevCentre = centreOf(frame.rect)
  const nextCentre = centreOf(rect)
  const shift = turned(
    { x: prevCentre.x - nextCentre.x, y: prevCentre.y - nextCentre.y },
    -photoDeg,
  )
  const offset = {
    x: (0.5 - win.x - win.width / 2) * size.x + shift.x,
    y: (0.5 - win.y - win.height / 2) * size.y + shift.y,
  }
  const anchor = turned(fixedPoint(frame, rect), -straightenDeg)
  const k =
    frame.fit === 'fit'
      ? 1
      : coverScale(offset, size, coverBox(rect, straightenDeg), anchor)
  const photoW = k * size.x
  const photoH = k * size.y
  const centre = {
    x: anchor.x + k * (offset.x - anchor.x),
    y: anchor.y + k * (offset.y - anchor.y),
  }
  // The window shrinks as 1 / zoom: compare with the zoom-1 window.
  const base = shownCropRect(rect, { ...crop, zoom: 1 }, aspect, frame.fit)
  const next = clampCrop(
    rect,
    {
      ...crop,
      zoom: (base.width * photoW) / rect.width,
      center: { x: 0.5 - centre.x / photoW, y: 0.5 - centre.y / photoH },
    },
    aspect,
    frame.fit,
  )
  return { ...frame, rect, crop: next }
}

/**
 * The point of the new frame (from its centre, frame axes) that a resize
 * leaves in place: the edge or corner opposite the moved one; the centre on an
 * axis where both or neither edge moved.
 */
function fixedPoint(frame: Frame, rect: Rect): Vec {
  const prev = frame.rect
  const prevCentre = centreOf(prev)
  const nextCentre = centreOf(rect)
  const was = turned(
    { x: prevCentre.x - nextCentre.x, y: prevCentre.y - nextCentre.y },
    -(frame.rotationDeg ?? 0),
  )
  return {
    x: fixedOnAxis(was.x, prev.width / 2, rect.width / 2),
    y: fixedOnAxis(was.y, prev.height / 2, rect.height / 2),
  }
}

function fixedOnAxis(was: number, wasHalf: number, half: number): number {
  const lowFixed = Math.abs(was - wasHalf + half) <= FIXED_EDGE_MM
  const highFixed = Math.abs(was + wasHalf - half) <= FIXED_EDGE_MM
  if (lowFixed === highFixed) {
    return 0
  }
  return lowFixed ? -half : half
}

/** Half size of what the photo must cover: the frame, straightened. */
function coverBox(rect: Rect, straightenDeg: number): Vec {
  const rad = (Math.abs(straightenDeg) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: (rect.width * cos + rect.height * sin) / 2,
    y: (rect.width * sin + rect.height * cos) / 2,
  }
}

/** Least scale ≥ 1 about `anchor` that makes the photo contain the box. */
function coverScale(offset: Vec, size: Vec, box: Vec, anchor: Vec): number {
  return Math.max(
    1,
    axisCoverScale(offset.x, size.x / 2, box.x, anchor.x),
    axisCoverScale(offset.y, size.y / 2, box.y, anchor.y),
  )
}

function axisCoverScale(
  centre: number,
  half: number,
  boxHalf: number,
  anchor: number,
): number {
  // Photo edges relative to the anchor; an edge on the anchor's far side
  // cannot be fixed by scaling (`clampCrop` pans it).
  const low = centre - half - anchor
  const high = centre + half - anchor
  return Math.max(
    low < 0 ? (anchor + boxHalf) / -low : 1,
    high > 0 ? (boxHalf - anchor) / high : 1,
  )
}

/** Normalise to [0, 360). */
function normaliseDeg(deg: number): number {
  const wrapped = deg % 360
  return wrapped < 0 ? wrapped + 360 : wrapped + 0
}

/** Set one frame's rotation (degrees, stored in [0, 360)). Non-finite, same, locked → unchanged. */
export function rotateFrame(
  book: Book,
  spreadId: string,
  frameId: string,
  rotationDeg: number,
): Book {
  if (!Number.isFinite(rotationDeg)) {
    return book
  }
  const target = normaliseDeg(rotationDeg)
  return transformFrames(book, spreadId, [frameId], (frames) => {
    const changed = new Map<string, Frame>()
    const frame = frames[0]
    if (frame !== undefined && (frame.rotationDeg ?? 0) !== target) {
      changed.set(frame.id, { ...frame, rotationDeg: target })
    }
    return changed
  })
}

/**
 * Align unlocked frames to the bounding box of the unlocked frames (unrotated
 * rects). Fewer than two unlocked targets → unchanged.
 */
export function alignFrames(
  book: Book,
  spreadId: string,
  frameIds: readonly string[],
  edge: AlignEdge,
): Book {
  return transformFrames(book, spreadId, frameIds, (frames) => {
    const changed = new Map<string, Frame>()
    if (frames.length < 2) {
      return changed
    }
    const left = Math.min(...frames.map((f) => f.rect.x))
    const right = Math.max(...frames.map((f) => f.rect.x + f.rect.width))
    const top = Math.min(...frames.map((f) => f.rect.y))
    const bottom = Math.max(...frames.map((f) => f.rect.y + f.rect.height))
    for (const frame of frames) {
      const { x, y, width, height } = frame.rect
      const moved: Rect = { x, y, width, height }
      if (edge === 'left') moved.x = left
      else if (edge === 'right') moved.x = right - width
      else if (edge === 'centerX') moved.x = (left + right) / 2 - width / 2
      else if (edge === 'top') moved.y = top
      else if (edge === 'bottom') moved.y = bottom - height
      else moved.y = (top + bottom) / 2 - height / 2
      if (!sameRect(frame.rect, moved)) {
        changed.set(frame.id, { ...frame, rect: moved })
      }
    }
    return changed
  })
}

/**
 * Even out the gaps between unlocked frames along an axis; the outermost two
 * stay put. Fewer than three unlocked targets → unchanged.
 */
export function distributeFrames(
  book: Book,
  spreadId: string,
  frameIds: readonly string[],
  axis: DistributeAxis,
): Book {
  return transformFrames(book, spreadId, frameIds, (frames) => {
    const changed = new Map<string, Frame>()
    if (frames.length < 3) {
      return changed
    }
    const horizontal = axis === 'horizontal'
    const start = (f: Frame) => (horizontal ? f.rect.x : f.rect.y)
    const size = (f: Frame) => (horizontal ? f.rect.width : f.rect.height)
    const sorted = [...frames].sort((a, b) => start(a) - start(b))
    // Seedless reduce yields a typed Frame (length >= 3 is guaranteed above).
    const first = sorted.reduce((head) => head)
    const last = sorted.reduce((_, f) => f)
    const span = start(last) + size(last) - start(first)
    const gap =
      (span - sorted.reduce((sum, f) => sum + size(f), 0)) / (sorted.length - 1)
    let cursor = start(first)
    for (const frame of sorted) {
      if (start(frame) !== cursor) {
        const rect = horizontal
          ? { ...frame.rect, x: cursor }
          : { ...frame.rect, y: cursor }
        changed.set(frame.id, { ...frame, rect })
      }
      cursor += size(frame) + gap
    }
    return changed
  })
}
