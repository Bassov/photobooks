import React from 'react'
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion'
import { reelConfig } from './beats.js'

/** Pre-made noise tiles (reels-render.mjs writes them: 540×960, Gaussian σ 18/255 around mid grey). */
export const GRAIN_TILES = 8
export const grainTile = (k) => `grain/grain-${k}.png`

/** Film grain over everything (end card included): one tile per frame, cycled, drawn at 2×, overlay blend. */
export const Grain = ({ reel }) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill
      style={{
        mixBlendMode: 'overlay',
        opacity: reelConfig(reel).grain,
        pointerEvents: 'none',
      }}
    >
      <Img
        src={staticFile(grainTile(frame % GRAIN_TILES))}
        style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }}
      />
    </AbsoluteFill>
  )
}
