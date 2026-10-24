import type { AssetDirectoryHandle } from './fsa/handles'
import {
  fromFileSystemDirectoryHandle,
  isBrowserDirectoryHandle,
} from './fsa/handles'

/** Resolve a File under a directory handle by relative path (main-thread FSA). */
export async function resolveRelativeFile(
  directory: AssetDirectoryHandle | FileSystemDirectoryHandle,
  relativePath: string,
): Promise<File | null> {
  const parts = relativePath.split('/').filter((part) => part.length > 0)
  const fileName = parts.pop()
  if (!fileName) {
    return null
  }
  let dir: AssetDirectoryHandle = isBrowserDirectoryHandle(directory)
    ? fromFileSystemDirectoryHandle(directory)
    : directory
  for (const part of parts) {
    try {
      dir = await dir.getDirectory(part)
    } catch {
      return null
    }
  }
  try {
    const handle = await dir.getFile(fileName)
    const file = await handle.getFile()
    return fileWithRelativePath(file, relativePath)
  } catch {
    return null
  }
}

/** Attach a webkitRelativePath-style path so `relativePathFor` works. */
export function fileWithRelativePath(file: File, relativePath: string): File {
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
