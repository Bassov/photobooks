import React, { useLayoutEffect, useRef } from 'react'
import {
  AbsoluteFill,
  Img,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
} from 'remotion'

/** Pre-made noise tiles (reels-render.mjs writes them: 540×960, Gaussian σ 18/255 around mid grey). */
export const GRAIN_TILES = 8
export const grainTile = (k) => `grain/grain-${k}.png`

/** Spec v2 G8 «Finish»: the vignette, then grain (v1 tiles) at the reel's opacity. */
export const VIGNETTE =
  'radial-gradient(120% 90% at 50% 45%, transparent 60%, rgb(0 0 0 / 0.14))'
export const GRAIN = { a: 0.08, b: 0.12, c: 0.07 }

/**
 * The last layer of every reel: vignette + film grain over everything (end card included; one tile per frame,
 * cycled, drawn at 2×, overlay blend). With `probe` it logs `REEL_GEOM {json}` every frame: the reel's computed
 * transforms, media boxes, mask / background sizes and the `data-geom` / `data-photo` boxes (reels-render.mjs
 * checks 9–11). Render it as the last child of the reel's root.
 */
export const Finish = ({ reel, probe = true }) => {
  const frame = useCurrentFrame()
  const ref = useRef(null)

  useLayoutEffect(() => {
    if (!probe) return
    const root = ref.current?.parentElement
    if (!root) return
    const handle = delayRender(`geometry probe ${frame}`)
    geomProbe(root)
      .then((data) =>
        console.log(`REEL_GEOM ${JSON.stringify({ frame, ...data })}`),
      )
      .finally(() => continueRender(handle))
  }, [frame, probe])

  return (
    <AbsoluteFill ref={ref} style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ background: VIGNETTE }} />
      <AbsoluteFill
        style={{ mixBlendMode: 'overlay', opacity: GRAIN[reel] ?? GRAIN.a }}
      >
        <Img
          src={staticFile(grainTile(frame % GRAIN_TILES))}
          style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------- the probe (runs in the render browser)

const r2 = (v) => Math.round(v * 100) / 100

function desc(el) {
  const id = el.getAttribute('data-geom') ?? el.getAttribute('data-photo')
  const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : ''
  return `${el.tagName.toLowerCase()}${id ? `[${id}]` : ''}${cls ? `.${cls}` : ''}`
}

// Computed values quote the URL (`url("…")`); a data: SVG may hold unescaped parentheses.
const URL_RE = /url\("((?:[^"\\]|\\.)*)"\)|url\(([^)"']+)\)/
const urlOf = (image) => {
  const m = URL_RE.exec(image)
  return m ? (m[1] ?? m[2]).replace(/\\(.)/g, '$1') : null
}

function imageAspect(src) {
  return new Promise((ok) => {
    const img = new Image()
    img.onload = () => ok([img.naturalWidth, img.naturalHeight])
    img.onerror = () => ok(null)
    img.src = src
  })
}

function intrinsic(el) {
  if (el instanceof HTMLImageElement) return [el.naturalWidth, el.naturalHeight]
  if (el instanceof HTMLVideoElement) return [el.videoWidth, el.videoHeight]
  if (el instanceof HTMLCanvasElement) return [el.width, el.height]
  return null
}

/**
 * Raw facts only (the Node side decides): transforms that are not `none`, every img / video / canvas with its
 * layout box, intrinsic size and object-fit, every mask / background image sized `100% 100%` with its image size,
 * and the output boxes (root px, 1080×1920) of `[data-geom]` and `[data-photo]` elements.
 */
async function geomProbe(root) {
  const media = [...root.querySelectorAll('img, video, canvas')]
  await Promise.all(
    media
      .filter((m) => m instanceof HTMLImageElement && !m.complete)
      .map((m) => m.decode().catch(() => {})),
  )
  const o = root.getBoundingClientRect()
  const k = o.width ? 1080 / o.width : 1
  const box = (el) => {
    const b = el.getBoundingClientRect()
    return [
      r2((b.left - o.left) * k),
      r2((b.top - o.top) * k),
      r2(b.width * k),
      r2(b.height * k),
    ]
  }
  const transforms = []
  const masks = []
  const pending = []
  for (const el of root.querySelectorAll('*')) {
    const cs = getComputedStyle(el)
    if (
      (cs.transform && cs.transform !== 'none') ||
      (cs.scale && cs.scale !== 'none')
    )
      transforms.push({
        el: desc(el),
        transform: cs.transform,
        scale: cs.scale,
      })
    for (const [prop, size, image] of [
      [
        'mask',
        cs.webkitMaskSize || cs.maskSize,
        cs.webkitMaskImage || cs.maskImage,
      ],
      ['background', cs.backgroundSize, cs.backgroundImage],
    ]) {
      const url = image && image !== 'none' ? urlOf(image) : null
      if (!url || !/100% 100%/.test(size ?? '')) continue
      const item = {
        el: desc(el),
        prop,
        size,
        box: [
          el.offsetWidth || el.clientWidth,
          el.offsetHeight || el.clientHeight,
        ],
        image: null,
      }
      masks.push(item)
      pending.push(imageAspect(url).then((wh) => (item.image = wh)))
    }
  }
  await Promise.all(pending)
  const mediaOut = media.map((m) => ({
    el: desc(m),
    tag: m.tagName.toLowerCase(),
    box: [m.clientWidth, m.clientHeight],
    intrinsic: intrinsic(m),
    fit: getComputedStyle(m).objectFit,
  }))
  const geom = [...root.querySelectorAll('[data-geom]')].map((el) => ({
    kind: el.getAttribute('data-geom'),
    css: [el.offsetWidth, el.offsetHeight],
    out: box(el),
  }))
  const photos = [...root.querySelectorAll('[data-photo]')].map((el) => ({
    id: el.getAttribute('data-photo'),
    out: box(el),
  }))
  return { transforms, media: mediaOut, masks, geom, photos }
}
