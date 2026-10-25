import type { AssetDirectoryHandle, AssetFileHandle } from './handles'

type Entry =
  | { kind: 'file'; bytes: Uint8Array; mtimeMs: number; corrupted?: boolean }
  | { kind: 'directory'; children: Map<string, Entry> }

function notFound(name: string): DOMException {
  return new DOMException(`"${name}" not found`, 'NotFoundError')
}

class MemoryFileHandle implements AssetFileHandle {
  readonly kind = 'file' as const

  constructor(
    private readonly entry: Extract<Entry, { kind: 'file' }>,
    private readonly name: string,
  ) {}

  getFile(): Promise<File> {
    if (this.entry.corrupted === true) {
      return Promise.reject(
        new DOMException('Corrupt file', 'NotReadableError'),
      )
    }
    const copy = this.entry.bytes.slice()
    return Promise.resolve(
      new File([copy], this.name, { lastModified: this.entry.mtimeMs }),
    )
  }
}

class MemoryDirectoryHandle implements AssetDirectoryHandle {
  readonly kind = 'directory' as const

  constructor(private readonly node: Extract<Entry, { kind: 'directory' }>) {}

  getDirectory(
    name: string,
    options?: { create?: boolean },
  ): Promise<AssetDirectoryHandle> {
    const existing = this.node.children.get(name)
    if (existing?.kind === 'directory') {
      return Promise.resolve(new MemoryDirectoryHandle(existing))
    }
    if (existing?.kind === 'file') {
      return Promise.reject(
        new DOMException(`"${name}" is a file`, 'TypeMismatchError'),
      )
    }
    if (options?.create !== true) {
      return Promise.reject(notFound(name))
    }
    const created: Entry = { kind: 'directory', children: new Map() }
    this.node.children.set(name, created)
    return Promise.resolve(new MemoryDirectoryHandle(created))
  }

  getFile(
    name: string,
    options?: { create?: boolean },
  ): Promise<AssetFileHandle> {
    const existing = this.node.children.get(name)
    if (existing?.kind === 'file') {
      return Promise.resolve(new MemoryFileHandle(existing, name))
    }
    if (existing?.kind === 'directory') {
      return Promise.reject(
        new DOMException(`"${name}" is a directory`, 'TypeMismatchError'),
      )
    }
    if (options?.create !== true) {
      return Promise.reject(notFound(name))
    }
    const created: Entry = {
      kind: 'file',
      bytes: new Uint8Array(0),
      mtimeMs: 0,
    }
    this.node.children.set(name, created)
    return Promise.resolve(new MemoryFileHandle(created, name))
  }

  *entries(): IterableIterator<
    [string, AssetDirectoryHandle | AssetFileHandle]
  > {
    for (const [name, entry] of this.node.children) {
      if (entry.kind === 'directory') {
        yield [name, new MemoryDirectoryHandle(entry)]
      } else {
        yield [name, new MemoryFileHandle(entry, name)]
      }
    }
  }
}

function ensureFileEntry(
  root: Extract<Entry, { kind: 'directory' }>,
  relativePath: string,
): Extract<Entry, { kind: 'file' }> {
  const parts = relativePath.split('/').filter((part) => part.length > 0)
  const fileName = parts.pop()
  if (!fileName) {
    throw new Error('empty relative path')
  }
  let cursor = root
  for (const part of parts) {
    let next = cursor.children.get(part)
    if (!next) {
      next = { kind: 'directory', children: new Map() }
      cursor.children.set(part, next)
    }
    if (next.kind !== 'directory') {
      throw new Error(`"${part}" is a file`)
    }
    cursor = next
  }
  const fileEntry: Extract<Entry, { kind: 'file' }> = {
    kind: 'file',
    bytes: new Uint8Array(0),
    mtimeMs: 0,
  }
  cursor.children.set(fileName, fileEntry)
  return fileEntry
}

export function createMemoryAssetDirectory(): {
  root: AssetDirectoryHandle
  putFile: (relativePath: string, bytes: Uint8Array, mtimeMs: number) => void
  putCorrupted: (relativePath: string) => void
} {
  const node: Extract<Entry, { kind: 'directory' }> = {
    kind: 'directory',
    children: new Map(),
  }

  return {
    root: new MemoryDirectoryHandle(node),
    putFile(relativePath, bytes, mtimeMs) {
      const file = ensureFileEntry(node, relativePath)
      file.bytes = bytes.slice()
      file.mtimeMs = mtimeMs
      delete file.corrupted
    },
    putCorrupted(relativePath) {
      const file = ensureFileEntry(node, relativePath)
      file.bytes = new Uint8Array(0)
      file.mtimeMs = 0
      file.corrupted = true
    },
  }
}

export function isAssetDirectoryHandle(
  handle: AssetDirectoryHandle | AssetFileHandle,
): handle is AssetDirectoryHandle {
  return 'entries' in handle
}
