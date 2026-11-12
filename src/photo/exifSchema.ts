import { z } from 'zod'

export const exifParseSchema = z.object({
  Orientation: z
    .union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
      z.literal(7),
      z.literal(8),
    ])
    .optional(),
  ImageWidth: z.number().positive().optional(),
  ImageHeight: z.number().positive().optional(),
  ExifImageWidth: z.number().positive().optional(),
  ExifImageHeight: z.number().positive().optional(),
})

export type ExifParse = z.infer<typeof exifParseSchema>
