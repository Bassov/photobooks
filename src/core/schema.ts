import { z } from 'zod'

export const CURRENT_SCHEMA_VERSION = 1 as const

const nonNegativeMm = z.number().nonnegative()
const positiveMm = z.number().positive()
const normalizedUnit = z.number().min(0).max(1)

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
  id: z.string().min(1),
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

const assetSchema = z.object({})

const frameSchema = z.object({
  id: z.string().min(1),
  rect: rectMmSchema,
  z: z.number().int(),
  assetId: z.string().min(1).optional(),
  crop: cropSchema.optional(),
})

const spreadSchema = z.object({
  id: z.string().min(1),
  templateId: z.string().min(1).optional(),
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
  id: z.string().min(1),
  settings: bookSettingsSchema,
  layoutGrid: layoutGridSchema,
  guides: z.array(guideSchema),
  assets: z.record(z.string().min(1), assetSchema),
  gallery: z.array(z.string().min(1)).superRefine((gallery, ctx) => {
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

export type Frame = z.infer<typeof frameSchema>
export type Spread = z.infer<typeof spreadSchema>
export type Book = z.infer<typeof bookSchema>
