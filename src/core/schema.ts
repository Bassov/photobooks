import { z } from 'zod'

export const CURRENT_SCHEMA_VERSION = 9 as const

const nonNegativeMm = z.number().nonnegative()
const positiveMm = z.number().positive()
const normalizedUnit = z.number().min(0).max(1)
const nonEmptyString = z.string().min(1)

const rectMmSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: positiveMm,
  height: positiveMm,
})

const marginsMmSchema = z.object({
  top: nonNegativeMm,
  bottom: nonNegativeMm,
  /** Spine side of the page; mirrored on facing pages. */
  inside: nonNegativeMm,
  /** Fore-edge side of the page. */
  outside: nonNegativeMm,
})

const layoutGridSchema = z.object({
  margins: marginsMmSchema,
  columns: z.number().int().positive(),
  rows: z.number().int().positive(),
  columnGutterMm: nonNegativeMm,
  rowGutterMm: nonNegativeMm,
})

/** Per-spread override: only the fields the spread changes (the rest inherit from the book). */
const layoutGridOverrideSchema = z.object({
  margins: marginsMmSchema.partial().optional(),
  columns: z.number().int().positive().optional(),
  rows: z.number().int().positive().optional(),
  columnGutterMm: nonNegativeMm.optional(),
  rowGutterMm: nonNegativeMm.optional(),
})

const guideSchema = z.object({
  id: nonEmptyString,
  orientation: z.enum(['horizontal', 'vertical']),
  offsetMm: z.number(),
  locked: z.boolean().optional(),
})

const cropSchema = z.object({
  zoom: z.number().min(1),
  center: z.object({
    x: normalizedUnit,
    y: normalizedUnit,
  }),
  /** Clockwise quarter turns of the photo inside the frame; absent → 0. */
  quarterTurns: z.number().int().min(0).max(3).optional(),
  /** Fine rotation of the photo in degrees; absent → 0. */
  straightenDeg: z.number().min(-45).max(45).optional(),
  /** Mirror the photo left-right / top-bottom (uikit/src/sandbox/inspector.tsx:151-158); absent → false. */
  flipH: z.boolean().optional(),
  flipV: z.boolean().optional(),
})

const assetMetaSchema = z.object({
  title: nonEmptyString.optional(),
  caption: nonEmptyString.optional(),
  keywords: z.array(nonEmptyString).optional(),
  camera: nonEmptyString.optional(),
  lens: nonEmptyString.optional(),
  gps: z
    .object({
      lat: z.number(),
      lon: z.number(),
    })
    .optional(),
})

const assetSchema = z.object({
  sourceRootId: nonEmptyString.optional(),
  relativePath: nonEmptyString.optional(),
  byteSize: z.number().int().nonnegative().optional(),
  mtimeMs: z.number().optional(),
  contentHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/, 'contentHash must be 64 lowercase hex')
    .optional(),
  widthPx: z.number().int().positive().optional(),
  heightPx: z.number().int().positive().optional(),
  orientation: z.number().int().min(1).max(8).optional(),
  capturedAt: nonEmptyString.optional(),
  colorSpace: nonEmptyString.optional(),
  iccProfileName: nonEmptyString.optional(),
  mime: nonEmptyString.optional(),
  meta: assetMetaSchema.optional(),
})

/** Built-in text styles (kit `TextStyle`); the type scale lives with the painter. */
export const TEXT_STYLE_IDS = ['title', 'caption', 'body'] as const

/** Spread master pages (kit `Spread.master`); `none` → no master. */
export const SPREAD_MASTERS = ['A', 'B', 'none'] as const

const textContentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('static'), text: z.string() }),
  /** `{title}`, `{caption}`, `{spread}` tokens resolved by `resolveTextItems`. */
  z.object({ type: z.literal('template'), template: z.string() }),
])
/*
 * Style shapes are built per parse (like cover) so that their mutants are
 * reachable by per-test mutant switching.
 */

/** sRGB color as lowercase `#rrggbb`. */
function makeSrgbHexSchema() {
  return z
    .string()
    .regex(/^#[0-9a-f]{6}$/, 'color must be lowercase #rrggbb sRGB')
}

/** Book-level frame style; absent fields mean "none" (no stroke, mat, rounding). */
function makeFrameStyleSchema() {
  const color = makeSrgbHexSchema()
  return z.object({
    strokeMm: nonNegativeMm.optional(),
    strokeColor: color.optional(),
    matMm: nonNegativeMm.optional(),
    matColor: color.optional(),
    cornerRadiusMm: nonNegativeMm.optional(),
  })
}

function makeFrameStylesSchema() {
  return z.record(nonEmptyString, makeFrameStyleSchema())
}

/** Brightness / contrast / saturation, each −100…100 (0 = untouched). */
function makeAdjustSchema() {
  const amount = z.number().int().min(-100).max(100)
  return z.object({
    brightness: amount,
    contrast: amount,
    saturation: amount,
  })
}

const frameSchema = z.object({
  id: nonEmptyString,
  rect: rectMmSchema,
  z: z.number().int(),
  assetId: nonEmptyString.optional(),
  crop: cropSchema.optional(),
  fit: z.enum(['fill', 'fit']).optional(),
  /** Frame rotation in degrees about its center; absent → 0. */
  rotationDeg: z.number().optional(),
  locked: z.boolean().optional(),
  /** Frame kind; absent → 'image'. Text frames never carry `assetId` / `crop`. */
  kind: z.enum(['image', 'text']).optional(),
  /** Text frames only. */
  content: textContentSchema.optional(),
  /** Text frames only: id of an image frame on the same spread this text follows. */
  anchorFrameId: nonEmptyString.optional(),
  styleId: z.enum(TEXT_STYLE_IDS).optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  /** Key into `book.frameStyles`; absent → unstyled. */
  frameStyleId: nonEmptyString.optional(),
  /** Printed under the frame (kit Caption); absent → none. */
  caption: z.string().min(1).optional(),
  /** Photo tone adjustments (kit Adjust); absent → untouched. */
  adjust: atParseTime(makeAdjustSchema).optional(),
})

const spreadSchema = z.object({
  id: nonEmptyString,
  templateId: nonEmptyString.optional(),
  layoutGrid: layoutGridOverrideSchema.optional(),
  guides: z.array(guideSchema).optional(),
  /** Spread background; absent → the paper default. */
  backgroundColor: atParseTime(makeSrgbHexSchema).optional(),
  /** Master page of the spread (kit Master & spacing); absent → Master A. */
  masterId: z.enum(SPREAD_MASTERS).optional(),
  frames: z.array(frameSchema),
})

/** Cover title faces (kit "Title font"). */
export const COVER_TITLE_FONTS = ['serif-italic', 'serif', 'sans'] as const
export const SPINE_DIRECTIONS = ['top-to-bottom', 'bottom-to-top'] as const
export const COVER_MATERIALS = ['printed', 'linen', 'leatherette'] as const
export const COVER_FINISHES = ['matte', 'gloss', 'soft-touch'] as const
export const SPINE_WIDTH_MIN_MM = 4
export const SPINE_WIDTH_MAX_MM = 40

/*
 * Cover / endpaper shapes are built per parse (not at module load) so that
 * their mutants are reachable by per-test mutant switching.
 */
function makeCoverSchema() {
  /** One cover panel (front / spine / back): optional photo plus text. */
  const panel = z.object({
    assetId: nonEmptyString.optional(),
    crop: cropSchema.optional(),
    text: z.string(),
  })
  const style = z.object({
    titleFont: z.enum(COVER_TITLE_FONTS),
    spineWidthMm: z.number().min(SPINE_WIDTH_MIN_MM).max(SPINE_WIDTH_MAX_MM),
    spineDirection: z.enum(SPINE_DIRECTIONS),
    /** Back panel fill, sRGB `#rrggbb`. */
    backFill: makeSrgbHexSchema(),
    material: z.enum(COVER_MATERIALS),
    finish: z.enum(COVER_FINISHES),
  })
  return z.object({ front: panel, spine: panel, back: panel, style })
}

function makeEndpapersSchema() {
  /** One endpaper: optional photo only. */
  const endpaper = z.object({
    assetId: nonEmptyString.optional(),
    crop: cropSchema.optional(),
  })
  return z.object({ front: endpaper, back: endpaper })
}

/** Defers building `make()` to parse time, forwarding its issues. */
function atParseTime<S extends z.ZodType>(make: () => S) {
  return z.unknown().transform((value, ctx): z.output<S> => {
    const result = make().safeParse(value)
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({
          code: 'custom',
          message: issue.message,
          path: issue.path,
        })
      }
      return z.NEVER
    }
    return result.data
  })
}

const bookSettingsSchema = z.object({
  trim: z.object({
    widthMm: positiveMm,
    heightMm: positiveMm,
  }),
  bleedMm: nonNegativeMm,
  safeMarginMm: nonNegativeMm,
  /** Endpaper rows and canvases; `same` mirrors the front photo on the back. */
  endpapers: z.object({ enabled: z.boolean(), same: z.boolean() }),
  /** Default page color of spreads without their own; absent → paper. */
  pageColor: atParseTime(makeSrgbHexSchema).optional(),
})

export const bookSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  id: nonEmptyString,
  title: z.string().optional(),
  settings: bookSettingsSchema,
  cover: atParseTime(makeCoverSchema),
  endpapers: atParseTime(makeEndpapersSchema),
  layoutGrid: layoutGridSchema,
  guides: z.array(guideSchema),
  frameStyles: atParseTime(makeFrameStylesSchema),
  assets: z.record(nonEmptyString, assetSchema),
  gallery: z.array(nonEmptyString).superRefine((gallery, ctx) => {
    const seen = new Set<string>()
    for (const [index, assetId] of gallery.entries()) {
      if (seen.has(assetId)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Gallery ids must be unique',
          path: [index],
        })
        return
      }
      seen.add(assetId)
    }
  }),
  spreads: z.array(spreadSchema).min(1),
})

export type Asset = z.infer<typeof assetSchema>
export type TextContent = z.infer<typeof textContentSchema>
export type TextStyleId = (typeof TEXT_STYLE_IDS)[number]
export type SpreadMasterId = (typeof SPREAD_MASTERS)[number]
export type FrameStyle = z.output<ReturnType<typeof makeFrameStyleSchema>>
export type Frame = z.infer<typeof frameSchema>
export type Spread = z.infer<typeof spreadSchema>
export type Cover = z.output<ReturnType<typeof makeCoverSchema>>
export type CoverPanel = Cover['front']
export type CoverStyle = Cover['style']
export type FrameAdjust = NonNullable<Frame['adjust']>
export type Endpapers = z.output<ReturnType<typeof makeEndpapersSchema>>
export type Endpaper = Endpapers['front']
export type Book = z.infer<typeof bookSchema>
