const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function isAcceptedPhotoMime(mimeType: string): boolean {
  return ACCEPTED.has(mimeType.toLowerCase())
}

export function acceptedPhotoAcceptAttr(): string {
  return 'image/jpeg,image/png,image/webp'
}

/** Name/MIME HEIC-HEIF check for import reason tagging (full sniff is a later item). */
export function isHeicLikeFile(file: { name: string; type: string }): boolean {
  const mime = file.type.toLowerCase()
  if (
    mime === 'image/heic' ||
    mime === 'image/heif' ||
    mime === 'image/heic-sequence' ||
    mime === 'image/heif-sequence'
  ) {
    return true
  }
  const lower = file.name.toLowerCase()
  return lower.endsWith('.heic') || lower.endsWith('.heif')
}
