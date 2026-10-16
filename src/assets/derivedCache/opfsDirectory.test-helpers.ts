interface FakeDir {
  files: Map<string, ArrayBuffer>
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
        node.files.set(child, new ArrayBuffer(0))
      }
      return Promise.resolve({
        kind: 'file' as const,
        name: child,
        getFile() {
          const data = node.files.get(child) ?? new ArrayBuffer(0)
          return Promise.resolve(new File([data], child))
        },
        createWritable() {
          const chunks: Uint8Array[] = []
          return Promise.resolve({
            write(chunk: BufferSource | Blob | string) {
              if (typeof chunk === 'string') {
                chunks.push(new TextEncoder().encode(chunk))
                return Promise.resolve()
              }
              if (chunk instanceof Blob) {
                return chunk.arrayBuffer().then((buf) => {
                  chunks.push(new Uint8Array(buf))
                })
              }
              chunks.push(
                chunk instanceof ArrayBuffer
                  ? new Uint8Array(chunk)
                  : new Uint8Array(
                      chunk.buffer,
                      chunk.byteOffset,
                      chunk.byteLength,
                    ),
              )
              return Promise.resolve()
            },
            close() {
              let total = 0
              for (const part of chunks) {
                total += part.byteLength
              }
              const merged = new Uint8Array(total)
              let offset = 0
              for (const part of chunks) {
                merged.set(part, offset)
                offset += part.byteLength
              }
              node.files.set(child, merged.buffer)
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

/** In-memory browser-shaped directory handle with binary file bodies for OPFS tests. */
export function createFakeOpfsDirectory(): FileSystemDirectoryHandle {
  return toHandle(createFakeDir(), 'opfs-root')
}
