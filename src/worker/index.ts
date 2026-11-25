/**
 * The site Worker. Matching static assets are served without it; it runs for
 * `assets.run_worker_first` paths (`/api/cf/*`) and for non-navigation
 * requests that miss every asset (a stale tab importing an old hashed chunk).
 */
import { handleCfRelay, RELAY_PREFIX } from './cfRelay'

export interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

/** Hashed build output; a miss here is a stale chunk, never an SPA route. */
const ASSETS_PREFIX = '/assets/'

const isHtml = (response: Response): boolean =>
  (response.headers.get('Content-Type') ?? '').startsWith('text/html')

/**
 * The assets binding applies `not_found_handling: single-page-application`
 * and answers a missing `/assets/*` file with index.html (200 text/html),
 * which a dynamic `import()` or `new Worker()` cannot tell from code. Turn
 * that fallback into a 404 so the client sees a load error it can recover.
 */
async function serveAsset(request: Request, env: Env): Promise<Response> {
  const response = await env.ASSETS.fetch(request)
  return isHtml(response)
    ? new Response('Not found', {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      })
    : response
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname.startsWith(`${RELAY_PREFIX}/`)) {
      return handleCfRelay(request, (url, init) => fetch(url, init))
    }
    return pathname.startsWith(ASSETS_PREFIX)
      ? serveAsset(request, env)
      : env.ASSETS.fetch(request)
  },
}
