import type { Book, Frame, FrameAdjust, FrameStyle } from '../schema'
import { updateFrame } from '../update'
import { omitKey } from '../omitKey'

/** Kit built-in frame styles (uikit/src/sandbox/model.ts DEFAULT_STYLES). */
export const FRAME_STYLE_PRESETS: readonly {
  id: string
  name: string
  style: FrameStyle
}[] = [
  {
    id: 'white-mat',
    name: 'White mat',
    style: { matMm: 3, matColor: '#ffffff' },
  },
  {
    id: 'hairline',
    name: 'Hairline',
    style: { strokeMm: 0.3, strokeColor: '#1c1b1a' },
  },
  { id: 'soft-corners', name: 'Soft corners', style: { cornerRadiusMm: 4 } },
]

export const NO_ADJUST: FrameAdjust = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
}

export function isAdjusted(adjust: FrameAdjust | undefined): boolean {
  return (
    adjust !== undefined &&
    (adjust.brightness !== 0 ||
      adjust.contrast !== 0 ||
      adjust.saturation !== 0)
  )
}

/** Display name of a style key: preset name, else "Style n". */
export function frameStyleName(styleId: string): string {
  const preset = FRAME_STYLE_PRESETS.find((item) => item.id === styleId)
  return preset?.name ?? `Style ${styleId.replace(/^style-/, '')}`
}

/** Empty text clears the caption. */
export function setFrameCaption(
  book: Book,
  spreadId: string,
  frameId: string,
  caption: string,
): Book {
  return updateFrame(book, spreadId, frameId, (frame) => {
    if (frame.kind === 'text' || (frame.caption ?? '') === caption) {
      return frame
    }
    const rest = omitKey(frame, 'caption')
    return caption === '' ? rest : { ...rest, caption }
  })
}

const clampAmount = (n: number): number =>
  Math.min(100, Math.max(-100, Math.round(n)))

/** Patch tone adjustments; all-zero removes the field. Needs a photo. */
export function setFrameAdjust(
  book: Book,
  spreadId: string,
  frameId: string,
  patch: Partial<FrameAdjust> | null,
): Book {
  return updateFrame(book, spreadId, frameId, (frame) => {
    if (frame.assetId === undefined) {
      return frame
    }
    const base = frame.adjust ?? NO_ADJUST
    const next: FrameAdjust =
      patch === null
        ? NO_ADJUST
        : {
            brightness: clampAmount(patch.brightness ?? base.brightness),
            contrast: clampAmount(patch.contrast ?? base.contrast),
            saturation: clampAmount(patch.saturation ?? base.saturation),
          }
    if (
      next.brightness === base.brightness &&
      next.contrast === base.contrast &&
      next.saturation === base.saturation
    ) {
      return frame
    }
    const rest = omitKey(frame, 'adjust')
    return isAdjusted(next) ? { ...rest, adjust: next } : rest
  })
}

/**
 * Apply a style key to an image frame (`undefined` = None). A preset key not
 * yet in the book is added to `book.frameStyles` first.
 */
export function applyFrameStyle(
  book: Book,
  spreadId: string,
  frameId: string,
  styleId: string | undefined,
): Book {
  let frameStyles = book.frameStyles
  if (styleId !== undefined && !(styleId in frameStyles)) {
    const preset = FRAME_STYLE_PRESETS.find((item) => item.id === styleId)
    if (preset === undefined) {
      return book
    }
    frameStyles = { ...frameStyles, [styleId]: preset.style }
  }
  const withStyles =
    frameStyles === book.frameStyles ? book : { ...book, frameStyles }
  return updateFrame(withStyles, spreadId, frameId, (frame: Frame) => {
    if (frame.kind === 'text' || frame.frameStyleId === styleId) {
      return frame
    }
    const rest = omitKey(frame, 'frameStyleId')
    return styleId === undefined ? rest : { ...rest, frameStyleId: styleId }
  })
}

/** Edit a style in place: every frame using it follows. */
export function editFrameStyle(
  book: Book,
  styleId: string,
  patch: Partial<FrameStyle>,
): Book {
  const current = book.frameStyles[styleId]
  if (current === undefined) {
    return book
  }
  const next = { ...current, ...patch }
  const same = (Object.keys(next) as (keyof FrameStyle)[]).every(
    (key) => next[key] === current[key],
  )
  return same
    ? book
    : { ...book, frameStyles: { ...book.frameStyles, [styleId]: next } }
}

/** Copy the frame's style (or a blank one) to a new `style-n` and apply it. */
export function newFrameStyleFromFrame(
  book: Book,
  spreadId: string,
  frameId: string,
): Book {
  const frame = book.spreads
    .find((spread) => spread.id === spreadId)
    ?.frames.find((item) => item.id === frameId)
  if (frame === undefined || frame.kind === 'text') {
    return book
  }
  let n = Object.keys(book.frameStyles).length + 1
  while (`style-${String(n)}` in book.frameStyles) {
    n += 1
  }
  const id = `style-${String(n)}`
  const source =
    frame.frameStyleId === undefined
      ? {}
      : (book.frameStyles[frame.frameStyleId] ?? {})
  return applyFrameStyle(
    { ...book, frameStyles: { ...book.frameStyles, [id]: { ...source } } },
    spreadId,
    frameId,
    id,
  )
}
