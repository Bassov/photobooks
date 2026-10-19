import { z } from 'zod'

export const CURRENT_SCHEMA_VERSION = 3 as const

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
  right: nonNegativeMm,
  bottom: nonNegativeMm,
  left: nonNegativeMm,
})

const layoutGridSchema = z.object({
  margins: marginsMmSchema,
  columns: z.number().int().positive(),
  rows: z.number().int().positive(),
  columnGutterMm: nonNegativeMm,
  rowGutterMm: nonNegativeMm,
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

const frameSchema = z.object({
  id: nonEmptyString,
  rect: rectMmSchema,
  z: z.number().int(),
  assetId: nonEmptyString.optional(),
  crop: cropSchema.optional(),
})

const spreadSchema = z.object({
  id: nonEmptyString,
  templateId: nonEmptyString.optional(),
  layoutGrid: layoutGridSchema.optional(),
  guides: z.array(guideSchema).optional(),
  frames: z.array(frameSchema),
})

const bookSettingsSchema = z.object({
  trim: z.object({
    widthMm: positiveMm,
    heightMm: positiveMm,
  }),
  bleedMm: nonNegativeMm,
  safeMarginMm: nonNegativeMm,
})

export const bookSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  id: nonEmptyString,
  title: z.string().optional(),
  settings: bookSettingsSchema,
  layoutGrid: layoutGridSchema,
  guides: z.array(guideSchema),
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
export type Frame = z.infer<typeof frameSchema>
export type Spread = z.infer<typeof spreadSchema>
export type Book = z.infer<typeof bookSchema>
