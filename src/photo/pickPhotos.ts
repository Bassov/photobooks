import { acceptedPhotoAcceptAttr, isAcceptedPhotoMime } from './mime'
import { isHeicLikeFile } from './heic'
import type { ImportErrorReason } from './assetPool'

export function canUseDirectoryPicker(): boolean {
  return typeof window.showDirectoryPicker === 'function'
}

export interface PickedPhotoFolder {
  directory: FileSystemDirectoryHandle
}

/**
 * Prefer FSA directory picker. Returns the handle only — folder discovery and
 * File resolution happen later via worker scan + batched import (no full-tree
 * main-thread collect before first paint).
 */
export async function pickFolderWithDirectoryPicker(): Promise<PickedPhotoFolder | null> {
  const showDirectoryPicker = window.showDirectoryPicker
  if (typeof showDirectoryPicker !== 'function') {
    return null
  }

  try {
    const directory = await showDirectoryPicker({
      id: 'photobooks-photos',
      mode: 'read',
      startIn: 'pictures',
    })
    return { directory }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null
    }
    throw error
  }
}

export function photoInputAccept(): string {
  return acceptedPhotoAcceptAttr()
}

const IMAGE_LIKE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
  '.tif',
  '.tiff',
] as const

/** True when MIME is `image/*` or the name has a known image extension. */
export function isImageLikeFile(file: { name: string; type: string }): boolean {
  const mime = file.type.toLowerCase()
  if (mime.startsWith('image/')) {
    return true
  }
  return isImageLikePath(file.name)
}

/** Extension-based image-like check for cheap scan paths (no File/MIME yet). */
export function isImageLikePath(relativePath: string): boolean {
  const lower = relativePath.toLowerCase()
  return IMAGE_LIKE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/** Accepted gallery import extensions (jpeg/png/webp/heic/heif) from a path. */
export function isAcceptedPhotoPath(relativePath: string): boolean {
  const lower = relativePath.toLowerCase()
  return (
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.heic') ||
    lower.endsWith('.heif')
  )
}

/**
 * Image-like but not accepted (e.g. TIFF): still resolve for per-file errors.
 * Non-image paths are folder skips. HEIC/HEIF are accepted as placeholders.
 */
export function isUnsupportedImagePath(relativePath: string): boolean {
  return isImageLikePath(relativePath) && !isAcceptedPhotoPath(relativePath)
}

/**
 * Cheap scan path with a definite non-image extension (e.g. `.md`, `.txt`).
 * Extension-less names are not skips — they still need HEIC ftyp sniff.
 */
export function isClearFolderSkipPath(relativePath: string): boolean {
  if (isImageLikePath(relativePath)) {
    return false
  }
  const base = relativePath.slice(relativePath.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  // Require a real extension (not `.hidden` or trailing dot).
  return dot > 0 && dot < base.length - 1
}

export type PartitionImportSource = 'files' | 'folder'

export function partitionImportFiles(
  files: readonly File[],
  options: { source?: PartitionImportSource } = {},
): {
  accepted: File[]
  rejected: {
    file: File
    message: string
    reason: ImportErrorReason
  }[]
  skipped: File[]
} {
  const source = options.source ?? 'files'
  const accepted: File[] = []
  const rejected: {
    file: File
    message: string
    reason: ImportErrorReason
  }[] = []
  const skipped: File[] = []
  for (const file of files) {
    const mimeType = file.type || 'application/octet-stream'
    if (isAcceptedPhotoMime(mimeType) || isHeicLikeFile(file)) {
      accepted.push(file)
      continue
    }
    // Keep bare `octet-stream` for HEIC ftyp sniff; skip only clear non-images.
    if (
      source === 'folder' &&
      !isImageLikeFile(file) &&
      mimeType !== 'application/octet-stream'
    ) {
      skipped.push(file)
      continue
    }
    rejected.push({
      file,
      message: `Unsupported image format: ${mimeType}`,
      reason: 'unsupported-type',
    })
  }
  return { accepted, rejected, skipped }
}
