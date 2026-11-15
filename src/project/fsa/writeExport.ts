/** Exports go into `<library folder>/exports/` (Designer Spec pdf-export D8). */
export const EXPORTS_DIR = 'exports'

export type ExportWriteErrorCode = 'access' | 'full' | 'other'

export interface ExportWritable {
  write: (data: Uint8Array) => Promise<void>
  close: () => Promise<void>
  /** Drops what was written; a same-name file stays as it was. */
  abort: () => Promise<void>
}

export interface ExportFileHandle {
  readonly kind: 'file'
  readonly name: string
  getFile: () => Promise<Blob>
  createWritable: () => Promise<ExportWritable>
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

/** An export file written chunk by chunk, in order. */
export interface ExportStream {
  /** Queues the next chunk; writes run one at a time, none after a failure. */
  write: (chunk: Uint8Array) => void
  /**
   * After the queued writes: replaces a same-name file with the written one,
   * or gives the first failure's code (opening included) and leaves it.
   */
  close: () => Promise<ExportWriteResult>
  /** After the queued writes: drops them, a same-name file stays. */
  abort: () => Promise<void>
}

/**
 * Streams `<library>/exports/<name>`, creating `exports/`. The file opens
 * with the first queued step, so a refused folder shows on `close`. The
 * platform rejects names with a path separator, `.` or `..`.
 */
export function openExport(
  library: ExportDirectoryHandle,
  name: string,
): ExportStream {
  let failure: { error: unknown } | undefined
  const fail = (error: unknown) => {
    failure ??= { error }
  }
  const target = (async () => {
    const exports = await library.getDirectoryHandle(EXPORTS_DIR, {
      create: true,
    })
    const file = await exports.getFileHandle(name, { create: true })
    return { file, writable: await file.createWritable() }
  })()
  let queue = target.then(() => undefined, fail)
  const drop = () =>
    target.then(({ writable }) => writable.abort()).catch(() => undefined)

  return {
    write: (chunk) => {
      queue = queue
        .then(async () => {
          if (failure === undefined) await (await target).writable.write(chunk)
        })
        .catch(fail)
    },
    close: async () => {
      await queue
      if (failure === undefined) {
        const { file, writable } = await target
        try {
          await writable.close()
          return { ok: true, file }
        } catch (error) {
          fail(error)
        }
      }
      await drop()
      return { ok: false, code: exportErrorCode(failure?.error) }
    },
    abort: async () => {
      await queue
      await drop()
    },
  }
}

/** Failure code for an error thrown while writing an export. */
export function exportErrorCode(error: unknown): ExportWriteErrorCode {
  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'access'
  if (name === 'QuotaExceededError') return 'full'
  return 'other'
}
