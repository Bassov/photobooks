/** URL path / query characters a site link keeps (no scheme `:`, no markup). */
const PATH_CHARS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~/?=&%'

/** `URL.host` characters (punycode hostname, `:port`). */
const HOST_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789-.:'

/**
 * `text` without the characters `allowed` does not list; every kept character
 * is read from `allowed`, so nothing of `text` itself reaches the result.
 */
function keep(text: string, allowed: string): string {
  let kept = ''
  for (const ch of text) {
    const at = allowed.indexOf(ch)
    if (at >= 0) kept += allowed.charAt(at)
  }
  return kept
}

/**
 * Link from page data (`#site-data`): always page-relative, so a tampered
 * page can neither leave the site nor run a `javascript:` URL.
 */
export function pageHref(href: string): string {
  return `./${keep(href, PATH_CHARS)}`
}

function parseUrl(text: string): URL | undefined {
  try {
    return new URL(text)
  } catch {
    return undefined
  }
}

/**
 * Absolute URL of the page at `path` (`''`, `books/<key>/`) on an http(s)
 * site URL; `undefined` without one (empty, unparsable, other scheme).
 */
export function sitePageUrl(
  siteUrl: string | undefined,
  path: string,
): string | undefined {
  const parsed = siteUrl === undefined ? undefined : parseUrl(siteUrl)
  const scheme =
    parsed?.protocol === 'https:'
      ? 'https://'
      : parsed?.protocol === 'http:'
        ? 'http://'
        : undefined
  if (parsed === undefined || scheme === undefined) return undefined
  const base = parsed.pathname.endsWith('/')
    ? parsed.pathname.slice(0, -1)
    : parsed.pathname
  return `${scheme}${keep(parsed.host, HOST_CHARS)}${keep(base, PATH_CHARS)}/${keep(path, PATH_CHARS)}`
}
