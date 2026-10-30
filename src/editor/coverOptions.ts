import type { CoverStyle } from '../core'

/** Labels for the cover style choices (kit v7 cover inspector, uikit/src/sandbox/v7.tsx:214-221). */
export const TITLE_FONT_OPTIONS: readonly {
  value: CoverStyle['titleFont']
  label: string
}[] = [
  { value: 'serif-italic', label: 'Serif italic' },
  { value: 'serif', label: 'Serif' },
  { value: 'sans', label: 'Sans' },
]

export const DIRECTION_OPTIONS: readonly {
  value: CoverStyle['spineDirection']
  label: string
}[] = [
  { value: 'top-to-bottom', label: 'Top to bottom' },
  { value: 'bottom-to-top', label: 'Bottom to top' },
]

export const MATERIAL_OPTIONS: readonly {
  value: CoverStyle['material']
  label: string
}[] = [
  { value: 'printed', label: 'Printed' },
  { value: 'linen', label: 'Linen' },
  { value: 'leatherette', label: 'Leatherette' },
]

export const FINISH_OPTIONS: readonly {
  value: CoverStyle['finish']
  label: string
}[] = [
  { value: 'matte', label: 'Matte laminate' },
  { value: 'gloss', label: 'Gloss laminate' },
  { value: 'soft-touch', label: 'Soft touch' },
]

/** Back-panel fills: charcoal (default), paper white, kraft, navy. */
export const BACK_FILL_OPTIONS: readonly { value: string; name: string }[] = [
  { value: '#3e3c3b', name: 'Charcoal' },
  { value: '#f4f1ea', name: 'Paper white' },
  { value: '#c9b79c', name: 'Kraft' },
  { value: '#1f2a44', name: 'Navy' },
]
