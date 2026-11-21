import { cn } from '../ui/cn'
import { SegmentedControl } from '../ui/SegmentedControl'
import { setUiScaleChoice, useUiScale, type UiScaleStep } from '../ui/uiScale'

type ScaleId = '100' | '125' | '150'

const STEP_OF: Readonly<Record<ScaleId, UiScaleStep>> = {
  '100': 1,
  '125': 1.25,
  '150': 1.5,
}

const ITEMS = (['100', '125', '150'] as const).map((id) => ({
  id,
  label: `${id}%`,
  testId: `interface-size-${id}`,
}))

const percent = (step: number): string => String(Math.round(step * 100))

/** Settings → Interface (design interface-size §1): the per-computer UI scale. */
export function InterfaceSettingsSection({ row }: { row: string }) {
  const { choice, effective } = useUiScale()
  const clamped = effective < choice
  return (
    <>
      <p className="mt-1 max-w-[560px] text-sm leading-relaxed text-muted-foreground">
        How big Photobooks looks on this screen. Saved for this computer.
      </p>
      {/* Narrow main (< 704): the row wraps, as HostingSetup's form rows. */}
      <div className="mt-5 @container">
        <div
          className="max-w-[640px] overflow-hidden rounded-xl bg-chrome"
          data-testid="interface-settings"
        >
          <div
            className={cn(row, '@max-[704px]:flex-wrap @max-[704px]:gap-y-1.5')}
            data-testid="interface-size-row"
          >
            <span
              id="interface-size-label"
              className="w-[160px] shrink-0 text-sm @max-[704px]:w-full"
            >
              Interface size
            </span>
            <div className="min-w-0 flex-1">
              <SegmentedControl
                label="Interface size"
                labelledBy="interface-size-label"
                testId="interface-size"
                size="md"
                className="w-56"
                items={ITEMS}
                value={percent(choice) as ScaleId}
                onChange={(id) => {
                  setUiScaleChoice(STEP_OF[id])
                }}
              />
              <div
                id="interface-size-hint"
                aria-live="polite"
                className={cn(
                  'mt-1 text-xs leading-[16.8px]',
                  clamped ? 'text-foreground' : 'text-muted-foreground',
                )}
                data-testid="interface-size-hint"
              >
                {clamped
                  ? `Window too small for ${percent(choice)}%: showing ${percent(effective)}%.`
                  : 'Bigger text and controls for 4K screens.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
