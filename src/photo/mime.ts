export function isAcceptedPhotoMime(mimeType: string): boolean {
  const mime = mimeType.toLowerCase()
  return (
    mime === 'image/jpeg' ||
    mime === 'image/png' ||
    mime === 'image/webp' ||
    mime === 'image/heic' ||
    mime === 'image/heif' ||
    mime === 'image/heic-sequence' ||
    mime === 'image/heif-sequence'
  )
}

/** True when the name/MIME looks like JPEG (head-pass target; no EXIF parse). */
export function isJpegLikeFile(file: { name: string; type: string }): boolean {
  const mime = file.type.toLowerCase()
  if (mime === 'image/jpeg' || mime === 'image/jpg' || mime.endsWith('+jpeg')) {
    return true
  }
  const lower = file.name.toLowerCase()
  return lower.endsWith('.jpg') || lower.endsWith('.jpeg')
}

export function acceptedPhotoAcceptAttr(): string {
  return 'image/jpeg,image/png,image/webp,.heic,.heif,image/heic,image/heif'
}
