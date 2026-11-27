import React from 'react'

/** Spec §2 «Phone»: the 390×844 capture in a body; screen 580×1255.4 at x 250, y 260 (output px). */
export const PHONE = {
  capture: { w: 390, h: 844 },
  screen: { x: 250, y: 260, w: 580, h: 1255.4 },
  bezel: 14,
  radius: 64,
  screenRadius: 52,
}

/** Outer body box in output px (screen + bezel). */
export const phoneBody = () => ({
  x: PHONE.screen.x - PHONE.bezel,
  y: PHONE.screen.y - PHONE.bezel,
  w: PHONE.screen.w + 2 * PHONE.bezel,
  h: PHONE.screen.h + 2 * PHONE.bezel,
})

/**
 * Phone body: 14 px #0E0E0E bezel, radius 64 outside / 52 screen, shadow. It never tilts; no notch, no buttons.
 * `children` are drawn at the 390×844 capture size and scaled into the screen. `move = { x, y, s }` moves the whole
 * body (the end card's `heavy` ease into y 250–940).
 */
export const Phone = ({ move = { x: 0, y: 0, s: 1 }, children }) => {
  const body = phoneBody()
  const k = PHONE.screen.w / PHONE.capture.w
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
        style={{
          position: 'absolute',
          left: PHONE.screen.x,
          top: PHONE.screen.y,
          width: PHONE.screen.w,
          height: PHONE.screen.h,
          borderRadius: PHONE.screenRadius,
          overflow: 'hidden',
          background: '#000',
        }}
      >
        <div
          style={{
            width: PHONE.capture.w,
            height: PHONE.capture.h,
            transformOrigin: '0 0',
            transform: `scale(${k})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
