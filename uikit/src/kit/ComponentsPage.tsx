/* Components page: every ported component in its variants and states, light and dark side by side, interactive. */
import * as React from "react"
import {
  Download, Trash2, Bold, Italic, Underline, Check, CloudOff, Copy, FolderOpen, Pencil, AlertTriangle, CircleCheck, Search,
  MousePointer2, Hand, Type, LayoutTemplate, Link2, Maximize, Minimize, Undo2, Redo2, Grid3x3, Magnet, Loader2, Plus, Info, Images, Settings, ChevronDown, Eye,
} from "lucide-react"
import { TooltipTrigger } from "react-aria-components"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Toggle, ToggleButtonGroup } from "@/components/ui/toggle"
import { Toolbar } from "@/components/ui/toolbar"
import { JollyTextField, TextField, Input, TextArea } from "@/components/ui/textfield"
import { JollyNumberField } from "@/components/ui/numberfield"
import { SearchField, SearchFieldGroup, SearchFieldInput, SearchFieldClear } from "@/components/ui/searchfield"
import { JollySelect, SelectItem } from "@/components/ui/select"
import { ListBox, ListBoxItem, ListBoxSection, ListBoxHeader } from "@/components/ui/list-box"
import { Switch } from "@/components/ui/switch"
import { Checkbox, JollyCheckboxGroup } from "@/components/ui/checkbox"
import { Tabs, TabList, Tab, TabPanel, TabCount } from "@/components/ui/tabs"
import { Menu, MenuItem, MenuSeparator, MenuKeyboard, MenuTrigger, MenuPopover, MenuHeader, MenuSection } from "@/components/ui/menu"
import { Tooltip } from "@/components/ui/tooltip"
import { Popover, PopoverTrigger, PopoverDialog } from "@/components/ui/popover"
import { DialogTrigger, DialogOverlay, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Disclosure, DisclosureHeader, DisclosurePanel, DisclosureGroup } from "@/components/ui/disclosure"
import { GridList, GridListItem } from "@/components/ui/grid-list"
import { Progress, JollyProgressBar } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/field"
import { createToastQueue, ToastRegion } from "@/components/ui/toast"
import { Badge } from "@/components/uui/Badge"
import { FeaturedIcon } from "@/components/uui/FeaturedIcon"
import { IconButton, Section, NumField, AlertDialog, AlertDialogBody, ThumbGrid, ThumbItem, PhotoThumb, Kbd } from "@/components/app/ui"
import { SliderRow, SwitchRow, Segmented, SelectRow } from "@/components/app/controls"
import { P } from "@/data"
import { KitBar } from "./Shell"

/* Forces RAC interaction states for the specimen (sets data-* on the rendered element after mount). */
function Force({ state, children }: { state: ("hovered" | "focus-visible" | "pressed" | "focused" | "focus-within")[]; children: React.ReactNode }) {
  const ref = React.useRef<HTMLSpanElement>(null)
  React.useEffect(() => {
    const el = ref.current?.firstElementChild as HTMLElement | null
    if (!el) return
    const targets = [el, ...Array.from(el.querySelectorAll<HTMLElement>("[data-rac],input,[role=group]"))]
    for (const t of targets.slice(0, 3)) for (const s of state) t.setAttribute(`data-${s}`, "true")
  })
  return <span ref={ref} className="contents">{children}</span>
}
const StateLabel = ({ children }: { children: React.ReactNode }) => <span className="text-[10.5px] text-muted-foreground">{children}</span>
function StateRow({ cells }: { cells: [string, React.ReactNode][] }) {
  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
      {cells.map(([l, c]) => <div key={l} className="flex flex-col items-start gap-1.5">{c}<StateLabel>{l}</StateLabel></div>)}
    </div>
  )
}
const Sub = ({ children }: { children: React.ReactNode }) => <div className="eyebrow mb-2.5 mt-5 first:mt-0">{children}</div>

type Spec = { id: string; name: string; file: string; source: "JollyUI" | "Untitled UI" | "app"; note?: string; render: () => React.ReactNode; wide?: boolean }
const tool = "size-8 px-0 text-muted-foreground data-[hovered]:bg-accent/70 data-[hovered]:text-foreground data-[selected]:bg-background data-[selected]:text-foreground data-[selected]:shadow-sm dark:data-[selected]:bg-accent [&_svg]:size-4"
const sb = "h-8 gap-1.5 px-3 text-[13px] [&_svg]:size-4"

const toastQueue = createToastQueue()
/* ThumbGrid specimen: mixed orientations (p21 is a square crop, p04 a 1.9:1 panorama → cropped to 8:5) */
const THUMB_SPECIMEN: [string, string][] = [["p08", "3:2"], ["p03", "2:3"], ["p21", "1:1"], ["p20", "2:3"], ["p04", "pano"]]

const SPECS: Spec[] = [
  {
    id: "button", name: "Button", file: "ui/button.tsx", source: "JollyUI", note: "variant × size; states: default / hover / focus-visible / pressed / disabled / loading",
    render: () => (
      <>
        <Sub>Variants</Sub>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" className={cn(sb, "shadow-sm")}><Download />Export</Button>
          <Button variant="outline" size="sm" className={cn(sb, "shadow-xs")}>Outline</Button>
          <Button variant="secondary" size="sm" className={sb}>Secondary</Button>
          <Button variant="ghost" size="sm" className={sb}>Ghost</Button>
          <Button variant="link" size="sm" className="h-8 px-1 text-[13px]">Link</Button>
        </div>
        <Sub>Destructive · outline / ghost in the UI, filled only inside an AlertDialog</Sub>
        <StateRow cells={[
          ["outline", <Button variant="destructive-outline" size="sm" className={sb}><Trash2 />Remove book…</Button>],
          ["hover", <Force state={["hovered"]}><Button variant="destructive-outline" size="sm" className={sb}><Trash2 />Remove book…</Button></Force>],
          ["ghost", <Button variant="destructive-ghost" size="sm" className={sb}><Trash2 />Delete frame</Button>],
          ["ghost hover", <Force state={["hovered"]}><Button variant="destructive-ghost" size="sm" className={sb}><Trash2 />Delete frame</Button></Force>],
          ["focus-visible", <Force state={["focus-visible"]}><Button variant="destructive-outline" size="sm" className={sb}>Disconnect</Button></Force>],
          ["filled (dialog)", <Button variant="destructive" size="sm" className="h-9 px-4 text-[13.5px]">Remove</Button>],
          ["filled hover", <Force state={["hovered"]}><Button variant="destructive" size="sm" className="h-9 px-4 text-[13.5px]">Remove</Button></Force>],
        ]} />
        <Sub>Sizes</Sub>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" className="h-8 px-3 text-[13px]">Compact 32</Button><Button size="sm">sm 36</Button><Button>default 40</Button><Button size="lg">lg 44</Button>
          <Button size="icon" variant="outline" aria-label="Settings"><Settings className="size-4" /></Button>
        </div>
        <Sub>States (primary · outline)</Sub>
        <StateRow cells={[
          ["default", <Button size="sm" className={sb}>Save</Button>],
          ["hover", <Force state={["hovered"]}><Button size="sm" className={sb}>Save</Button></Force>],
          ["focus-visible", <Force state={["focus-visible"]}><Button size="sm" className={sb}>Save</Button></Force>],
          ["pressed", <Force state={["pressed", "hovered"]}><Button size="sm" className={cn(sb, "data-[pressed]:scale-[.98]")}>Save</Button></Force>],
          ["disabled", <Button size="sm" isDisabled className={sb}>Save</Button>],
          ["loading", <Button size="sm" isPending className={sb}><Loader2 className="animate-spin" />Saving…</Button>],
        ]} />
        <div className="mt-3" />
        <StateRow cells={[
          ["default", <Button variant="outline" size="sm" className={cn(sb, "shadow-xs")}>Cancel</Button>],
          ["hover", <Force state={["hovered"]}><Button variant="outline" size="sm" className={cn(sb, "shadow-xs")}>Cancel</Button></Force>],
          ["focus-visible", <Force state={["focus-visible"]}><Button variant="outline" size="sm" className={cn(sb, "shadow-xs")}>Cancel</Button></Force>],
          ["disabled", <Button variant="outline" size="sm" isDisabled className={cn(sb, "shadow-xs")}>Cancel</Button>],
        ]} />
      </>
    ),
  },
  {
    id: "icon-button", name: "IconButton + Tooltip", file: "app/ui.tsx", source: "app", note: "ghost icon button, tooltip shows the shortcut",
    render: () => (
      <>
        <StateRow cells={[
          ["md 32", <IconButton label="Undo (Ctrl+Z)"><Undo2 /></IconButton>],
          ["sm 28", <IconButton label="Redo" size="sm"><Redo2 /></IconButton>],
          ["hover", <Force state={["hovered"]}><IconButton label="Grid" tooltip={false}><Grid3x3 /></IconButton></Force>],
          ["focus-visible", <Force state={["focus-visible"]}><IconButton label="Grid" tooltip={false}><Grid3x3 /></IconButton></Force>],
          ["disabled", <IconButton label="Nothing to redo" isDisabled><Redo2 /></IconButton>],
        ]} />
        <Sub>Tooltip · hover the buttons above; static specimen</Sub>
        <div className="flex items-center gap-3">
          <TooltipTrigger delay={0}>
            <Button variant="outline" size="sm" className={cn(sb, "shadow-xs")}><Magnet />Snap</Button>
            <Tooltip placement="top" className="flex items-center gap-2 px-2 py-1 text-xs">Snap to grid & guides <Kbd className="h-[18px]">Shift+S</Kbd></Tooltip>
          </TooltipTrigger>
          <span className="flex items-center gap-2 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md">Snap to grid & guides <Kbd className="h-[18px]">Shift+S</Kbd></span>
        </div>
      </>
    ),
  },
  {
    id: "toggle", name: "Toggle · ToggleButtonGroup · Segmented", file: "ui/toggle.tsx · app/controls.tsx", source: "JollyUI",
    render: () => (
      <>
        <Sub>Tool group (single)</Sub>
        <ToggleButtonGroup selectionMode="single" disallowEmptySelection defaultSelectedKeys={["v"]} aria-label="Tool" className="w-max gap-0.5 rounded-lg bg-muted p-0.5 dark:bg-black/25">
          <Toggle id="v" size="sm" aria-label="Select" className={tool}><MousePointer2 /></Toggle><Toggle id="t" size="sm" aria-label="Text" className={tool}><Type /></Toggle><Toggle id="h" size="sm" aria-label="Pan" className={tool}><Hand /></Toggle>
        </ToggleButtonGroup>
        <Sub>Outline (multiple)</Sub>
        <ToggleButtonGroup selectionMode="multiple" defaultSelectedKeys={["b"]} aria-label="Style" className="w-max justify-start">
          <Toggle id="b" variant="outline" size="sm" aria-label="Bold" className="size-8 px-0 [&_svg]:size-4"><Bold /></Toggle><Toggle id="i" variant="outline" size="sm" aria-label="Italic" className="size-8 px-0 [&_svg]:size-4"><Italic /></Toggle><Toggle id="u" variant="outline" size="sm" aria-label="Underline" className="size-8 px-0 [&_svg]:size-4" isDisabled><Underline /></Toggle>
        </ToggleButtonGroup>
        <Sub>Single toggles · states</Sub>
        <StateRow cells={[
          ["off", <Toggle size="sm" aria-label="Grid" className={cn(tool, "data-[selected]:bg-accent data-[selected]:shadow-none")}><Grid3x3 /></Toggle>],
          ["on", <Toggle size="sm" defaultSelected aria-label="Grid" className={cn(tool, "data-[selected]:bg-accent data-[selected]:shadow-none")}><Grid3x3 /></Toggle>],
          ["hover", <Force state={["hovered"]}><Toggle size="sm" aria-label="Grid" className={cn(tool, "data-[selected]:bg-accent")}><Grid3x3 /></Toggle></Force>],
          ["focus-visible", <Force state={["focus-visible"]}><Toggle size="sm" aria-label="Grid" className={tool}><Grid3x3 /></Toggle></Force>],
          ["disabled", <Toggle size="sm" isDisabled aria-label="Grid" className={tool}><Grid3x3 /></Toggle>],
          ["text", <ToggleButtonGroup selectionMode="single" defaultSelectedKeys={["fill"]} aria-label="Fit" className="gap-0.5"><Toggle id="fill" size="sm" className="h-7 gap-1.5 px-2 text-[13px] [&_svg]:size-4"><Maximize />Fill</Toggle><Toggle id="fit" size="sm" className="h-7 gap-1.5 px-2 text-[13px] text-muted-foreground [&_svg]:size-4"><Minimize />Fit</Toggle></ToggleButtonGroup>],
        ]} />
        <Sub>Segmented (md · sm)</Sub>
        <div className="flex w-[300px] flex-col gap-2">
          <Segmented label="Fit" defaultValue="fill" items={[{ id: "fill", label: "Fill" }, { id: "fit", label: "Fit" }, { id: "o", label: "Original" }]} />
          <Segmented size="sm" label="Units" defaultValue="mm" items={[{ id: "mm", label: "mm" }, { id: "cm", label: "cm" }, { id: "in", label: "in" }, { id: "pt", label: "pt" }]} />
        </div>
      </>
    ),
  },
  {
    id: "toolbar", name: "Toolbar", file: "ui/toolbar.tsx", source: "JollyUI", note: "roving focus: Tab into the toolbar, then ← →",
    render: () => (
      <Toolbar aria-label="Editor tools" className="w-max items-center gap-1 rounded-lg border bg-popover p-1 shadow-md">
        <ToggleButtonGroup selectionMode="single" disallowEmptySelection defaultSelectedKeys={["v"]} aria-label="Tool" className="gap-0.5 rounded-lg bg-muted p-0.5 dark:bg-black/25">
          <Toggle id="v" size="sm" aria-label="Select" className={tool}><MousePointer2 /></Toggle><Toggle id="h" size="sm" aria-label="Pan" className={tool}><Hand /></Toggle>
        </ToggleButtonGroup>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <IconButton label="Undo" tooltip={false}><Undo2 /></IconButton><IconButton label="Redo" tooltip={false} isDisabled><Redo2 /></IconButton>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Toggle size="sm" aria-label="Snap" defaultSelected className={cn(tool, "data-[selected]:bg-accent data-[selected]:shadow-none")}><Magnet /></Toggle>
        <Button variant="outline" size="sm" className="ml-1 h-8 gap-1.5 px-2.5 text-[13px] shadow-xs [&_svg]:size-4"><Eye />Preview</Button>
      </Toolbar>
    ),
  },
  {
    id: "tabs", name: "Tabs", file: "ui/tabs.tsx", source: "JollyUI",
    render: () => (
      <>
        <Sub>Segmented tabs (inspector) · md 32</Sub>
        <Tabs defaultSelectedKey="frame" className="w-[300px]">
          <TabList aria-label="Inspector" className="grid w-full grid-cols-3">
            {["frame", "spread", "book"].map((t) => <Tab key={t} id={t} className="capitalize">{t}</Tab>)}
          </TabList>
          <TabPanel id="frame" className="text-[13px] text-muted-foreground">Frame panel</TabPanel><TabPanel id="spread" className="text-[13px] text-muted-foreground">Spread panel</TabPanel><TabPanel id="book" className="text-[13px] text-muted-foreground">Book panel</TabPanel>
        </Tabs>
        <Sub>With icons and counts · disabled tab</Sub>
        <Tabs defaultSelectedKey="photos">
          <TabList aria-label="Dock" className="w-max">
            <Tab id="photos"><Images />Photos<TabCount>20</TabCount></Tab>
            <Tab id="templates"><LayoutTemplate />Templates<TabCount>12</TabCount></Tab>
            <Tab id="text" isDisabled><Type />Text</Tab>
          </TabList>
        </Tabs>
        <Sub>Sizes · sm 28 · md 32 · lg 40 (JollyUI default)</Sub>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs defaultSelectedKey="s"><TabList aria-label="Sort small" size="sm" className="w-max"><Tab id="s">Status</Tab><Tab id="u">Uses<TabCount>8</TabCount></Tab><Tab id="n">Name</Tab></TabList></Tabs>
          <Tabs defaultSelectedKey="r"><TabList aria-label="Sort" className="w-max"><Tab id="r">Recent</Tab><Tab id="t">A–Z</Tab></TabList></Tabs>
          <Tabs defaultSelectedKey="a"><TabList aria-label="Default" size="lg" className="w-max"><Tab id="a">Account</Tab><Tab id="b">Password</Tab></TabList></Tabs>
        </div>
        <Sub>States</Sub>
        <StateRow cells={[
          ["selected", <Tabs defaultSelectedKey="y"><TabList aria-label="Selected" className="w-max"><Tab id="y">Spread</Tab></TabList></Tabs>],
          ["focus-visible", <Force state={["focus-visible"]}><Tabs defaultSelectedKey="y"><TabList aria-label="Focus" className="w-max"><Tab id="y">Spread</Tab></TabList></Tabs></Force>],
          ["disabled", <Tabs><TabList aria-label="Disabled" className="w-max"><Tab id="z" isDisabled>Text</Tab></TabList></Tabs>],
        ]} />
      </>
    ),
  },
  {
    id: "menu", name: "Menu · MenuTrigger", file: "ui/menu.tsx", source: "JollyUI", note: "inline specimen + real trigger; sections, shortcuts, selection, disabled, destructive",
    render: () => (
      <div className="flex items-start gap-6">
        <div className="w-60 rounded-md border bg-popover shadow-md">
          <Menu aria-label="Book actions" className="[&_svg]:size-4 [&_svg]:text-muted-foreground">
            <MenuSection><MenuHeader>Book</MenuHeader>
              <MenuItem><FolderOpen />Open<MenuKeyboard>Ctrl+O</MenuKeyboard></MenuItem><MenuItem><Copy />Duplicate<MenuKeyboard>Ctrl+D</MenuKeyboard></MenuItem>
              <MenuItem isDisabled><Pencil />Rename… (read-only)</MenuItem>
            </MenuSection>
            <MenuSeparator />
            <MenuItem variant="destructive"><Trash2 />Remove…</MenuItem>
          </Menu>
        </div>
        <div className="flex flex-col gap-3">
          <MenuTrigger>
            <Button variant="outline" size="sm" className={cn(sb, "shadow-xs")}>Open menu<ChevronDown className="opacity-60" /></Button>
            <MenuPopover className="w-48"><Menu><MenuItem>Fit spread<MenuKeyboard>Ctrl+0</MenuKeyboard></MenuItem><MenuItem>100%</MenuItem><MenuItem>200%</MenuItem></Menu></MenuPopover>
          </MenuTrigger>
          <MenuTrigger>
            <Button variant="ghost" size="sm" className={sb}>Sort: selection menu<ChevronDown className="opacity-60" /></Button>
            <MenuPopover className="w-44"><Menu selectionMode="single" defaultSelectedKeys={["date"]}><MenuItem id="date">Date taken</MenuItem><MenuItem id="name">File name</MenuItem><MenuItem id="added">Added order</MenuItem></Menu></MenuPopover>
          </MenuTrigger>
        </div>
      </div>
    ),
  },
  {
    id: "select", name: "Select · ListBox", file: "ui/select.tsx · ui/list-box.tsx", source: "JollyUI",
    render: () => (
      <div className="grid grid-cols-2 gap-5 [&_label]:text-xs [&_label]:font-normal [&_label]:text-muted-foreground">
        <JollySelect label="Format" defaultSelectedKey="sq" className="[&_button]:h-9 [&_button]:shadow-xs"><SelectItem id="sq">Square 20 × 20 cm</SelectItem><SelectItem id="a4">A4 landscape</SelectItem><SelectItem id="l">Large 30 × 30 cm</SelectItem></JollySelect>
        <JollySelect label="Disabled" isDisabled defaultSelectedKey="sq" className="[&_button]:h-9"><SelectItem id="sq">Square 20 × 20 cm</SelectItem></JollySelect>
        <JollySelect label="Required (invalid)" isRequired isInvalid placeholder="Choose a printer" errorMessage="Choose a print profile" className="[&_button]:h-9 [&_[slot=errorMessage]]:text-xs"><SelectItem id="x">Saal Digital</SelectItem></JollySelect>
        <SelectRow label="Compact (inspector)" defaultValue="date" items={[["date", "Date taken"], ["name", "File name"]]} />
        <div className="col-span-2">
          <Label className="mb-1.5 block">ListBox (inline, sections, multiple)</Label>
          <ListBox aria-label="Fonts" selectionMode="multiple" defaultSelectedKeys={["lora"]} className="w-64 rounded-md border bg-popover p-1 shadow-xs">
            <ListBoxSection><ListBoxHeader>Serif</ListBoxHeader><ListBoxItem id="lora">Lora</ListBoxItem><ListBoxItem id="pt">PT Serif</ListBoxItem></ListBoxSection>
            <ListBoxSection><ListBoxHeader>Sans</ListBoxHeader><ListBoxItem id="inter">Inter</ListBoxItem><ListBoxItem id="x" isDisabled>Unlicensed font</ListBoxItem></ListBoxSection>
          </ListBox>
        </div>
      </div>
    ),
  },
  {
    id: "textfield", name: "TextField · NumberField · SearchField", file: "ui/textfield · numberfield · searchfield · app/ui NumField", source: "JollyUI",
    render: () => (
      <div className="grid grid-cols-2 gap-x-5 gap-y-4 [&_label]:text-xs [&_label]:font-normal [&_label]:text-muted-foreground">
        <JollyTextField label="Caption" defaultValue="Lake at Mtirala" description="Shown under the photo" className="[&_[slot=description]]:text-xs [&_input]:h-9 [&_input]:shadow-xs" />
        <TextField className="flex flex-col gap-2"><Label>Placeholder</Label><Input placeholder="Add a caption…" className="h-9 shadow-xs" /></TextField>
        <Force state={["focused", "focus-visible"]}><JollyTextField label="Focused" defaultValue="Summer by the sea" className="[&_input]:h-9 [&_input]:shadow-xs" /></Force>
        <JollyTextField label="Disabled" isDisabled defaultValue="Read-only library" className="[&_input]:h-9" />
        <JollyTextField label="Invalid" isInvalid defaultValue="" isRequired errorMessage="Book title is required" className="[&_input]:h-9 [&_[slot=errorMessage]]:text-xs" />
        <TextField aria-label="Notes" className="flex flex-col gap-2"><Label>Text area</Label><TextArea defaultValue={"Two lines\nof body text"} className="min-h-[64px] text-[13px] shadow-xs" /></TextField>
        <JollyNumberField label="Inside margin, mm" defaultValue={20} minValue={0} maxValue={60} className="[&_[role=group]]:h-9 [&_[role=group]]:shadow-xs" />
        <div className="grid grid-cols-2 gap-2"><NumField label="X" prefix="X" value={54} /><NumField label="W" prefix="W" value={165} /><NumField label="Columns" value={6} unit="" /><NumField label="Gutter" value={4} /></div>
        <div className="flex flex-col gap-2">
          <Label>Search</Label>
          <SearchField aria-label="Search" defaultValue="hero"><SearchFieldGroup className="h-9 gap-2 px-2.5 py-0 shadow-xs">
            <Search className="size-4 text-muted-foreground" /><SearchFieldInput placeholder="Templates" className="bg-transparent px-0" /><SearchFieldClear />
          </SearchFieldGroup></SearchField>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Compact search</Label>
          <SearchField aria-label="Search compact"><SearchFieldGroup className="h-8 gap-1.5 px-2.5 py-0 shadow-xs"><Search className="size-3.5 text-muted-foreground" /><SearchFieldInput placeholder="Search" className="bg-transparent px-0 py-0 text-[13px]" /></SearchFieldGroup></SearchField>
        </div>
      </div>
    ),
  },
  {
    id: "checkbox", name: "Checkbox · Switch", file: "ui/checkbox.tsx · ui/switch.tsx", source: "JollyUI", note: "Switch size=\"sm\" added in the port",
    render: () => (
      <>
        <Sub>Checkbox</Sub>
        <StateRow cells={[
          ["unchecked", <Checkbox>Whole folder</Checkbox>], ["checked", <Checkbox defaultSelected>Whole folder</Checkbox>], ["indeterminate", <Checkbox isIndeterminate>Some</Checkbox>],
          ["focus-visible", <Force state={["focus-visible"]}><Checkbox>Focus</Checkbox></Force>], ["disabled", <Checkbox isDisabled defaultSelected>Locked</Checkbox>], ["invalid", <Checkbox isInvalid>Accept terms</Checkbox>],
        ]} />
        <div className="mt-3 [&_label]:text-[13px]"><JollyCheckboxGroup label="Export" defaultValue={["pdf"]} className="[&>label]:text-xs [&>label]:text-muted-foreground"><Checkbox value="pdf">Print PDF</Checkbox><Checkbox value="jpeg">JPEG spreads</Checkbox><Checkbox value="report">Print report</Checkbox></JollyCheckboxGroup></div>
        <Sub>Switch</Sub>
        <StateRow cells={[
          ["sm off", <Switch size="sm" className="text-[13px] font-normal">Snap</Switch>], ["sm on", <Switch size="sm" defaultSelected className="text-[13px] font-normal">Snap</Switch>],
          ["default", <Switch defaultSelected className="text-[13px] font-normal">Guides</Switch>], ["focus-visible", <Force state={["focus-visible"]}><Switch size="sm" className="text-[13px] font-normal">Focus</Switch></Force>],
          ["disabled", <Switch size="sm" isDisabled defaultSelected className="text-[13px] font-normal">Locked</Switch>],
        ]} />
        <div className="mt-3 flex w-[280px] flex-col gap-2.5"><SwitchRow defaultSelected>Mirror on facing pages</SwitchRow><SwitchRow>Snap to other frames</SwitchRow></div>
      </>
    ),
  },
  {
    id: "slider", name: "Slider · SliderRow", file: "ui/slider.tsx · app/controls.tsx", source: "JollyUI", note: "SliderThumb forwards props (range sliders fixed in the port)",
    render: () => (
      <div className="grid w-[420px] grid-cols-1 gap-4">
        <SliderRow label="Zoom" defaultValue={1.6} minValue={1} maxValue={3} step={0.01} formatOptions={{ style: "percent" }} />
        <SliderRow label="Photos per spread (range)" defaultValue={[1, 3]} minValue={1} maxValue={6} />
        <SliderRow label="Straighten" defaultValue={-4} minValue={-45} maxValue={45} formatOptions={{ style: "unit", unit: "degree", unitDisplay: "narrow" }} />
        <SliderRow label="Disabled" defaultValue={30} isDisabled />
      </div>
    ),
  },
  {
    id: "progress", name: "Progress", file: "ui/progress.tsx", source: "JollyUI",
    render: () => {
      function Live() {
        const [v, setV] = React.useState(35)
        React.useEffect(() => { const t = setInterval(() => setV((x) => (x >= 100 ? 0 : x + 5)), 400); return () => clearInterval(t) }, [])
        return <Progress aria-label="Export" value={v} barClassName="h-1 mt-1.5 bg-secondary dark:bg-accent"><div className="flex text-xs"><span className="text-muted-foreground">Exporting PDF · live</span><span className="ml-auto tabular-nums">{v}%</span></div></Progress>
      }
      return (
        <div className="flex w-[420px] flex-col gap-4">
          <Live />
          <Progress aria-label="Import" value={9} maxValue={20} barClassName="h-1 mt-1.5 bg-secondary dark:bg-accent"><div className="flex text-xs"><span className="text-muted-foreground">Reading 9 of 20 · IMG_4249.jpg</span></div></Progress>
          <JollyProgressBar label="JollyUI default" value={62} className="text-[13px]" />
          <Progress aria-label="Indeterminate" isIndeterminate barClassName="h-1 mt-1.5 bg-secondary dark:bg-accent [&>div]:animate-pulse"><div className="text-xs text-muted-foreground">Indeterminate · scanning folder…</div></Progress>
        </div>
      )
    },
  },
  {
    id: "disclosure", name: "Disclosure · Section", file: "ui/disclosure.tsx · app/ui Section", source: "JollyUI",
    render: () => (
      <div className="grid grid-cols-2 gap-5">
        <div className="overflow-hidden rounded-lg border bg-chrome">
          <Section title="Frame"><div className="grid grid-cols-2 gap-2"><NumField label="X" prefix="X" value={54} /><NumField label="Y" prefix="Y" value={8} /></div></Section>
          <Section title="Border & corners" summary="None · 0 mm" defaultExpanded={false}><div className="text-xs text-muted-foreground">Collapsed summary shows the current value.</div></Section>
          <Section title="Caption" summary="Off" defaultExpanded={false} />
        </div>
        <DisclosureGroup defaultExpandedKeys={["a"]} className="w-full">
          <Disclosure id="a"><DisclosureHeader>What is a parent spread?</DisclosureHeader><DisclosurePanel><p className="text-[13px] text-muted-foreground">Shared items, grid and guides for many spreads.</p></DisclosurePanel></Disclosure>
          <Disclosure id="b"><DisclosureHeader>Disabled</DisclosureHeader><DisclosurePanel>—</DisclosurePanel></Disclosure>
        </DisclosureGroup>
      </div>
    ),
  },
  {
    id: "grid-list", name: "GridList · ThumbGrid", file: "ui/grid-list.tsx · app/ui ThumbGrid", source: "JollyUI",
    render: () => (
      <div className="flex items-start gap-6">
        <GridList aria-label="Libraries" selectionMode="single" defaultSelectedKeys={["a"]} className="w-44 shrink-0 shadow-xs">
          <GridListItem id="a">Summer 2025</GridListItem><GridListItem id="b">Mountains</GridListItem><GridListItem id="c" isDisabled>Unavailable drive</GridListItem>
        </GridList>
        <div className="flex min-w-0 flex-col gap-2">
          <ThumbGrid aria-label="Photos" layout="grid" selectionMode="multiple" defaultSelectedKeys={["p21"]} className="flex flex-wrap items-end gap-2 p-1">
            {THUMB_SPECIMEN.map(([id, kind]) => { const p = P(id); return (
              <ThumbItem key={id} id={id} textValue={p.name} className="rounded-[5px]">
                <PhotoThumb src={p.src} w={p.w} h={p.h} height={68} className="rounded-[5px]">
                  <span className="absolute bottom-1 left-1 rounded-[4px] bg-black/55 px-1 py-px text-[9.5px] font-medium tabular-nums text-white backdrop-blur-sm">{kind}</span>
                </PhotoThumb>
              </ThumbItem>
            ) })}
          </ThumbGrid>
          <p className="max-w-[400px] text-[11.5px] leading-relaxed text-muted-foreground">Same rule as the filmstrip: fixed row height, width from the photo’s own ratio, clamped to 5:8 … 8:5 — panoramas and very tall scans are centre-cropped to the limit. Neutral backdrop while loading, hairline inset ring.</p>
        </div>
      </div>
    ),
  },
  {
    id: "overlays", name: "Popover · Dialog · AlertDialog", file: "ui/popover.tsx · ui/dialog.tsx · app/ui AppModal", source: "JollyUI", note: "click to open; Esc closes",
    render: () => (
      <div className="flex flex-wrap items-start gap-3">
        <PopoverTrigger>
          <Button variant="outline" size="sm" className={cn(sb, "shadow-xs")}><Info />Popover</Button>
          <Popover placement="bottom start" className="w-64"><PopoverDialog className="text-[13px]"><div className="font-medium">Effective DPI</div><p className="mt-1 text-muted-foreground">Pixels of the photo per printed inch after crop. Below 300 prints soft.</p></PopoverDialog></Popover>
        </PopoverTrigger>
        <DialogTrigger>
          <Button variant="outline" size="sm" className={cn(sb, "shadow-xs")}>Dialog</Button>
          <DialogOverlay><DialogContent className="sm:max-w-[440px]">
            <DialogHeader><DialogTitle className="heading">Rename book</DialogTitle><DialogDescription>Only the title changes; files stay where they are.</DialogDescription></DialogHeader>
            <JollyTextField aria-label="Title" defaultValue="Summer by the sea" autoFocus className="[&_input]:h-9" />
            <DialogFooter><Button slot="close" variant="outline" size="sm" className="h-9 px-4">Cancel</Button><Button slot="close" size="sm" className="h-9 px-4">Save</Button></DialogFooter>
          </DialogContent></DialogOverlay>
        </DialogTrigger>
        <DialogTrigger>
          <Button variant="destructive-outline" size="sm" className={sb}><Trash2 />AlertDialog</Button>
          <AlertDialog title="Remove “Road trip west”?" confirmLabel="Remove book">The book disappears from this library. Photos stay on disk, untouched.</AlertDialog>
        </DialogTrigger>
        <div className="mt-3 w-full">
          <div className="mb-2 text-[10.5px] text-muted-foreground">Inline specimen · AlertDialogBody on the DialogContent surface (border, shadow-lg, radius-xl)</div>
          <div className="w-[420px] max-w-full rounded-xl border bg-background shadow-lg">
            <AlertDialogBody inline title="Remove “Road trip west”?" confirmLabel="Remove book">The book disappears from this library. Photos stay on disk, untouched.</AlertDialogBody>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "toast", name: "Toast", file: "ui/toast.tsx", source: "JollyUI", note: "RAC ToastQueue; tones default / success / error, optional action",
    render: () => (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className={cn(sb, "shadow-xs")} onPress={() => toastQueue.add({ title: "Spread duplicated", icon: <Copy /> }, { timeout: 4000 })}>Default</Button>
          <Button variant="outline" size="sm" className={cn(sb, "shadow-xs")} onPress={() => toastQueue.add({ tone: "success", icon: <Check />, title: "Autosaved · version 42" }, { timeout: 4000 })}>Success</Button>
          <Button variant="outline" size="sm" className={cn(sb, "shadow-xs")} onPress={() => toastQueue.add({ tone: "error", icon: <CloudOff />, title: "Lost access to “Summer 2025”", description: "Edits are kept locally until you grant access again.", action: { label: "Grant access" } })}>Error + action</Button>
        </div>
        <div className="relative flex w-[340px] items-start gap-3 rounded-lg border bg-popover p-3.5 pr-10 shadow-lg"><Check className="mt-px size-4 text-success" /><div className="text-sm font-semibold">Static specimen · success</div></div>
      </div>
    ),
  },
  {
    id: "badge", name: "Badge", file: "uui/Badge.tsx", source: "Untitled UI", note: "color × size × type · status → dot, icon only when it adds meaning",
    render: () => (
      <>
        <Sub>Status · dot</Sub>
        <div className="flex flex-col gap-2.5">
          {(["sm", "md", "lg"] as const).map((s) => (
            <div key={s} className="flex flex-wrap items-center gap-1.5">
              <span className="w-6 text-[10.5px] text-muted-foreground">{s}</span>
              <Badge size={s} dot>Draft</Badge><Badge size={s} color="success" dot>Linked</Badge><Badge size={s} color="warning" dot>Modified</Badge><Badge size={s} color="error" dot>Missing</Badge>
              <Badge size={s} type="pill-color" color="success" dot>Published</Badge>
            </div>
          ))}
        </div>
        <Sub>Meta · icon / plain / pill (tabular numbers)</Sub>
        <div className="flex flex-col gap-2.5">
          {(["sm", "md", "lg"] as const).map((s) => (
            <div key={s} className="flex flex-wrap items-center gap-1.5">
              <span className="w-6 text-[10.5px] text-muted-foreground">{s}</span>
              <Badge size={s} color="success" icon={<CircleCheck />}>Found</Badge><Badge size={s} color="brand" icon={<Link2 />}>parent</Badge><Badge size={s}>300 dpi</Badge>
              <Badge size={s} type="pill-color" color="brand">12 new</Badge><Badge size={s} type="pill-color">1,280 px</Badge>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    id: "featured-icon", name: "FeaturedIcon", file: "uui/FeaturedIcon.tsx", source: "Untitled UI",
    render: () => (
      <div className="flex flex-col gap-5">
        {(["light", "outline"] as const).map((t) => (
          <div key={t} className="flex items-center gap-7 pl-3">
            <span className="w-12 text-[10.5px] text-muted-foreground">{t}</span>
            {(["sm", "md", "lg", "xl"] as const).map((s) => <FeaturedIcon key={s} size={s} theme={t}><FolderOpen /></FeaturedIcon>)}
            <FeaturedIcon theme={t} color="success"><Check /></FeaturedIcon><FeaturedIcon theme={t} color="warning"><AlertTriangle /></FeaturedIcon><FeaturedIcon theme={t} color="error"><Trash2 /></FeaturedIcon>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "kbd", name: "Kbd · Separator · Label", file: "app/ui Kbd · ui/separator · ui/field", source: "app",
    render: () => (
      <div className="flex items-center gap-4">
        <span className="flex gap-1"><Kbd>Ctrl</Kbd><Kbd>Z</Kbd></span><Kbd>Shift+S</Kbd><Kbd>Esc</Kbd>
        <Separator orientation="vertical" className="h-6" /><Label>Label</Label><Separator className="w-24" /><Plus className="size-4 text-muted-foreground" />
      </div>
    ),
  },
]

function Column({ theme, spec }: { theme: "b" | "b-dark"; spec: Spec }) {
  return (
    <div data-theme={theme} className="min-w-0 bg-background p-5 text-foreground" data-testid={`cmp-${spec.id}-${theme}`}>
      <div className="mb-3 text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">{theme === "b" ? "B · light" : "B-dark"}</div>
      {spec.render()}
    </div>
  )
}

export function ComponentsPage() {
  const [mode, setMode] = React.useState<"both" | "page">("both")
  return (
    <div className="min-h-screen bg-background">
      <KitBar />
      <main className="mx-auto max-w-[1440px] px-6 pb-20 pt-8">
        <div className="flex items-end gap-6">
          <div className="min-w-0 flex-1">
            <div className="eyebrow mb-2">src/components/ui · uui · app</div>
            <h1 className="heading text-[32px] leading-tight">Components</h1>
            <p className="mt-2 max-w-[860px] text-[14px] leading-relaxed text-muted-foreground">
              JollyUI components (MIT) ported to React Aria Components 1.22 / React 19 / Tailwind 4, plus Badge and FeaturedIcon from Untitled UI (MIT, restyled) and app-level wrappers.
              Every block is interactive; hover / focus / pressed states are also shown forced (labelled under the element). Left: light theme B, right: B-dark.
            </p>
          </div>
          <Tabs selectedKey={mode} onSelectionChange={(k) => setMode(k as "both")}>
            <TabList aria-label="Display mode">
              <Tab id="both">Light | Dark</Tab>
              <Tab id="page">Page theme only</Tab>
            </TabList>
          </Tabs>
        </div>
        <nav className="mt-6 flex flex-wrap gap-1.5" aria-label="Components">
          {SPECS.map((s) => <a key={s.id} href={`#/components`} onClick={(e) => { e.preventDefault(); document.getElementById(`c-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }) }} className="rounded-md border bg-card px-2.5 py-1 text-xs shadow-xs hover:bg-accent">{s.name}</a>)}
        </nav>
        <div className="mt-8 flex flex-col gap-8">
          {SPECS.map((s) => (
            <section key={s.id} id={`c-${s.id}`} className="scroll-mt-20">
              <div className="mb-2.5 flex items-baseline gap-3">
                <h2 className="heading text-[20px]">{s.name}</h2>
                <span className="font-mono text-[11.5px] text-muted-foreground">{s.file}</span>
                <Badge color={s.source === "JollyUI" ? "brand" : s.source === "Untitled UI" ? "gray" : "success"}>{s.source}</Badge>
                {s.note && <span className="ml-auto text-xs text-muted-foreground">{s.note}</span>}
              </div>
              <div className={cn("grid overflow-hidden rounded-xl border shadow-xs", mode === "both" ? "grid-cols-2 divide-x" : "grid-cols-1")}>
                {mode === "both" ? <><Column theme="b" spec={s} /><Column theme="b-dark" spec={s} /></> : <div className="bg-background p-5">{s.render()}</div>}
              </div>
            </section>
          ))}
        </div>
        <footer className="mt-12 border-t pt-5 text-xs leading-relaxed text-muted-foreground">
          Licences: JollyUI — MIT (components/ui/LICENSE-jollyui-MIT.txt), React Spectrum / React Aria — Apache-2.0, Untitled UI React — MIT (components/uui/LICENSE-untitledui-MIT.txt). Inter and Lora fonts — SIL OFL 1.1.
        </footer>
      </main>
      <ToastRegion queue={toastQueue} className="bottom-4 right-4 w-[360px]" />
    </div>
  )
}
