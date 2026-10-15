interface FakeDir {
  files: Map<string, string>
  dirs: Map<string, FakeDir>
}

function createFakeDir(): FakeDir {
  return { files: new Map(), dirs: new Map() }
}

function toHandle(node: FakeDir, name: string): FileSystemDirectoryHandle {
  const handle = {
    kind: 'directory' as const,
    name,
    getDirectoryHandle(
      child: string,
      options?: { create?: boolean },
    ): Promise<FileSystemDirectoryHandle> {
      const existing = node.dirs.get(child)
      if (existing) {
        return Promise.resolve(toHandle(existing, child))
      }
      if (options?.create !== true) {
        return Promise.reject(
          new DOMException(`"${child}" not found`, 'NotFoundError'),
        )
      }
      const created = createFakeDir()
      node.dirs.set(child, created)
      return Promise.resolve(toHandle(created, child))
    },
    getFileHandle(child: string, options?: { create?: boolean }) {
      if (!node.files.has(child) && options?.create !== true) {
        return Promise.reject(
          new DOMException(`"${child}" not found`, 'NotFoundError'),
        )
      }
      if (!node.files.has(child)) {
        node.files.set(child, '')
      }
      return Promise.resolve({
        kind: 'file' as const,
        name: child,
        getFile() {
          return Promise.resolve(new File([node.files.get(child) ?? ''], child))
        },
        createWritable() {
          let content = ''
          return Promise.resolve({
            write(chunk: string) {
              content += chunk
              return Promise.resolve()
            },
            close() {
              node.files.set(child, content)
              return Promise.resolve()
            },
          })
        },
      })
    },
    removeEntry(child: string) {
      node.files.delete(child)
      node.dirs.delete(child)
      return Promise.resolve()
    },
    async *values() {
      for (const fileName of node.files.keys()) {
        yield await Promise.resolve({ kind: 'file' as const, name: fileName })
      }
      for (const dirName of node.dirs.keys()) {
        yield await Promise.resolve({
          kind: 'directory' as const,
          name: dirName,
        })
      }
    },
  }
  return handle as unknown as FileSystemDirectoryHandle
}

/** In-memory browser-shaped `FileSystemDirectoryHandle` for adapter tests. */
export function createFakeBrowserDirectory(): FileSystemDirectoryHandle {
  return toHandle(createFakeDir(), 'library')
}
