export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export interface OrientationTransform {
  rotation: 0 | 90 | 180 | 270
  flipX: boolean
  flipY: boolean
  correctedW: number
  correctedH: number
}

export interface PhotoCardModel {
  name: string
  mimeType: string
  byteLength: number
  width: number
  height: number
  correctedWidth: number
  correctedHeight: number
  orientation: ExifOrientation
  aspectLabel: string
  sizeLabel: string
  previewUrl: string
}

export class UnsupportedPhotoFormatError extends Error {
  readonly mimeType: string

  constructor(mimeType: string) {
    super(`Unsupported image format: ${mimeType || 'unknown'}`)
    this.name = 'UnsupportedPhotoFormatError'
    this.mimeType = mimeType
  }
}
