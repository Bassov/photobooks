import exifr from 'exifr'

/**
 * Best-effort EXIF pixel size fields. Soft-fails like orientation read:
 * formats such as WebP may throw ("Unknown file format") from exifr.
 */
export async function readExifImageSize(buffer: ArrayBuffer): Promise<unknown> {
  try {
    return await exifr.parse(buffer, {
      pick: ['ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight'],
      translateValues: false,
      reviveValues: false,
    })
  } catch {
    return {}
  }
}
