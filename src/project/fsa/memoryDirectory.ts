import type {
  LibraryDirectoryEntry,
  LibraryDirectoryHandle,
  LibraryFileHandle,
} from './handles'

type Entry =
  | { kind: 'file'; content: string }
  | { kind: 'directory'; children: Map<string, Entry> }

function notFound(name: string): DOMException {
  return new DOMException(`"${name}" not found`, 'NotFoundError')
}

class MemoryFileHandle implements LibraryFileHandle {
  constructor(private readonly entry: Extract<Entry, { kind: 'file' }>) {}

  getText(): Promise<string> {
    return Promise.resolve(this.entry.content)
  }

  writeText(text: string): Promise<void> {
    this.entry.content = text
    return Promise.resolve()
  }
}

class MemoryDirectoryHandle implements LibraryDirectoryHandle {
  constructor(private readonly node: Extract<Entry, { kind: 'directory' }>) {}

  getDirectory(
    name: string,
    options?: { create?: boolean },
  ): Promise<LibraryDirectoryHandle> {
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
  ): Promise<LibraryFileHandle> {
    const existing = this.node.children.get(name)
    if (existing?.kind === 'file') {
      return Promise.resolve(new MemoryFileHandle(existing))
    }
    if (existing?.kind === 'directory') {
      return Promise.reject(
        new DOMException(`"${name}" is a directory`, 'TypeMismatchError'),
      )
    }
    if (options?.create !== true) {
      return Promise.reject(notFound(name))
    }
    const created: Entry = { kind: 'file', content: '' }
    this.node.children.set(name, created)
    return Promise.resolve(new MemoryFileHandle(created))
  }

  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void> {
    const existing = this.node.children.get(name)
    if (existing === undefined) {
      return Promise.reject(notFound(name))
    }
    if (
      existing.kind === 'directory' &&
      existing.children.size > 0 &&
      options?.recursive !== true
    ) {
      return Promise.reject(
        new DOMException(`"${name}" is not empty`, 'InvalidModificationError'),
      )
    }
    this.node.children.delete(name)
    return Promise.resolve()
  }

  list(): Promise<LibraryDirectoryEntry[]> {
    const entries: LibraryDirectoryEntry[] = []
    for (const [name, entry] of this.node.children) {
      entries.push({ name, kind: entry.kind })
    }
    return Promise.resolve(entries)
  }
}

export function createMemoryDirectory(): LibraryDirectoryHandle {
  return new MemoryDirectoryHandle({
    kind: 'directory',
    children: new Map(),
  })
}

/** Test helper: read a file's text under a relative path of directory segments. */
export async function readMemoryFileText(
  root: LibraryDirectoryHandle,
  segments: readonly string[],
): Promise<string | undefined> {
  if (segments.length === 0) {
    return undefined
  }
  let dir = root
  for (const segment of segments.slice(0, -1)) {
    try {
      dir = await dir.getDirectory(segment)
    } catch {
      return undefined
    }
  }
  const fileName = segments[segments.length - 1]
  if (fileName === undefined) {
    return undefined
  }
  try {
    const file = await dir.getFile(fileName)
    return await file.getText()
  } catch {
    return undefined
  }
}

/** Test helper: whether a directory exists at the path. */
export async function memoryDirectoryExists(
  root: LibraryDirectoryHandle,
  segments: readonly string[],
): Promise<boolean> {
  let dir = root
  for (const segment of segments) {
    try {
      dir = await dir.getDirectory(segment)
    } catch {
      return false
    }
  }
  return true
}
