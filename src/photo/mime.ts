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

export function acceptedPhotoAcceptAttr(): string {
  return 'image/jpeg,image/png,image/webp,.heic,.heif,image/heic,image/heif'
}
