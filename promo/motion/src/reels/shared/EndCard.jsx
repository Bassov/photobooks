import React, { useLayoutEffect, useRef, useState } from 'react'
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
} from 'remotion'
import { loadFont } from '@remotion/fonts'
import { fitBox, springAt } from './Springs.js'

// Spec v2 G7: Inter with the optical-size axis (kit file), opsz 32, weights 600 / 400.
export const INTER = 'fonts/inter-latin-opsz-normal.woff2'
export const OPSZ = 32
const SANS = 'Inter'
const INK = '#1A1918'
const LIGHT = '#F5F3EF'

const fonts = loadFont({
  family: SANS,
  url: staticFile(INTER),
  weight: '100 900',
})

/** The end card text (spec §2, byte for byte). No other text appears in any reel. */
export const END_TEXT = {
  wordmark: 'Photobooks',
  tagline: 'A quiet place for your books.',
  cta: 'Make your first book →',
  foot: 'Runs in Chrome or Edge. No sign-up, no uploads. · link in bio',
}

/**
 * Spec v2 G7: where the book eases to under the text (output px, `heavy` spring): the open spread 860×606 at x 110,
 * y 300, at its own aspect and one scale. B keeps the phone 700 wide (its body box, Phone.jsx); the text sits over
 * its lower half.
 */
export const END_BOX = { x: 110, y: 300, w: 860, h: 606 }
export const END_PHONE_BOX = { x: 190, y: 219, w: 700, h: 1482.15 }
/** Checks 10–11: the end-card book is ≥ 780 px wide, the phone ≥ 700. */
export const END_MIN_W = { book: 780, phone: 700 }
export const FOOT_MAX_W = 834

/** Spec v2 G7 scrim over the shot's ground (never a flat fill): B .82, A and C .62. */
export const endScrim = (reel) =>
  `linear-gradient(180deg, rgb(12 11 10 / 0) 900px, rgb(12 11 10 / ${reel === 'b' ? 0.82 : 0.62}) 1240px)`

/**
 * `{ x, y, s }` moving `rect` (output px at the start of the end card) into `box` (END_BOX, or END_PHONE_BOX) with
 * the heavy spring. One scale for both axes (fitBox is a contain fit).
 */
export function endMove(rect, frame, from, box = END_BOX) {
  const fit = fitBox(rect, box)
  const p = springAt(frame - from, 'heavy')
  const s = 1 + (fit.s - 1) * p
  // Transform-origin 0 0: the rect's corner travels from where it is to the fitted spot.
  return {
    s,
    x: rect.x + (fit.x - rect.x) * p - rect.x * s,
    y: rect.y + (fit.y - rect.y) * p - rect.y * s,
  }
}

// Mockup.json: left 96; tops 1000 / 1150 / 1262 / 1408.
const LINES = [
  {
    role: 'wordmark',
    top: 1000,
    style: {
      fontWeight: 600,
      fontSize: 128,
      lineHeight: 1,
      letterSpacing: '-0.045em',
      color: LIGHT,
    },
  },
  {
    role: 'tagline',
    top: 1150,
    style: {
      fontWeight: 400,
      fontSize: 56,
      lineHeight: 1.15,
      letterSpacing: '-0.02em',
      color: LIGHT,
    },
  },
  {
    role: 'cta',
    top: 1262,
    style: {
      height: 104,
      padding: '0 52px',
      borderRadius: 52,
      background: LIGHT,
      color: INK,
      fontWeight: 600,
      fontSize: 40,
      letterSpacing: '-0.01em',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    },
  },
  {
    role: 'foot',
    top: 1408,
    style: {
      fontWeight: 400,
      lineHeight: '38px',
      color: 'rgb(245 243 239 / 0.72)',
      whiteSpace: 'nowrap',
    },
  },
]

const STAGGER = 3
const RISE = 24

/**
 * Common end card over the continuing last shot: scrim, then four lines rising 24 px + fading in on the `text`
 * spring, staggered 3 frames from `from` (the downbeat); the CTA arrow nudges 6 px right on the next beat, once.
 * Inter only, weights 600 + 400. With `probe` it logs `REEL_TEXT {json}` every frame: its text boxes and any other
 * text node in the document (reels-render.mjs check 6). `reel` picks the scrim (B is darker).
 */
export const EndCard = ({ from, beatFrames, reel, probe = true }) => {
  const frame = useCurrentFrame()
  const root = useRef(null)
  const foot = useRef(null)
  const [footSize, setFootSize] = useState(28)
  const [handle] = useState(() => delayRender('end card font'))
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    fonts.then(() => document.fonts.ready).then(() => setReady(true))
  }, [])

  useLayoutEffect(() => {
    if (!ready) return
    if (
      foot.current &&
      foot.current.getBoundingClientRect().width > FOOT_MAX_W &&
      footSize === 28
    ) {
      setFootSize(27)
      return
    }
    if (probe) logText(root.current, frame)
    continueRender(handle)
  }, [ready, frame, footSize, probe, handle])

  const local = frame - from
  const nudgeK = frame - (from + beatFrames)
  const nudge =
    nudgeK >= 0 && nudgeK <= 8 ? 6 * Math.sin((Math.PI * nudgeK) / 8) : 0
  const scrim = Math.min(1, Math.max(0, springAt(local, 'text')))

  return (
    <AbsoluteFill
      ref={root}
      style={{
        fontFamily: SANS,
        fontVariationSettings: `'opsz' ${OPSZ}`,
        pointerEvents: 'none',
      }}
    >
      {local >= 0 && (
        <>
          <AbsoluteFill
            style={{ opacity: scrim, background: endScrim(reel) }}
          />
          {LINES.map((line, k) => {
            const p = springAt(local - k * STAGGER, 'text')
            const style = {
              position: 'absolute',
              left: 96,
              top: line.top,
              opacity: Math.min(1, Math.max(0, p)),
              transform: `translateY(${RISE * (1 - p)}px)`,
              ...line.style,
              ...(line.role === 'foot' ? { fontSize: footSize } : null),
            }
            if (line.role === 'cta') {
              return (
                <div key={line.role} data-reel-text={line.role} style={style}>
                  Make your first book{' '}
                  <span
                    style={{
                      display: 'inline-block',
                      transform: `translateX(${nudge}px)`,
                    }}
                  >
                    →
                  </span>
                </div>
              )
            }
            return (
              <div
                key={line.role}
                ref={line.role === 'foot' ? foot : undefined}
                data-reel-text={line.role}
                style={style}
              >
                {END_TEXT[line.role]}
              </div>
            )
          })}
        </>
      )}
    </AbsoluteFill>
  )
}

/**
 * The end-card hero: `children` drawn in a `rect.w × rect.h` box (output px where the shot leaves it), eased by
 * `endMove` into `box` from frame `from`. `kind` is the `data-geom` the checks read: 'endbook' (≥ 780 px wide) or
 * 'phone' (Phone.jsx tags its own body; pass END_PHONE_BOX).
 */
export const EndHero = ({
  rect,
  from,
  box = END_BOX,
  kind = 'endbook',
  children,
}) => {
  const frame = useCurrentFrame()
  const m = endMove(rect, frame, from, box)
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transformOrigin: '0 0',
        transform: `translate(${m.x}px, ${m.y}px) scale(${m.s})`,
      }}
    >
      <div
        data-geom={kind === 'phone' ? undefined : kind}
        style={{
          position: 'absolute',
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** Logs this frame's text: end card boxes (frame px) + every other non-empty text node in the document. */
function logText(rootEl, frame) {
  if (!rootEl) return
  const origin = rootEl.getBoundingClientRect()
  const items = [...rootEl.querySelectorAll('[data-reel-text]')].map((el) => {
    const b = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      role: el.dataset.reelText,
      text: el.textContent,
      x: b.left - origin.left,
      y: b.top - origin.top,
      w: b.width,
      h: b.height,
      font: cs.fontFamily,
      weight: cs.fontWeight,
      style: cs.fontStyle,
      size: parseFloat(cs.fontSize),
    }
  })
  const stray = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.trim()
    if (!text) continue
    const parent = n.parentElement
    if (parent?.closest('[data-reel-text]')) continue
    if (parent?.closest('script, style, noscript')) continue
    stray.push(text)
  }
  console.log(`REEL_TEXT ${JSON.stringify({ frame, items, stray })}`)
}
