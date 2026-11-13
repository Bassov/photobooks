/*
 * The GL switch, kept outside `gl/` so the site entry can ask it without
 * pulling `gl/three.ts` (and three) out of the lazy chunks.
 */
const param = (query: string) => new URLSearchParams(query).get('gl')
let webgl2: boolean | undefined
/**
 * GL is on unless `?gl=0` (in the hash route or the search), the page runs
 * from disk (no module import) or there is no WebGL2.
 */
export function glWanted(): boolean {
  if (location.protocol === 'file:') return false
  const flag =
    param(location.hash.split('?')[1] ?? '') ?? param(location.search)
  if (flag === '0') return false
  if (webgl2 === undefined) {
    const gl = document.createElement('canvas').getContext('webgl2')
    webgl2 = gl !== null
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  }
  return webgl2
}
