export const CODECOV_VALIDATE_TIMEOUT_MS = 2500

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
