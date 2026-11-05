/** Lowercase hex SHA-256 of `bytes` (Web Crypto: digests off the main thread). */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}
