/* Unsupported-browser screen (Designer spec 2026-11-03): kit Mark header, Lora 400 title, pill CTAs, browser pills.
   Styles: ./unsupported.css, byte-identical with prod src/editor/UnsupportedBrowserScreen.css (prod test fails on drift).
   Same DOM, classes and testids as prod; #/demo shows it through `__demo.unsupported(variant, browserName)`. */
import * as React from "react"
import { AppWindow, BookOpen, Check, Copy, ExternalLink, MonitorSmartphone, ShieldOff } from "lucide-react"
import { Button as AriaButton, Link as AriaLink } from "react-aria-components"
import { FeaturedIcon } from "@/components/uui/FeaturedIcon"
import "./unsupported.css"

export type UnsupportedVariant = "other" | "no-api" | "mobile"

const CHROME_URL = "https://www.google.com/chrome/"
const SHARE_URL = "https://photobooks.app/"
const BROWSERS: { name: string; url: string; flag?: string }[] = [
  { name: "Microsoft Edge", url: "https://www.microsoft.com/edge" },
  { name: "Brave", url: "https://brave.com/download/", flag: "brave://flags/#file-system-access-api" },
  { name: "Arc", url: "https://arc.net/" },
  { name: "Opera", url: "https://www.opera.com/" },
  { name: "Vivaldi", url: "https://vivaldi.com/" },
]
const TITLE: Record<UnsupportedVariant, string> = {
  other: "This browser isn’t supported", "no-api": "Folder access is turned off in this browser", mobile: "Photobooks needs a desktop computer",
}
const ICON = { other: AppWindow, "no-api": ShieldOff, mobile: MonitorSmartphone }

function CopyLink() {
  const [done, setDone] = React.useState(false)
  return (
    <AriaButton className="ub-btn ub-btn--secondary" data-testid="copy-link"
      onPress={() => { void navigator.clipboard?.writeText(SHARE_URL).catch(() => undefined); setDone(true); window.setTimeout(() => setDone(false), 1800) }}>
      {done ? <Check /> : <Copy />}{done ? "Link copied" : "Copy link"}
    </AriaButton>
  )
}

function GetChrome({ secondary }: { secondary: boolean }) {
  return (
    <AriaLink href={CHROME_URL} target="_blank" rel="noopener noreferrer" data-testid="get-chrome" className={secondary ? "ub-btn ub-btn--secondary" : "ub-btn ub-btn--primary"}>
      Get Google Chrome<ExternalLink />
    </AriaLink>
  )
}

function MobileBody() {
  return <>
    <p className="ub-text">Photobooks edits books and photos right in folders on your disk. Phones and tablets — Chrome on Android and every browser on iPhone and iPad — can’t give a website that kind of folder access.</p>
    <p className="ub-text">Open it on a Mac, Windows or Linux computer in <b>Google Chrome</b>, Edge or another Chromium browser.</p>
    <div className="ub-actions"><CopyLink /></div>
    <p className="ub-foot">Published Photobooks sites open on any phone — only the editor needs a computer.</p>
  </>
}

function DesktopBody({ noApi, browserName }: { noApi: boolean; browserName: string }) {
  return <>
    <p className="ub-text">
      {noApi
        ? "This is a Chromium browser, but direct folder access (the File System Access API) isn’t available here. It may be switched off by a browser flag or by your organisation, or the page isn’t opened over a secure connection."
        : <>Photobooks saves your books straight into a folder on your disk and reads photos from their folders. That needs direct folder access (the File System Access API), which only Chromium-based desktop browsers have. You’re using <b data-testid="browser-name">{browserName}</b>.</>}
    </p>
    <div className="ub-actions">
      {noApi && <AriaButton className="ub-btn ub-btn--primary" data-testid="reload-after-enable" onPress={() => window.location.reload()}>Reload after turning it on</AriaButton>}
      <GetChrome secondary={noApi} />
      {!noApi && <CopyLink />}
    </div>
    <section className="ub-section">
      <p className="ub-eyebrow">{noApi ? "Turn folder access back on" : "Other Chromium browsers work too"}</p>
      {noApi ? (
        <ol className="ub-tips">
          <li><b>Brave:</b> open <code className="ub-code">brave://flags/#file-system-access-api</code>, set it to Enabled, relaunch.</li>
          <li><b>Managed computer:</b> ask your admin to allow <code className="ub-code">FileSystemAccess</code> for this site.</li>
          <li><b>Embedded or http:</b> open <code className="ub-code">https://photobooks.app</code> directly in a tab.</li>
        </ol>
      ) : <>
        <ul className="ub-pills" data-testid="browser-list">
          {BROWSERS.map((b) => <li key={b.name}><AriaLink href={b.url} target="_blank" rel="noopener noreferrer" className="ub-pill" data-testid={`browser-link-${b.name}`}>{b.name}<ExternalLink /></AriaLink></li>)}
        </ul>
        {BROWSERS.filter((b) => b.flag).map((b) => <p key={b.name} className="ub-note">{b.name}: turn on <code className="ub-code">{b.flag}</code>, then relaunch.</p>)}
      </>}
    </section>
    <p className="ub-foot">Nothing is uploaded — Photobooks runs entirely in your browser, on your own folders. Published Photobooks sites open in every browser.</p>
  </>
}

/** The blocking screen shown instead of the app when the browser can't open folders (prod `UnsupportedBrowserScreen`). */
export function UnsupportedScreen({ variant, browserName = "this browser" }: { variant: UnsupportedVariant; browserName?: string }) {
  const Glyph = ICON[variant]
  // the screen fits phones: while it is up, the page minimum is prod's 320 px, not the kit canvas's 1280 (kit.css body)
  React.useLayoutEffect(() => { const b = document.body.style, was = b.minWidth; b.minWidth = "320px"; return () => { b.minWidth = was } }, [])
  return (
    <main className="ub-root" data-testid="unsupported-browser" data-narrow={variant === "mobile" ? "" : undefined}>
      <div className="ub-scroll" data-testid="unsupported-scroll">
        <div className="ub-page">
          <header className="ub-header"><span className="ub-mark"><BookOpen /></span>Photobooks</header>
          <div className="ub-main">
            <div className="ub-body" data-testid="unsupported" data-variant={variant}>
              <FeaturedIcon size="md" theme="soft" color="warning" className="ub-icon"><Glyph /></FeaturedIcon>
              <h1 className="ub-title" data-testid="unsupported-title">{TITLE[variant]}</h1>
              {variant === "mobile" ? <MobileBody /> : <DesktopBody noApi={variant === "no-api"} browserName={browserName} />}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
