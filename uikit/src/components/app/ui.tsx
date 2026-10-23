/**
 * App-level compositions built ON TOP of the ported JollyUI components (src/components/ui, MIT).
 * Nothing here re-implements a ui/ component; these are editor-specific wrappers
 * (icon buttons with tooltips, collapsible inspector sections, compact number fields,
 * wide dialogs, thumbnail grids, keycaps).
 */
import * as React from "react"
import { useContext } from "react"
import { ChevronRight, Trash2 } from "lucide-react"
import {
  DisclosureStateContext, Heading, Button as AriaButton,
  GridList as AriaGridList, GridListItem as AriaGridListItem,
  type GridListProps, type GridListItemProps,
} from "react-aria-components"
import { Button, type ButtonProps } from "@/components/ui/button"
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip"
import { Disclosure, DisclosurePanel } from "@/components/ui/disclosure"
import { FieldGroup, Label } from "@/components/ui/field"
import { NumberField, NumberFieldInput } from "@/components/ui/numberfield"
import { DialogContent, DialogOverlay } from "@/components/ui/dialog"
import { FeaturedIcon } from "@/components/uui/FeaturedIcon"
import { cn } from "@/lib/utils"

/* Icon-only ghost button (JollyUI Button variant="ghost" size="icon", compact 32px) + JollyUI Tooltip */
export function IconButton({ label, children, tooltip = true, isOpen, placement = "bottom", className, size = "md", ...rest }: {
  label: string; children: React.ReactNode; tooltip?: boolean; isOpen?: boolean; placement?: "top" | "bottom" | "left" | "right"; className?: string; isDisabled?: boolean; size?: "sm" | "md"
} & Omit<ButtonProps, "children" | "className" | "size">) {
  const b = (
    <Button variant="ghost" size="icon" aria-label={label}
      className={cn(size === "sm" ? "size-7" : "size-8", "text-muted-foreground data-[hovered]:text-foreground [&_svg]:size-4", className)} {...rest}>
      {children}
    </Button>
  )
  if (!tooltip) return b
  return (
    <TooltipTrigger delay={400} isOpen={isOpen}>
      {b}
      <Tooltip placement={placement} className="px-2 py-1 text-xs">{label}</Tooltip>
    </TooltipTrigger>
  )
}

/* Collapsible inspector section = JollyUI Disclosure + a compact, quiet header (v1-style eyebrow) */
function SectionHeader({ title, summary, right }: { title: string; summary?: string; right?: React.ReactNode }) {
  const { isExpanded } = useContext(DisclosureStateContext)!
  return (
    <div className="flex items-center gap-1 pr-2">
      <Heading className="m-0 min-w-0 flex-1">
        <AriaButton slot="trigger" className="group/sh flex h-9 w-full items-center gap-1.5 pl-3 pr-1 text-left outline-hidden data-[focus-visible]:ring-2 data-[focus-visible]:ring-inset data-[focus-visible]:ring-ring">
          <ChevronRight aria-hidden className={cn("size-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-200", isExpanded && "rotate-90")} />
          <span className="eyebrow group-data-[hovered]/sh:text-foreground">{title}</span>
          {!isExpanded && summary && <span className="ml-auto truncate pl-2 text-xs font-normal text-muted-foreground">{summary}</span>}
        </AriaButton>
      </Heading>
      {isExpanded && right}
    </div>
  )
}
export function Section({ title, summary, right, defaultExpanded = true, children, className }: {
  title: string; summary?: string; right?: React.ReactNode; defaultExpanded?: boolean; children?: React.ReactNode; className?: string
}) {
  return (
    <Disclosure defaultExpanded={defaultExpanded} className={cn("min-w-0 border-b border-border/80 last:border-b-0", className)}>
      <SectionHeader title={title} summary={summary} right={right} />
      <DisclosurePanel className="text-[13px]"><div className="px-3.5 pb-3.5 pt-0.5">{children}</div></DisclosurePanel>
    </Disclosure>
  )
}

/* Compact number field (v1 look): JollyUI NumberField + FieldGroup, inline prefix + unit, h-8 */
export function NumField({ label, value, unit = "mm", prefix, className }: {
  label: string; value: number; unit?: string; prefix?: string; className?: string
}) {
  return (
    <NumberField defaultValue={value} aria-label={prefix ? label : undefined} className={cn("group flex min-w-0 flex-col gap-1.5", className)}
      formatOptions={{ maximumFractionDigits: 1 }}>
      {!prefix && <Label className="text-xs font-normal text-muted-foreground">{label}</Label>}
      <FieldGroup className="h-8 gap-1.5 rounded-md px-2.5 py-0 text-[13px] shadow-xs data-[focus-within]:ring-offset-0 data-[focus-within]:ring-[3px] data-[focus-within]:ring-ring/30 data-[focus-within]:border-ring">
        {prefix && <span className="min-w-3 shrink-0 text-xs text-muted-foreground">{prefix}</span>}
        <NumberFieldInput className="bg-transparent pr-0 tabular-nums" />
        {unit && <span className="shrink-0 text-xs text-muted-foreground">{unit}</span>}
      </FieldGroup>
    </NumberField>
  )
}

/* JollyUI DialogOverlay + DialogContent with a configurable width (JollyUI default is max-w-lg). */
export function AppModal({ width = 512, isOpen, onOpenChange, isDismissable = true, role, children, className }: {
  width?: number; isOpen?: boolean; onOpenChange?: (open: boolean) => void; isDismissable?: boolean; role?: "dialog" | "alertdialog"; children: React.ReactNode; className?: string
}) {
  return (
    <DialogOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable={isDismissable} className="bg-black/40 backdrop-blur-[1.5px]">
      <DialogContent role={role} closeButton={false} className={cn("max-h-[calc(100%-32px)] max-w-[calc(100%-32px)] gap-0 overflow-auto p-0 shadow-lg sm:rounded-xl", className)} style={{ width }}>
        {children}
      </DialogContent>
    </DialogOverlay>
  )
}

/* ---- AlertDialog: confirm a destructive action (kit v3) ----
 * Composition: soft tinted icon disc · serif title (same face as headings) · calm body copy ·
 * footer right-aligned: quiet Cancel (ghost, gets initial focus) then the ONLY filled destructive
 * button in the product. Not dismissable by outside click; Esc = Cancel.
 * `AlertDialogBody` is the same layout without the modal, for inline specimens. */
type AlertProps = {
  title: React.ReactNode; children?: React.ReactNode; icon?: React.ReactNode; tone?: "destructive" | "neutral"
  confirmLabel?: string; cancelLabel?: string; onConfirm?: () => void; onCancel?: () => void
}
export function AlertDialogBody({ title, children, icon = <Trash2 />, tone = "destructive", confirmLabel = "Remove", cancelLabel = "Cancel", onConfirm, onCancel, inline = false }: AlertProps & { inline?: boolean }) {
  const close = inline ? undefined : "close"
  return (
    <>
      <div className="flex items-start gap-4 px-6 pb-5 pt-6">
        <FeaturedIcon theme="soft" color={tone === "destructive" ? "error" : "gray"} size="md">{icon}</FeaturedIcon>
        <div className="min-w-0 flex-1 pt-0.5">
          {inline ? <div className="heading text-[19px] leading-snug">{title}</div> : <Heading slot="title" className="heading text-[19px] leading-snug">{title}</Heading>}
          {children && <div className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{children}</div>}
        </div>
      </div>
      <div className="flex justify-end gap-2 px-6 pb-5">
        <Button slot={close} variant="ghost" size="sm" className="h-9 px-3.5 text-[13.5px] text-foreground/80 data-[hovered]:text-foreground" onPress={onCancel} autoFocus={!inline}>{cancelLabel}</Button>
        <Button slot={close} variant={tone === "destructive" ? "destructive" : "default"} size="sm" className="h-9 px-4 text-[13.5px]" onPress={onConfirm}>{confirmLabel}</Button>
      </div>
    </>
  )
}
export function AlertDialog({ isOpen, width = 420, ...props }: AlertProps & { isOpen?: boolean; width?: number }) {
  return (
    <AppModal isOpen={isOpen} onOpenChange={isOpen === undefined ? undefined : (o) => { if (!o) props.onCancel?.() }} width={width} isDismissable={false} role="alertdialog">
      <AlertDialogBody {...props} />
    </AppModal>
  )
}

/* Thumbnail grid list (filmstrip, spreads, templates): RAC GridList with JollyUI focus/selection rings */
export function ThumbGrid<T extends object>({ className, ...props }: GridListProps<T>) {
  return <AriaGridList {...props} className={cn("outline-hidden", className as string)} />
}
export function ThumbItem({ className, ...props }: GridListItemProps & { className?: string }) {
  return (
    <AriaGridListItem {...props}
      className={({ isSelected, isFocusVisible }) => cn(
        "relative cursor-default select-none rounded-md outline-hidden transition-shadow",
        isSelected ? "ring-2 ring-select ring-offset-2 ring-offset-chrome" : "data-[hovered]:ring-1 data-[hovered]:ring-ring/60 data-[hovered]:ring-offset-2 data-[hovered]:ring-offset-chrome",
        isFocusVisible && "ring-2 ring-ring ring-offset-2 ring-offset-chrome",
        className)} />
  )
}

/* ---- Photo thumbnails: one aspect rule for every photo strip/grid in the kit ----
 * Fixed row height, width follows the photo's own aspect ratio, so landscape, portrait and
 * square originals read as what they are (like Lightroom's filmstrip / Apple Photos "aspect" view).
 * The ratio is clamped to 5:8 … 8:5; beyond that (panoramas, very tall scans) the image is
 * centre-cropped (object-cover) to the limit so one photo can't take over the strip.
 * Neutral backdrop (bg-muted) shows while loading; a hairline inset ring keeps light photos
 * from bleeding into the chrome. */
export const THUMB_RATIO = { min: 5 / 8, max: 8 / 5 } as const
export const thumbRatio = (w: number, h: number) => Math.min(Math.max(w / h, THUMB_RATIO.min), THUMB_RATIO.max)
export const thumbWidth = (w: number, h: number, height: number) => Math.round(thumbRatio(w, h) * height)
export function PhotoThumb({ src, w, h, height, className, children }: {
  src: string; w: number; h: number; height?: number; className?: string; children?: React.ReactNode
}) {
  return (
    <div className={cn("relative shrink-0 overflow-hidden bg-muted", height === undefined && "h-(--thumb)", className)}
      style={height === undefined ? { aspectRatio: thumbRatio(w, h) } : { width: thumbWidth(w, h, height), height }}>
      <img src={src} className="size-full object-cover" draggable={false} alt="" />
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_rgb(0_0_0/.07)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/.06)]" />
      {children}
    </div>
  )
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-sans text-[11px] font-medium text-muted-foreground", className)}>{children}</kbd>
}
