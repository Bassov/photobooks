import { afterEach, describe, expect, it, vi } from 'vitest'

const fresh = async () => {
  vi.resetModules()
  return import('./glWanted')
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const at = (href: string) => {
  const u = new URL(href)
  vi.stubGlobal('location', {
    protocol: u.protocol,
    hash: u.hash,
    search: u.search,
  })
}

describe('glWanted', () => {
  const webgl2 = (ok: boolean) => {
    const lose = vi.fn()
    const spy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(((kind: string) =>
        kind === 'webgl2' && ok
          ? {
              getExtension: (n: string) =>
                n === 'WEBGL_lose_context' ? { loseContext: lose } : null,
            }
          : null) as never)
    return { spy, lose }
  }

  it('is on with WebGL2, probed once and the probe context released', async () => {
    const { glWanted } = await fresh()
    at('https://x.test/site.html#/book?id=1')
    const { spy, lose } = webgl2(true)

    expect(glWanted()).toBe(true)
    expect(glWanted()).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('webgl2')
    expect(lose).toHaveBeenCalledTimes(1)
  })

  it('is off without WebGL2', async () => {
    const { glWanted } = await fresh()
    at('https://x.test/site.html')
    webgl2(false)

    expect(glWanted()).toBe(false)
  })

  it.each([
    'file:///book/site.html',
    'https://x.test/site.html#/book?gl=0',
    'https://x.test/site.html?gl=0#/book',
  ])('is off for %s', async (href) => {
    const { glWanted } = await fresh()
    at(href)
    const { spy } = webgl2(true)

    expect(glWanted()).toBe(false)
    expect(spy).not.toHaveBeenCalled()
  })

  it('reads the hash flag before the search one', async () => {
    const { glWanted } = await fresh()
    at('https://x.test/site.html?gl=0#/book?gl=1')
    webgl2(true)

    expect(glWanted()).toBe(true)
  })
})
