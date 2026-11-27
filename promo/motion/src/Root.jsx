import React from 'react'
import { AbsoluteFill, Composition, Freeze } from 'remotion'
import {
  FPS,
  FORMATS,
  Promo,
  Sheet,
  Strip,
  TOTAL_FRAMES,
  sheetSize,
  stripSize,
} from './Promo.jsx'
import {
  HEIGHT,
  REEL_IDS,
  SHEET_CELL,
  SHEET_COLS,
  WIDTH,
  sheetFrames,
  sheetSize as reelSheetSize,
} from './reels/shared/beats.js'
import { ReelStub } from './reels/ReelStub.jsx'
import { stubShots } from './reels/stub.shots.js'
import { ReelB } from './reels/ReelB.jsx'
import bShots from './reels/b.shots.js'

// Input props come from scripts/render.mjs (clip durations read from promo/out/clips.json, music on/off).
const defaultProps = { clips: {}, music: false }

// Reels (promo-reels-3): each reel's component + shot table. promo-reel-a/b/c swap the stub for ReelA/B/C.jsx and
// a/b/c.shots.js here.
const REEL_PARTS = Object.fromEntries(
  REEL_IDS.map((reel) => [
    reel,
    { Component: ReelStub, table: stubShots(reel) },
  ]),
)
REEL_PARTS.b = { Component: ReelB, table: bShots }

const Reel = ({ reel, audio }) => {
  const { Component, table } = REEL_PARTS[reel]
  return <Component reel={reel} table={table} audio={audio} />
}

// Self-check sheet: one 270×480 cell per 0.5 s, 6 columns, no labels or gaps.
const ReelSheet = ({ reel }) => {
  const { Component, table } = REEL_PARTS[reel]
  const scale = SHEET_CELL.w / WIDTH
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {sheetFrames(table.frames).map((f, k) => (
        <div
          key={f}
          style={{
            position: 'absolute',
            left: (k % SHEET_COLS) * SHEET_CELL.w,
            top: Math.floor(k / SHEET_COLS) * SHEET_CELL.h,
            width: SHEET_CELL.w,
            height: SHEET_CELL.h,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: WIDTH,
              height: HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: '0 0',
              position: 'relative',
            }}
          >
            <Freeze frame={f}>
              <Component
                reel={reel}
                table={table}
                audio={false}
                probe={false}
              />
            </Freeze>
          </div>
        </div>
      ))}
    </AbsoluteFill>
  )
}

const upper = (reel) => reel.toUpperCase()

export const RemotionRoot = () => (
  <>
    {Object.entries(FORMATS).map(([format, f]) => (
      <React.Fragment key={format}>
        <Composition
          id={`Promo${format}`}
          component={Promo}
          durationInFrames={TOTAL_FRAMES}
          fps={FPS}
          width={f.width}
          height={f.height}
          defaultProps={{ ...defaultProps, format }}
        />
        <Composition
          id={`Sheet${format}`}
          component={Sheet}
          // Full length: a shorter composition would cut the frozen scenes' Sequences short. Rendered as a still at 0.
          durationInFrames={TOTAL_FRAMES}
          fps={FPS}
          width={sheetSize(format).width}
          height={sheetSize(format).height}
          defaultProps={{ ...defaultProps, format }}
        />
        <Composition
          id={`Strip${format}`}
          component={Strip}
          durationInFrames={TOTAL_FRAMES}
          fps={FPS}
          width={stripSize(format).width}
          height={stripSize(format).height}
          defaultProps={{ ...defaultProps, format, clip: '02-add-folder' }}
        />
      </React.Fragment>
    ))}
    {REEL_IDS.map((reel) => {
      const { frames } = REEL_PARTS[reel].table
      const sheet = reelSheetSize(frames)
      return (
        <React.Fragment key={reel}>
          <Composition
            id={`Reel${upper(reel)}`}
            component={Reel}
            durationInFrames={frames}
            fps={FPS}
            width={WIDTH}
            height={HEIGHT}
            defaultProps={{ reel, audio: true }}
          />
          <Composition
            id={`ReelSheet${upper(reel)}`}
            component={ReelSheet}
            durationInFrames={frames}
            fps={FPS}
            width={sheet.width}
            height={sheet.height}
            defaultProps={{ reel }}
          />
        </React.Fragment>
      )
    })}
  </>
)
