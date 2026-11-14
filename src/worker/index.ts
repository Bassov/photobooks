/**
 * The site Worker. Static assets are served without it; only
 * `assets.run_worker_first` paths (`/api/cf/*`) reach this script.
 */
import { handleCfRelay, RELAY_PREFIX } from './cfRelay'

export interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    return pathname.startsWith(`${RELAY_PREFIX}/`)
      ? handleCfRelay(request, (url, init) => fetch(url, init))
      : env.ASSETS.fetch(request)
  },
}
