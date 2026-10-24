import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import type { Page } from '@playwright/test'

export interface StubPhotoFile {
  name: string
  mime: string
  base64: string
}

function mimeForName(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.tif') || lower.endsWith('.tiff')) return 'image/tiff'
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic'
  if (lower.endsWith('.md')) return 'text/markdown'
  if (lower.endsWith('.txt')) return 'text/plain'
  if (lower.endsWith('.json')) return 'application/json'
  return 'application/octet-stream'
}

export function stubPhotoFilesFromPaths(
  paths: readonly string[],
): StubPhotoFile[] {
  const used = new Map<string, number>()
  return paths.map((path) => {
    const base = basename(path)
    const seen = used.get(base) ?? 0
    used.set(base, seen + 1)
    // Directory fake stores by file name; keep duplicates distinct.
    const name = seen === 0 ? base : `${String(seen)}-${base}`
    return {
      name,
      mime: mimeForName(base),
      base64: readFileSync(path).toString('base64'),
    }
  })
}

/**
 * Install a Chromium FSA directory-picker double before navigation.
 * Queue outcomes with `queuePhotoDirectoryPicker`, then click Choose/Change.
 */
export async function installPhotoDirectoryPickerStub(
  page: Page,
): Promise<void> {
  await page.addInitScript(() => {
    type Queued =
      | {
          kind: 'files'
          files: { name: string; mime: string; base64: string }[]
        }
      | { kind: 'abort' }

    const w = window as Window & {
      __pbPhotoDirQueue?: Queued[]
      __pbQueuePhotoDir?: (next: Queued) => void
    }
    w.__pbPhotoDirQueue = []
    w.__pbQueuePhotoDir = (next) => {
      w.__pbPhotoDirQueue?.push(next)
    }

    function decodeBase64(base64: string): ArrayBuffer {
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i)
      }
      return bytes.buffer
    }

    function createFakeDirectory(
      files: { name: string; mime: string; base64: string }[],
      name = 'Photos',
    ): FileSystemDirectoryHandle {
      const fileMap = new Map(files.map((file) => [file.name, file] as const))
      // Decode once per name; import walk + later FSA reads share the same File.
      const fileCache = new Map<string, File>()
      const fileFor = (entry: {
        name: string
        mime: string
        base64: string
      }): File => {
        const cached = fileCache.get(entry.name)
        if (cached !== undefined) {
          return cached
        }
        const created = new File([decodeBase64(entry.base64)], entry.name, {
          type: entry.mime,
        })
        fileCache.set(entry.name, created)
        return created
      }
      let permission: PermissionState = 'granted'
      const handle = {
        kind: 'directory' as const,
        name,
        queryPermission: () => Promise.resolve(permission),
        requestPermission: () => {
          permission = 'granted'
          return Promise.resolve(permission)
        },
        setPermission: (state: PermissionState) => {
          permission = state
        },
        getDirectoryHandle: () =>
          Promise.reject(new DOMException('not found', 'NotFoundError')),
        getFileHandle: (child: string) => {
          const entry = fileMap.get(child)
          if (entry === undefined) {
            return Promise.reject(
              new DOMException(`"${child}" not found`, 'NotFoundError'),
            )
          }
          return Promise.resolve({
            kind: 'file' as const,
            name: child,
            getFile: () => Promise.resolve(fileFor(entry)),
          })
        },
        *entries() {
          for (const [fileName, entry] of fileMap) {
            yield [
              fileName,
              {
                kind: 'file' as const,
                getFile: () => Promise.resolve(fileFor(entry)),
              },
            ] as const
          }
        },
        *values() {
          for (const fileName of fileMap.keys()) {
            yield { kind: 'file' as const, name: fileName }
          }
        },
      }
      return handle as unknown as FileSystemDirectoryHandle
    }

    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      writable: true,
      value: () => {
        const next = w.__pbPhotoDirQueue?.shift()
        if (next === undefined) {
          return Promise.reject(
            new Error('photo directory picker: queue empty'),
          )
        }
        if (next.kind === 'abort') {
          return Promise.reject(
            new DOMException('User cancelled', 'AbortError'),
          )
        }
        const directory = createFakeDirectory(
          next.files,
        ) as FileSystemDirectoryHandle & {
          setPermission?: (state: PermissionState) => void
        }
        ;(
          window as Window & {
            __pbLastPhotoDir?: FileSystemDirectoryHandle & {
              setPermission?: (state: PermissionState) => void
            }
          }
        ).__pbLastPhotoDir = directory
        return Promise.resolve(directory)
      },
    })
  })
}

export async function queuePhotoDirectoryPicker(
  page: Page,
  files: readonly StubPhotoFile[],
): Promise<void> {
  await page.evaluate((payload) => {
    const w = window as Window & {
      __pbQueuePhotoDir?: (next: {
        kind: 'files'
        files: StubPhotoFile[]
      }) => void
    }
    w.__pbQueuePhotoDir?.({ kind: 'files', files: [...payload] })
  }, files)
}

/**
 * Import a photo folder in e2e.
 * Prefer the VITE_E2E `e2e-photo-folder-input` seam (setInputFiles) for bulk
 * and happy-path imports — avoids base64 stub walks that trip LoAF gates.
 * Use `via: 'picker'` when the test needs the showDirectoryPicker double
 * (abort, permission, pasteboard button).
 */
export async function choosePhotoFolder(
  page: Page,
  filePaths: readonly string[],
  options?: { button?: 'top' | 'pasteboard'; via?: 'input' | 'picker' },
): Promise<void> {
  const where = options?.button ?? 'top'
  const via = options?.via ?? (where === 'pasteboard' ? 'picker' : 'input')
  if (via === 'input') {
    const input = page.getByTestId('e2e-photo-folder-input')
    await input.setInputFiles([...filePaths])
    return
  }
  await queuePhotoDirectoryPicker(page, stubPhotoFilesFromPaths(filePaths))
  if (where === 'pasteboard') {
    await page
      .getByTestId('pasteboard-empty-card')
      .getByRole('button', { name: /photo folder/i })
      .click()
    return
  }
  await page.getByTestId('choose-photo-folder').click()
}
