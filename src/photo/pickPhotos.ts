import { acceptedPhotoAcceptAttr, isAcceptedPhotoMime } from './mime'
import { HEIC_UNSUPPORTED_MESSAGE, isHeicLikeFile } from './heic'
import type { ImportErrorReason } from './assetPool'

export function canUseDirectoryPicker(): boolean {
  return typeof window.showDirectoryPicker === 'function'
}

export interface PickedPhotoFolder {
  directory: FileSystemDirectoryHandle
  files: File[]
}

/**
 * Prefer FSA directory picker. Keeps the handle for durable source-root binding
 * and returns File refs from the walk (MIME filtering stays in the importer).
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
    const files = await collectFilesFromDirectory(directory)
    return { directory, files }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null
    }
    throw error
  }
}

/** Attach a webkitRelativePath-style path so `relativePathFor` works. */
function fileWithRelativePath(file: File, relativePath: string): File {
  if (
    (file as File & { webkitRelativePath?: string }).webkitRelativePath ===
    relativePath
  ) {
    return file
  }
  try {
    Object.defineProperty(file, 'webkitRelativePath', {
      value: relativePath,
      configurable: true,
    })
    return file
  } catch {
    const copy = new File([file], file.name, {
      type: file.type,
      lastModified: file.lastModified,
    })
    Object.defineProperty(copy, 'webkitRelativePath', {
      value: relativePath,
      configurable: true,
    })
    return copy
  }
}

async function collectFilesFromDirectory(
  directory: FileSystemDirectoryHandle,
  prefix = '',
): Promise<File[]> {
  const files: File[] = []
  for await (const [name, handle] of directory.entries()) {
    const relativePath = prefix.length > 0 ? `${prefix}/${name}` : name
    if (handle.kind === 'file') {
      const file = await (handle as FileSystemFileHandle).getFile()
      files.push(fileWithRelativePath(file, relativePath))
      continue
    }
    const nested = await collectFilesFromDirectory(
      handle as FileSystemDirectoryHandle,
      relativePath,
    )
    files.push(...nested)
  }
  return files
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
  const lower = file.name.toLowerCase()
  return IMAGE_LIKE_EXTENSIONS.some((ext) => lower.endsWith(ext))
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
    if (isAcceptedPhotoMime(mimeType)) {
      accepted.push(file)
      continue
    }
    // HEIC before folder skip so extension-less `octet-stream` HEIC still errors.
    if (isHeicLikeFile(file)) {
      rejected.push({
        file,
        message: HEIC_UNSUPPORTED_MESSAGE,
        reason: 'heic',
      })
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
