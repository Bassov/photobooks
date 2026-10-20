/** Default Codecov validate fetch timeout (ms). */
export const CODECOV_VALIDATE_TIMEOUT_MS = 2500

/**
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 * @param {RequestInit} [init]
 * @param {number} [timeoutMs]
 */
export function fetchWithTimeout(
  fetchImpl,
  url,
  init = {},
  timeoutMs = CODECOV_VALIDATE_TIMEOUT_MS,
) {
  const next = { ...init }
  next.signal = AbortSignal.timeout(timeoutMs)
  return fetchImpl(url, next)
}
