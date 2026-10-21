/** Kit copy + iPhone Settings › Camera › Formats conversion hint. */
export const HEIC_UNSUPPORTED_MESSAGE =
  "HEIC isn't supported yet. Export it as JPEG (on iPhone: Settings › Camera › Formats › Most Compatible) and try again."

const HEIC_SNIFF_BYTES = 32

function isHeicBrand(brand: string): boolean {
  switch (brand) {
    case 'heic':
    case 'heix':
    case 'hevc':
    case 'hevx':
    case 'heim':
    case 'heis':
    case 'mif1':
    case 'msf1':
      return true
    // Stryker disable next-line ConditionalExpression: omitting default return is equivalent (undefined is falsy in callers)
    default:
      return false
  }
}

export function isHeicByName(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.heic') || lower.endsWith('.heif')
}

export function isHeicMime(type: string): boolean {
  const mime = type.toLowerCase()
  return (
    mime === 'image/heic' ||
    mime === 'image/heif' ||
    mime === 'image/heic-sequence' ||
    mime === 'image/heif-sequence'
  )
}

/** Name or MIME HEIC/HEIF check (signature sniff is separate). */
export function isHeicLikeFile(file: { name: string; type: string }): boolean {
  return isHeicMime(file.type) || isHeicByName(file.name)
}

/** True when the basename has a non-empty extension (dot not first/last). */
export function hasFileExtension(name: string): boolean {
  const dot = name.lastIndexOf('.')
  return dot > 0 && dot < name.length - 1
}

/**
 * Reject-path sniff candidate: not already HEIC-tagged, empty/octet-stream MIME,
 * and no file extension.
 */
export function isHeicSniffCandidate(
  file: { name: string; type: string },
  reason: string,
): boolean {
  if (reason === 'heic') {
    return false
  }
  const mime = file.type.toLowerCase()
  if (mime !== '' && mime !== 'application/octet-stream') {
    return false
  }
  return !hasFileExtension(file.name)
}

function fourCC(view: Uint8Array, offset: number): string {
  return String.fromCharCode(
    view.at(offset) ?? 0,
    view.at(offset + 1) ?? 0,
    view.at(offset + 2) ?? 0,
    view.at(offset + 3) ?? 0,
  )
}

/**
 * ISO-BMFF `ftyp` at offset 4 with major or compatible brand in the HEIC set.
 */
export function isHeicSignature(bytes: ArrayBuffer | ArrayBufferView): boolean {
  const view =
    bytes instanceof ArrayBuffer
      ? new Uint8Array(bytes)
      : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // Stryker disable next-line ConditionalExpression,EqualityOperator,BlockStatement: length&lt;12 vs ≤12 / empty guard — short buffers still fail the ftyp+brand checks below
  if (view.byteLength < 12) {
    return false
  }
  if (fourCC(view, 4) !== 'ftyp') {
    return false
  }
  if (isHeicBrand(fourCC(view, 8))) {
    return true
  }
  for (let offset = 16; offset + 4 <= view.byteLength; offset += 4) {
    if (isHeicBrand(fourCC(view, offset))) {
      return true
    }
  }
  return false
}

/** First 32 bytes only — for unknown-type reject sniffing. */
export async function fileHasHeicSignature(file: Blob): Promise<boolean> {
  const head = await file.slice(0, HEIC_SNIFF_BYTES).arrayBuffer()
  return isHeicSignature(head)
}

export interface HeicSniffReject {
  file: File
  message: string
  reason: string
}

/**
 * Upgrade unknown-type rejects whose head matches a HEIC signature.
 * `mapConcurrent` caps parallel reads (caller passes IMPORT_BODY_READ_CAP).
 */
export async function upgradeRejectedWithHeicSniff<T extends HeicSniffReject>(
  rejected: readonly T[],
  mapConcurrent: <U>(
    items: readonly U[],
    limit: number,
    fn: (item: U) => Promise<void>,
  ) => Promise<void>,
  concurrency: number,
): Promise<T[]> {
  const needsSniff = rejected.filter((entry) =>
    isHeicSniffCandidate(entry.file, entry.reason),
  )
  if (needsSniff.length === 0) {
    return [...rejected]
  }
  const upgrades = new Set<File>()
  await mapConcurrent(needsSniff, concurrency, async (entry) => {
    if (await fileHasHeicSignature(entry.file)) {
      upgrades.add(entry.file)
    }
  })
  if (upgrades.size === 0) {
    return [...rejected]
  }
  return rejected.map((entry) =>
    upgrades.has(entry.file)
      ? {
          ...entry,
          message: HEIC_UNSUPPORTED_MESSAGE,
          reason: 'heic',
        }
      : entry,
  )
}
