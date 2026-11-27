import React from 'react'
import { AbsoluteFill, Img } from 'remotion'

// Spec §2 «Background», seen behind W shots, the PDF sheet and the phone. Never beige, never flat.
export const DUSK = 'radial-gradient(120% 80% at 50% 40%, #1C1B1D, #0B0B0C)'
export const BLACK = '#0A0A0A'
// Reel A without a photo (stub, or a shot that names none): a warm daylight wash, still not flat.
const WARM =
  'radial-gradient(120% 80% at 50% 40%, #6E7F7A, #3B4744 60%, #262C2B)'

/**
 * A: the current shot's main photo at cover × 1.2, blur 60 px, brightness .85, saturate 1.1 (changes on each cut).
 * B: deep dusk gradient. C: near-black.
 */
export const Background = ({ reel, photo }) => {
  if (reel === 'b') return <AbsoluteFill style={{ background: DUSK }} />
  if (reel === 'c') return <AbsoluteFill style={{ background: BLACK }} />
  if (!photo) return <AbsoluteFill style={{ background: WARM }} />
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#262C2B' }}>
      <Img
        src={photo}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scale(1.2)',
          filter: 'blur(60px) brightness(0.85) saturate(1.1)',
        }}
      />
    </AbsoluteFill>
  )
}
