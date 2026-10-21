import {
  acceptedPhotoAcceptAttr,
  isAcceptedPhotoMime,
  isHeicLikeFile,
} from './mime'
import type { ImportErrorReason } from './assetPool'

const PICKER_TYPES = [
  {
    description: 'Images',
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
  },
]

export function canUseOpenFilePicker(): boolean {
  return typeof window.showOpenFilePicker === 'function'
}

export function canUseDirectoryPicker(): boolean {
  return typeof window.showDirectoryPicker === 'function'
}

export async function pickPhotosWithFilePicker(): Promise<File[] | null> {
  const openFilePicker = window.showOpenFilePicker
  if (typeof openFilePicker !== 'function') {
    return null
  }

  try {
    const handles = await openFilePicker({
      multiple: true,
      types: PICKER_TYPES,
      excludeAcceptAllOption: true,
    })
    const files: File[] = []
    for (const handle of handles) {
      files.push(await handle.getFile())
    }
    return files
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null
    }
    throw error
  }
}

/**
 * Prefer FSA directory picker. Returns File refs from the directory (accepted MIME only
 * filtering is left to the importer so unsupported files can surface as errors).
 */
export async function pickFolderWithDirectoryPicker(): Promise<File[] | null> {
  const showDirectoryPicker = window.showDirectoryPicker
  if (typeof showDirectoryPicker !== 'function') {
    return null
  }

  try {
    const directory = await showDirectoryPicker({ mode: 'read' })
    return await collectImageFilesFromDirectory(directory)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null
    }
    throw error
  }
}

async function collectImageFilesFromDirectory(
  directory: FileSystemDirectoryHandle,
): Promise<File[]> {
  const files: File[] = []
  // Directory iteration yields handles; getFile reads bytes via the handle API.
  for await (const [, handle] of directory.entries()) {
    if (handle.kind === 'file') {
      const fileHandle = handle as FileSystemFileHandle
      const file = await fileHandle.getFile()
      files.push(file)
      continue
    }
    const nested = await collectImageFilesFromDirectory(
      handle as FileSystemDirectoryHandle,
    )
    files.push(...nested)
  }
  return files
}

export function photoInputAccept(): string {
  return acceptedPhotoAcceptAttr()
}

export function partitionImportFiles(files: readonly File[]): {
  accepted: File[]
  rejected: {
    file: File
    message: string
    reason: ImportErrorReason
  }[]
} {
  const accepted: File[] = []
  const rejected: {
    file: File
    message: string
    reason: ImportErrorReason
  }[] = []
  for (const file of files) {
    const mimeType = file.type || 'application/octet-stream'
    if (isAcceptedPhotoMime(mimeType)) {
      accepted.push(file)
    } else if (isHeicLikeFile(file)) {
      rejected.push({
        file,
        message: `Unsupported image format: ${mimeType}`,
        reason: 'heic',
      })
    } else {
      rejected.push({
        file,
        message: `Unsupported image format: ${mimeType}`,
        reason: 'unsupported-type',
      })
    }
  }
  return { accepted, rejected }
}
