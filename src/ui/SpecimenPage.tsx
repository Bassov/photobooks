import { useState } from 'react'
import { Icon, ICON_NAMES, ICON_SIZES, type IconSize } from './Icon'
import './SpecimenPage.css'

export function SpecimenPage() {
  const [iconSize, setIconSize] = useState<IconSize>(16)

  return (
    <main className="specimen-page" data-testid="specimen">
      <header className="specimen-header">
        <h1 className="heading">?specimen</h1>
        <span className="specimen-note">
          Dev/test-only · Theme B tokens from docs/design.md
        </span>
      </header>

      <section className="specimen-section" aria-labelledby="specimen-colors">
        <h2 id="specimen-colors">Semantic colour roles</h2>
        <div className="specimen-swatches">
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-background" />
            <span className="specimen-swatch-name">background</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-chrome" />
            <span className="specimen-swatch-name">chrome</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-canvas" />
            <span className="specimen-swatch-name">canvas</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-paper" />
            <span className="specimen-swatch-name">paper</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-foreground" />
            <span className="specimen-swatch-name">foreground</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-primary" />
            <span className="specimen-swatch-name">primary</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-ring" />
            <span className="specimen-swatch-name">ring</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-select" />
            <span className="specimen-swatch-name">select</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-destructive" />
            <span className="specimen-swatch-name">destructive</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-success" />
            <span className="specimen-swatch-name">success</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-warning" />
            <span className="specimen-swatch-name">warning</span>
          </div>
          <div className="specimen-swatch">
            <div className="specimen-swatch-chip specimen-token-border" />
            <span className="specimen-swatch-name">border</span>
          </div>
        </div>
      </section>

      <section className="specimen-section" aria-labelledby="specimen-type">
        <h2 id="specimen-type">Type scale · Inter + Lora (self-hosted)</h2>
        <div className="specimen-type">
          <span className="heading specimen-type-3xl">
            A week by the sea · 32
          </span>
          <span className="heading specimen-type-2xl">
            Summer by the sea · 26
          </span>
          <span className="heading specimen-type-lg">Section heading · 18</span>
          <span className="specimen-type-base">
            Body 15 · Drag a photo onto a frame
          </span>
          <span className="specimen-type-sm">
            UI 13.5 · Inspector labels and values
          </span>
          <span className="specimen-type-xs">Caption 12 · 6000 × 4000 px</span>
          <span className="eyebrow">Eyebrow 11</span>
        </div>
      </section>

      <section className="specimen-section" aria-labelledby="specimen-radius">
        <h2 id="specimen-radius">Radius</h2>
        <div className="specimen-radii">
          <div className="specimen-radius">
            <div className="specimen-radius-chip specimen-radius-sm" />
            <span className="specimen-spacing-label">sm</span>
          </div>
          <div className="specimen-radius">
            <div className="specimen-radius-chip specimen-radius-md" />
            <span className="specimen-spacing-label">md</span>
          </div>
          <div className="specimen-radius">
            <div className="specimen-radius-chip specimen-radius-lg" />
            <span className="specimen-spacing-label">lg</span>
          </div>
          <div className="specimen-radius">
            <div className="specimen-radius-chip specimen-radius-xl" />
            <span className="specimen-spacing-label">xl</span>
          </div>
          <div className="specimen-radius">
            <div className="specimen-radius-chip specimen-radius-2xl" />
            <span className="specimen-spacing-label">2xl</span>
          </div>
        </div>
      </section>

      <section className="specimen-section" aria-labelledby="specimen-spacing">
        <h2 id="specimen-spacing">Spacing · 4 px base</h2>
        <div className="specimen-spacing">
          <div className="specimen-radius">
            <div className="specimen-spacing-bar specimen-space-1" />
            <span className="specimen-spacing-label">4</span>
          </div>
          <div className="specimen-radius">
            <div className="specimen-spacing-bar specimen-space-2" />
            <span className="specimen-spacing-label">8</span>
          </div>
          <div className="specimen-radius">
            <div className="specimen-spacing-bar specimen-space-3" />
            <span className="specimen-spacing-label">12</span>
          </div>
          <div className="specimen-radius">
            <div className="specimen-spacing-bar specimen-space-4" />
            <span className="specimen-spacing-label">16</span>
          </div>
          <div className="specimen-radius">
            <div className="specimen-spacing-bar specimen-space-6" />
            <span className="specimen-spacing-label">24</span>
          </div>
          <div className="specimen-radius">
            <div className="specimen-spacing-bar specimen-space-8" />
            <span className="specimen-spacing-label">32</span>
          </div>
        </div>
      </section>

      <section
        className="specimen-section"
        aria-labelledby="specimen-icons-heading"
        data-testid="specimen-icons"
      >
        <h2 id="specimen-icons-heading">Icon set · in-repo SVG (stroke 2)</h2>
        <div className="specimen-icon-toolbar">
          <span className="specimen-note">Size token</span>
          <div
            className="specimen-icon-sizes"
            role="group"
            aria-label="Icon size"
          >
            {ICON_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                className={
                  s === iconSize
                    ? 'specimen-icon-size specimen-icon-size-active'
                    : 'specimen-icon-size'
                }
                aria-label={`Icon size ${String(s)}`}
                aria-pressed={s === iconSize}
                onClick={() => {
                  setIconSize(s)
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <span className="specimen-note specimen-icon-hint">
            decorative = aria-hidden · icon-only controls need a label
          </span>
        </div>
        <div className="specimen-icon-grid">
          {ICON_NAMES.map((name) => (
            <div key={name} className="specimen-icon-cell">
              <Icon name={name} size={iconSize} />
              <span className="specimen-swatch-name">{name}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
