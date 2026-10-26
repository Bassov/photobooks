import type { CSSProperties } from 'react'
import { bookObjectLayout, type BookObjectFmt } from './bookObjectLayout'

export type { BookObjectFmt }

/** Finished-book object: cover photo, spine shading, page block, italic title. */
export function BookObject({
  src,
  pos = '50% 50%',
  title,
  sub,
  fmt = 'portrait',
  h,
  ink = '#2E2C2D',
  place = 'top',
}: {
  src?: string
  pos?: string
  title: string
  sub?: string
  fmt?: BookObjectFmt
  h: number
  ink?: string
  place?: 'top' | 'bottom'
}) {
  const layout = bookObjectLayout(h, fmt)
  const placeStyle = {
    color: ink,
    [place]: '9%',
  } as CSSProperties
  return (
    <div
      className="relative"
      style={{ width: layout.width, height: layout.height }}
      data-testid="book-object"
      data-format={fmt}
      data-width={String(layout.width)}
      data-scale={String(layout.scale)}
    >
      <div
        className="absolute rounded-r-[3px]"
        data-testid="book-object-pages"
        style={layout.pageBlock}
      />
      <div
        className="absolute inset-0 overflow-hidden rounded-[2px_4px_4px_2px]"
        data-testid="book-object-cover-shell"
        style={{
          background: '#E8E8E8',
          boxShadow: layout.coverShadow,
        }}
      >
        {src ? (
          <div
            className="absolute inset-0 bg-cover"
            style={{ backgroundImage: `url(${src})`, backgroundPosition: pos }}
            data-testid="book-object-cover"
          />
        ) : null}
        <div
          className="absolute inset-y-0 left-0"
          data-testid="book-object-spine"
          style={{
            width: layout.spineWidth,
            background:
              'linear-gradient(90deg, rgb(0 0 0/.28), rgb(0 0 0/.06) 45%, rgb(255 255 255/.28) 70%, rgb(0 0 0/.05))',
          }}
        />
        <div
          className="absolute inset-x-0 px-3 text-center"
          data-testid="book-object-ink"
          style={placeStyle}
        >
          <div
            className="pb-book-object-title leading-none tracking-[-0.02em]"
            style={{ fontSize: layout.titleSize }}
          >
            <em>{title}</em>
          </div>
          {sub ? (
            <div
              className="uppercase"
              data-testid="book-object-sub"
              style={{
                marginTop: '0.6em',
                fontSize: layout.subSize,
                letterSpacing: '0.3em',
              }}
            >
              {sub}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
