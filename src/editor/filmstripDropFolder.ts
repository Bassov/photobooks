export type FilmstripDropResult =
  | {
      kind: 'folder'
      directory: FileSystemDirectoryHandle
      ignoredFiles: number
    }
  | { kind: 'no-folder' }

interface HandleItem extends DataTransferItem {
  getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>
}

/** True for a desktop file drag (not an in-app gallery/frame drag). */
export function isExternalFilesDrag(types: readonly string[]): boolean {
  return types.includes('Files')
}

/**
 * Resolve a desktop drop to its first directory handle (read-only; no
 * permission is requested). Loose files are only counted, never imported.
 */
export async function resolveDroppedFolder(
  items: DataTransferItemList,
): Promise<FilmstripDropResult> {
  let directory: FileSystemDirectoryHandle | null = null
  let ignoredFiles = 0
  const handles: Promise<FileSystemHandle | null>[] = []
  for (const item of Array.from(items)) {
    if (item.kind !== 'file') {
      continue
    }
    const read = (item as HandleItem).getAsFileSystemHandle
    handles.push(
      typeof read === 'function'
        ? // Stryker disable next-line ArrowFunction: null vs undefined are equivalent below (`handle?.kind`)
          read.call(item).catch(() => null)
        : Promise.resolve(null),
    )
  }
  for (const handle of await Promise.all(handles)) {
    if (handle?.kind === 'directory' && directory === null) {
      directory = handle as FileSystemDirectoryHandle
    } else {
      ignoredFiles += 1
    }
  }
  return directory === null
    ? { kind: 'no-folder' }
    : { kind: 'folder', directory, ignoredFiles }
}

export const STATUS_DROP_FOLDER_ONLY =
  'Drop a folder — Photobooks adds folders, not single photos'
export const STATUS_DROP_FILES_IGNORED =
  'Folder added; loose files were ignored'
