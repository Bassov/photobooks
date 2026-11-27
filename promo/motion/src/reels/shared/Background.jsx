import React from 'react'
import { AbsoluteFill, Img } from 'remotion'

/**
 * Spec v2 G2 «No letterbox» grounds, seen behind W shots, the PDF sheet and the phone. Never flat, never black:
 * A = v1 (the current shot's main photo at cover × 1.2, blur 60 px, brightness .85, saturate 1.1; it changes on
 * each cut). B and C = a warm dark radial plus the shot's main photo at cover × 1.2, blur 80 px, brightness .30,
 * opacity .5.
 */
export const GROUND = 'radial-gradient(90% 60% at 50% 44%, #33302D, #171615)'
// Reel A without a photo (stub, or a shot that names none): a warm daylight wash, still not flat.
export const WARM =
  'radial-gradient(120% 80% at 50% 40%, #6E7F7A, #3B4744 60%, #262C2B)'

export const GROUND_PHOTO = {
  a: { filter: 'blur(60px) brightness(0.85) saturate(1.1)', opacity: 1 },
  b: { filter: 'blur(80px) brightness(0.3)', opacity: 0.5 },
  c: { filter: 'blur(80px) brightness(0.3)', opacity: 0.5 },
}

/** `photo` = the shot's main photo (staticFile URL) or nothing. */
export const Background = ({ reel, photo }) => {
  const base = reel === 'a' ? WARM : GROUND
  const look = GROUND_PHOTO[reel] ?? GROUND_PHOTO.a
  return (
    <AbsoluteFill
      data-ground={reel}
      style={{ overflow: 'hidden', background: base }}
    >
      {photo && (
        <Img
          src={photo}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scale(1.2)',
            filter: look.filter,
            opacity: look.opacity,
          }}
        />
      )}
    </AbsoluteFill>
  )
}
