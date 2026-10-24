/**
 * Build a FileSystemDirectoryHandle-shaped double from already-granted Files.
 * Used by the VITE_E2E folder-input seam (Playwright setInputFiles) so bulk
 * imports do not re-encode bytes through the showDirectoryPicker test stub.
 */
export function directoryHandleFromFiles(
  files: readonly File[],
  name = 'Photos',
): FileSystemDirectoryHandle {
  const byName = new Map<string, File>()
  for (const file of files) {
    const relative = (file as File & { webkitRelativePath?: string })
      .webkitRelativePath
    const path =
      typeof relative === 'string' && relative.length > 0 ? relative : file.name
    const slash = path.lastIndexOf('/')
    const key = slash >= 0 ? path.slice(slash + 1) : path
    byName.set(key.length > 0 ? key : file.name, file)
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
    getDirectoryHandle: () =>
      Promise.reject(new DOMException('not found', 'NotFoundError')),
    getFileHandle: (child: string) => {
      const file = byName.get(child)
      if (file === undefined) {
        return Promise.reject(
          new DOMException(`"${child}" not found`, 'NotFoundError'),
        )
      }
      return Promise.resolve({
        kind: 'file' as const,
        name: child,
        getFile: () => Promise.resolve(file),
      })
    },
    *entries() {
      for (const [fileName, file] of byName) {
        yield [
          fileName,
          {
            kind: 'file' as const,
            getFile: () => Promise.resolve(file),
          },
        ] as const
      }
    },
    *values() {
      for (const fileName of byName.keys()) {
        yield { kind: 'file' as const, name: fileName }
      }
    },
  }
  return handle as unknown as FileSystemDirectoryHandle
}
