const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function isAcceptedPhotoMime(mimeType: string): boolean {
  return ACCEPTED.has(mimeType.toLowerCase())
}

export function acceptedPhotoAcceptAttr(): string {
  return 'image/jpeg,image/png,image/webp,.heic,.heif,image/heic,image/heif'
}
