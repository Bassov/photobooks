import React from 'react'
import { Composition } from 'remotion'
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

// Input props come from scripts/render.mjs (clip durations read from promo/out/clips.json, music on/off).
const defaultProps = { clips: {}, music: false }

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
  </>
)
