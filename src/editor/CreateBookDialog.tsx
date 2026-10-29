import { useState } from 'react'
import { Button } from '../ui/Button'
import { Dialog, DialogTitle } from '../ui/Dialog'
import { SegmentedControl } from '../ui/SegmentedControl'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import { acceptPositiveCm, createBookFormDefaults } from './createBookForm'
import {
  clampCustomCm,
  CUSTOM_CM_MAX,
  CUSTOM_CM_MIN,
  fmtCm,
  PAGE_SIZE_PRESETS,
  type PageSizePresetId,
  presetLabel,
  resolvePageTrimMm,
  type PageTrimMm,
} from './pageSizePresets'

export interface CreateBookDialogResult {
  title: string
  trim: PageTrimMm
}

export function CreateBookDialog({
  isOpen,
  onCancel,
  onCreate,
  createDisabled = false,
}: {
  isOpen: boolean
  onCancel: () => void
  onCreate: (result: CreateBookDialogResult) => void
  createDisabled?: boolean
}) {
  const defaults = createBookFormDefaults()
  const [title, setTitle] = useState(defaults.title)
  const [presetId, setPresetId] = useState<PageSizePresetId>(defaults.presetId)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    defaults.orientation,
  )
  const [customW, setCustomW] = useState(defaults.customWCm)
  const [customH, setCustomH] = useState(defaults.customHCm)

  const custom = presetId === 'custom'
  const preset = custom
    ? null
    : (PAGE_SIZE_PRESETS.find((p) => p.id === presetId) ?? null)
  const showOrientation = Boolean(
    !custom && preset && preset.wCm !== preset.hCm,
  )

  const reset = () => {
    const next = createBookFormDefaults()
    setTitle(next.title)
    setPresetId(next.presetId)
    setOrientation(next.orientation)
    setCustomW(next.customWCm)
    setCustomH(next.customHCm)
  }

  const go = () => {
    const trim = resolvePageTrimMm({
      presetId,
      orientation,
      customWCm: customW,
      customHCm: customH,
    })
    onCreate({ title, trim })
    reset()
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onCancel()
        }
      }}
      className="pb-create-dialog"
      data-testid="create-book-dialog"
    >
      <div className="px-6 pb-3 pt-5">
        <DialogTitle className="text-xl leading-tight">Create book</DialogTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          A title and a page size — both can change later.
        </p>
      </div>
      <div className="pb-create-body flex flex-col gap-3 px-6 pb-2">
        <TextField
          label="Title"
          aria-label="Title"
          value={title}
          autoFocus
          data-testid="create-title"
          onChange={setTitle}
          onSubmit={go}
        />
        <Select
          label="Page size"
          aria-label="Page size"
          data-testid="create-preset"
          value={presetId}
          onChange={(v) => {
            setPresetId(v as PageSizePresetId)
          }}
          options={[
            ...PAGE_SIZE_PRESETS.map((p) => ({
              value: p.id,
              label: presetLabel(p, orientation === 'landscape'),
            })),
            { value: 'custom', label: 'Custom size…' },
          ]}
        />
        {custom ? (
          <div className="grid grid-cols-2 gap-2" data-testid="create-custom">
            {(
              [
                ['Width', customW, setCustomW, 'w'],
                ['Height', customH, setCustomH, 'h'],
              ] as const
            ).map(([label, value, setValue, key]) => (
              <label key={label} className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {label} (cm)
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={CUSTOM_CM_MIN}
                  max={CUSTOM_CM_MAX}
                  step={0.1}
                  value={value}
                  aria-label={`${label} (cm)`}
                  data-testid={`create-custom-${key}`}
                  onChange={(e) => {
                    setValue(acceptPositiveCm(e.target.value, value))
                  }}
                  onBlur={() => {
                    setValue(clampCustomCm(value))
                  }}
                  className="pb-create-field h-9 rounded-md bg-field px-2.5 text-sm tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-[#535152]"
                />
              </label>
            ))}
            <p className="col-span-2 text-xs text-muted-foreground">
              {CUSTOM_CM_MIN}–{CUSTOM_CM_MAX} cm per side ·{' '}
              {fmtCm(clampCustomCm(customW))} × {fmtCm(clampCustomCm(customH))}{' '}
              cm
            </p>
          </div>
        ) : null}
        {showOrientation ? (
          <div
            className="flex flex-col gap-1.5"
            data-testid="create-orientation"
          >
            <span className="text-xs text-muted-foreground">Orientation</span>
            <SegmentedControl
              label="Orientation"
              value={orientation}
              onChange={(v) => {
                setOrientation(v as 'portrait' | 'landscape')
              }}
              items={[
                { id: 'portrait', label: 'Portrait' },
                { id: 'landscape', label: 'Landscape' },
              ]}
            />
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Size of one page. To print 2 pages per A4 sheet, choose A5.
        </p>
      </div>
      <div className="pb-create-footer flex justify-end gap-2 px-6 pb-5 pt-3">
        <Button variant="ghost" size="md" className="px-4" onPress={onCancel}>
          Cancel
        </Button>
        <Button
          size="md"
          className="px-4"
          isDisabled={createDisabled}
          onPress={go}
          data-testid="create-book"
        >
          Create book
        </Button>
      </div>
    </Dialog>
  )
}
