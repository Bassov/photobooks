import React from 'react'

/**
 * Spec v2 G3 B8/B9 «Phone»: body 700×1482 at x 190, y 219 (output px), bezel 14, radius 64 outside / 52 screen.
 * The 390×844 capture is scaled by 672/390 on both axes (one scale, G1), so the screen is 672 × 1454.2.
 */
const CAPTURE = { w: 390, h: 844 }
const BEZEL = 14
const SCREEN_W = 672
const SCALE = SCREEN_W / CAPTURE.w
export const PHONE = {
  capture: CAPTURE,
  scale: SCALE,
  screen: {
    x: 190 + BEZEL,
    y: 219 + BEZEL,
    w: SCREEN_W,
    h: CAPTURE.h * SCALE,
  },
  bezel: BEZEL,
  radius: 64,
  screenRadius: 52,
}

/** Outer body box in output px (screen + bezel): 700 × 1482.2 at x 190, y 219. */
export const phoneBody = () => ({
  x: PHONE.screen.x - PHONE.bezel,
  y: PHONE.screen.y - PHONE.bezel,
  w: PHONE.screen.w + 2 * PHONE.bezel,
  h: PHONE.screen.h + 2 * PHONE.bezel,
})

/**
 * Phone body: 14 px #0E0E0E bezel, shadow. It never tilts; no notch, no buttons. `children` are drawn at the
 * 390×844 capture size and scaled into the screen. `move = { x, y, s }` moves the whole body (one scale).
 * The body carries `data-geom="phone"` (reels-render.mjs checks 10, 11 read its box).
 */
export const Phone = ({ move = { x: 0, y: 0, s: 1 }, children }) => {
  const body = phoneBody()
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transformOrigin: '0 0',
        transform: `translate(${move.x}px, ${move.y}px) scale(${move.s})`,
      }}
    >
      <div
        data-geom="phone"
        style={{
          position: 'absolute',
          left: body.x,
          top: body.y,
          width: body.w,
          height: body.h,
          borderRadius: PHONE.radius,
          background: '#0E0E0E',
          boxShadow: '0 50px 90px -30px rgb(0 0 0 / 0.7)',
        }}
      />
      <div
        data-geom="screen"
        style={{
          position: 'absolute',
          left: PHONE.screen.x,
          top: PHONE.screen.y,
          width: PHONE.screen.w,
          height: PHONE.screen.h,
          borderRadius: PHONE.screenRadius,
          overflow: 'hidden',
          background: '#0E0E0E',
        }}
      >
        <div
          style={{
            width: PHONE.capture.w,
            height: PHONE.capture.h,
            transformOrigin: '0 0',
            transform: `scale(${PHONE.scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
