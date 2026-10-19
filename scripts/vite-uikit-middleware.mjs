/**
 * Mount the uikit Vite app under /uikit/ in the root dev server.
 * Separate Vite project → separate module graph from the app.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer as createViteServer } from 'vite'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * @returns {import('vite').Plugin}
 */
export function uikitDevMiddleware() {
  /** @type {import('vite').ViteDevServer | undefined} */
  let uikit
  /** @type {Promise<import('vite').ViteDevServer> | undefined} */
  let starting

  return {
    name: 'uikit-dev-middleware',
    apply: 'serve',
    async configureServer(server) {
      const ensure = async () => {
        if (uikit) return uikit
        if (!starting) {
          starting = createViteServer({
            configFile: path.join(ROOT, 'uikit/vite.config.ts'),
            root: path.join(ROOT, 'uikit'),
            base: '/uikit/',
            appType: 'spa',
            server: {
              middlewareMode: true,
              hmr: server.httpServer ? { server: server.httpServer } : true,
            },
          }).then((s) => {
            uikit = s
            return s
          })
        }
        return starting
      }

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/uikit')) {
          next()
          return
        }
        try {
          const nested = await ensure()
          nested.middlewares(req, res, next)
        } catch (err) {
          next(err)
        }
      })
    },
    async closeBundle() {
      if (uikit) {
        await uikit.close()
        uikit = undefined
        starting = undefined
      }
    },
  }
}
