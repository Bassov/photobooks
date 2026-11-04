import type {
  SiteDirectoryHandle,
  SiteFileHandle,
  SiteWritable,
} from './writeSiteTree'

type Node =
  | { kind: 'file'; bytes: Uint8Array }
  | { kind: 'directory'; children: Map<string, Node> }

export interface MemorySiteDirectory {
  root: SiteDirectoryHandle
  /** Every create / write / remove, in order. */
  ops: string[]
  /** Next `createWritable` throws this, once. */
  failNextWrite: (error: Error) => void
  /** `getDirectoryHandle` calls so far. */
  lookups: () => number
}

function domError(name: string): DOMException {
  return new DOMException(name, name)
}

/**
 * In-memory FSA directory with Chromium semantics the writer relies on:
 * `NotFoundError` / `TypeMismatchError`, non-recursive remove refuses a
 * non-empty dir, `createWritable` truncates and commits on `close`.
 */
export function createMemorySiteDirectory(
  files: Readonly<Record<string, Uint8Array | string>> = {},
): MemorySiteDirectory {
  const ops: string[] = []
  let failure: Error | undefined
  let lookups = 0
  const top: Node = { kind: 'directory', children: new Map() }

  function fileHandle(
    node: Extract<Node, { kind: 'file' }>,
    name: string,
    path: string,
  ): SiteFileHandle {
    return {
      kind: 'file',
      name,
      getFile: () => Promise.resolve(new Blob([node.bytes.slice()])),
      createWritable: () => {
        if (failure !== undefined) {
          const error = failure
          failure = undefined
          return Promise.reject(error)
        }
        const chunks: Uint8Array[] = []
        const writable: SiteWritable = {
          write: (data) => {
            chunks.push(data.slice())
            return Promise.resolve()
          },
          close: () => {
            const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
            const bytes = new Uint8Array(size)
            let at = 0
            for (const chunk of chunks) {
              bytes.set(chunk, at)
              at += chunk.length
            }
            node.bytes = bytes
            ops.push(`write ${path}`)
            return Promise.resolve()
          },
        }
        return Promise.resolve(writable)
      },
    }
  }

  function dirHandle(
    node: Extract<Node, { kind: 'directory' }>,
    name: string,
    path: string,
  ): SiteDirectoryHandle {
    const child = (childName: string): string =>
      path === '' ? childName : `${path}/${childName}`
    return {
      kind: 'directory',
      name,
      getDirectoryHandle: (childName, options) => {
        lookups += 1
        let found = node.children.get(childName)
        if (found?.kind === 'file') {
          return Promise.reject(domError('TypeMismatchError'))
        }
        if (found === undefined) {
          if (options?.create !== true) {
            return Promise.reject(domError('NotFoundError'))
          }
          found = { kind: 'directory', children: new Map() }
          node.children.set(childName, found)
          ops.push(`mkdir ${child(childName)}`)
        }
        return Promise.resolve(dirHandle(found, childName, child(childName)))
      },
      getFileHandle: (childName, options) => {
        let found = node.children.get(childName)
        if (found?.kind === 'directory') {
          return Promise.reject(domError('TypeMismatchError'))
        }
        if (found === undefined) {
          if (options?.create !== true) {
            return Promise.reject(domError('NotFoundError'))
          }
          found = { kind: 'file', bytes: new Uint8Array() }
          node.children.set(childName, found)
        }
        return Promise.resolve(fileHandle(found, childName, child(childName)))
      },
      removeEntry: (childName, options) => {
        const found = node.children.get(childName)
        if (found === undefined) {
          return Promise.reject(domError('NotFoundError'))
        }
        if (
          found.kind === 'directory' &&
          found.children.size > 0 &&
          options?.recursive !== true
        ) {
          return Promise.reject(domError('InvalidModificationError'))
        }
        node.children.delete(childName)
        ops.push(`remove ${child(childName)}`)
        return Promise.resolve()
      },
      values: async function* () {
        for (const [childName, entry] of [...node.children]) {
          yield await Promise.resolve(
            entry.kind === 'file'
              ? fileHandle(entry, childName, child(childName))
              : dirHandle(entry, childName, child(childName)),
          )
        }
      },
    }
  }

  const encoder = new TextEncoder()
  for (const [path, content] of Object.entries(files)) {
    const parts = path.split('/')
    let dir = top
    for (const part of parts.slice(0, -1)) {
      let next = dir.children.get(part)
      if (next === undefined) {
        next = { kind: 'directory', children: new Map() }
        dir.children.set(part, next)
      }
      if (next.kind === 'file') throw new Error(`File in path: ${path}`)
      dir = next
    }
    const name = parts.at(-1)
    // An empty last segment ("a/") seeds an empty directory.
    if (name !== undefined && name !== '') {
      dir.children.set(name, {
        kind: 'file',
        bytes: typeof content === 'string' ? encoder.encode(content) : content,
      })
    }
  }

  return {
    root: dirHandle(top, '', ''),
    ops,
    failNextWrite: (error) => {
      failure = error
    },
    lookups: () => lookups,
  }
}

/** Every file and directory under `dir`, sorted by path; files carry their bytes. */
export async function snapshotSiteDirectory(
  dir: SiteDirectoryHandle,
  prefix = '',
): Promise<[string, Uint8Array | 'dir'][]> {
  const out: [string, Uint8Array | 'dir'][] = []
  for await (const entry of dir.values()) {
    const path = `${prefix}${entry.name}`
    if (entry.kind === 'file') {
      out.push([
        path,
        new Uint8Array(await (await entry.getFile()).arrayBuffer()),
      ])
    } else {
      out.push([path, 'dir'])
      out.push(...(await snapshotSiteDirectory(entry, `${path}/`)))
    }
  }
  return out.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
}
