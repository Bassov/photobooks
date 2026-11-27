import React from 'react'
import { AbsoluteFill, Audio, staticFile } from 'remotion'
import { reelConfig } from './shared/beats.js'
import { shotAt } from './shared/Springs.js'
import { Background } from './shared/Background.jsx'
import { Camera } from './shared/Camera.jsx'
import { Cursor } from './shared/Cursor.jsx'
import { EndCard } from './shared/EndCard.jsx'
import { Focus } from './shared/Focus.jsx'
import { Grain } from './shared/Grain.jsx'
import { PdfSheet, pdfSheetSize } from './shared/PdfSheet.jsx'
import { useCurrentFrame } from 'remotion'

// Placeholder reel until promo-reel-a/b/c add ReelA/B/C.jsx: the shared layers on the stub shot grid, no captured
// clips and no photos (a motion-built spread sheet stands in for the book). Text: the end card only.
const PX_PER_MM = 2.4
const TRIM = { w: 420, h: 210 }
const ART = {
  a: ['#6F8F8A', '#C98B5E'],
  b: ['#2B2A2E', '#C77A3A'],
  c: ['#D07A2E', '#2E5E8C'],
}

const sheetBox = (plane) => {
  const size = pdfSheetSize(TRIM.w, TRIM.h, PX_PER_MM)
  return {
    x: (plane.w - size.w) / 2,
    y: (plane.h - size.h) / 2,
    w: size.w,
    h: size.h,
  }
}

const StubPlane = ({ reel, plane }) => {
  const box = sheetBox(plane)
  const [left, right] = ART[reel]
  return (
    <PdfSheet
      trimW={TRIM.w}
      trimH={TRIM.h}
      pxPerMm={PX_PER_MM}
      x={box.x}
      y={box.y}
    >
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        <div
          style={{
            flex: 1,
            background: `linear-gradient(160deg, ${left}, #1A1918)`,
          }}
        />
        <div
          style={{
            flex: 1,
            background: `linear-gradient(200deg, ${right}, #1A1918)`,
          }}
        />
      </div>
    </PdfSheet>
  )
}

export const ReelStub = ({ reel, table, audio = true, probe = true }) => {
  const frame = useCurrentFrame()
  const { beatFrames } = reelConfig(reel)
  const shot = shotAt(table.shots, frame)
  const end = table.shots.find((s) => s.scale === 'end')
  // The stub's plane is a PDF sheet on the ground: no focus (Designer decision 2026-11-28, Focus.jsx).
  const focus = null
  return (
    <AbsoluteFill>
      <Background reel={reel} />
      <Focus
        reel={reel}
        box={focus}
        render={() => (
          <Camera shot={shot} plane={table.plane}>
            <StubPlane reel={reel} plane={table.plane} />
          </Camera>
        )}
      />
      {table.cursor && frame < (end?.from ?? table.frames) && (
        <Cursor track={table.cursor} />
      )}
      {end && (
        <EndCard
          from={end.from}
          beatFrames={beatFrames}
          reel={reel}
          probe={probe}
        />
      )}
      <Grain reel={reel} />
      {audio && <Audio src={staticFile(`audio/${reel}.wav`)} />}
    </AbsoluteFill>
  )
}
