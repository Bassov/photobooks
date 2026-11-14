/** Exports go into `<library folder>/exports/` (Designer Spec pdf-export D8). */
export const EXPORTS_DIR = 'exports'

export type ExportWriteErrorCode = 'access' | 'full' | 'other'

export interface ExportFileHandle {
  readonly kind: 'file'
  readonly name: string
  getFile: () => Promise<Blob>
  createWritable: () => Promise<{
    write: (data: Uint8Array) => Promise<void>
    close: () => Promise<void>
  }>
}

/** The File System Access subset the writer needs; a Chromium `FileSystemDirectoryHandle` fits it. */
export interface ExportDirectoryHandle {
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<ExportDirectoryHandle>
  getFileHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<ExportFileHandle>
}

export type ExportWriteResult =
  | { ok: true; file: ExportFileHandle }
  | { ok: false; code: ExportWriteErrorCode }

/**
 * Writes `bytes` to `<library>/exports/<name>`, creating `exports/` and
 * replacing a same-name file. The platform rejects names with a path
 * separator, `.` or `..`.
 */
export async function writeExport(
  library: ExportDirectoryHandle,
  name: string,
  bytes: Uint8Array,
): Promise<ExportWriteResult> {
  try {
    const exports = await library.getDirectoryHandle(EXPORTS_DIR, {
      create: true,
    })
    const file = await exports.getFileHandle(name, { create: true })
    const writable = await file.createWritable()
    await writable.write(bytes)
    await writable.close()
    return { ok: true, file }
  } catch (error) {
    return { ok: false, code: exportErrorCode(error) }
  }
}

/** Failure code for an error thrown while writing an export. */
export function exportErrorCode(error: unknown): ExportWriteErrorCode {
  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'access'
  if (name === 'QuotaExceededError') return 'full'
  return 'other'
}
