import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bookInput } from './siteRoom.test-helpers'
import { CoverFace, PageFace, SlideContent, type Images } from './SiteSlide'

// `alps`: 190 × 230 mm, 11 spreads (the first and the last one page);
// spread 0's photo (`photo-a`) is 0.42 of the spread width.

afterEach(() => {
  cleanup()
})

const alps = () => bookInput()

const TWO: Images = {
  'photo-a': {
    src: '/p/a.jpg',
    srcset: '/p/a-700.jpg 700w,  /p/a-1400.jpg 1400w',
    w: 1400,
    h: 933,
  },
}

const imgs = (root: HTMLElement) => [...root.querySelectorAll('img')]

describe('SlideContent', () => {
  it('paints the cover with its front photo', () => {
    const { book, images } = alps()
    const { container } = render(
      <SlideContent book={book} images={images} slide={0} width={760} />,
    )
    const photo = container.querySelector<HTMLElement>('.cover-front-photo')
    expect(photo?.style.backgroundImage).toBe('url("/photos/hi/c18b.jpg")')
  })

  it('paints the cover without a photo when the front has none', () => {
    const { book } = alps()
    const { container } = render(
      <SlideContent book={book} images={{}} slide={0} width={760} />,
    )
    expect(container.querySelector('.cover-front')).not.toBeNull()
    expect(container.querySelector('.cover-front-photo')).toBeNull()
  })

  it('gives a spread photo its srcset and its share of the width, lazily', () => {
    const { book } = alps()
    const { container } = render(
      <SlideContent book={book} images={TWO} slide={1} width={760} />,
    )
    const [img] = imgs(container)
    expect(img?.getAttribute('src')).toBe('/p/a.jpg')
    expect(img?.getAttribute('srcset')).toBe(
      '/p/a-700.jpg 700w, /p/a-1400.jpg 1400w',
    )
    expect(img?.getAttribute('sizes')).toBe('320px')
    expect(img?.getAttribute('loading')).toBe('lazy')
  })

  it('sizes photos for `sizesPx` and loads them eagerly when asked', () => {
    const { book } = alps()
    const { container } = render(
      <SlideContent
        book={book}
        images={TWO}
        slide={1}
        width={760}
        sizesPx={2000}
        eager
      />,
    )
    const [img] = imgs(container)
    expect(img?.getAttribute('sizes')).toBe('841px')
    expect(img?.getAttribute('loading')).toBe('eager')
  })

  it('leaves a frame whose photo is not published without an image', () => {
    const { book } = alps()
    const { container } = render(
      <SlideContent book={book} images={{}} slide={1} width={760} />,
    )
    expect(container.querySelector('.spread-frame')).not.toBeNull()
    expect(imgs(container)).toHaveLength(0)
  })

  it('paints nothing past the last spread', () => {
    const { book, images } = alps()
    const { container } = render(
      <SlideContent book={book} images={images} slide={12} width={760} />,
    )
    expect(container.innerHTML).toBe('')
  })
})

describe('PageFace', () => {
  const face = (spread: number, side: 'left' | 'right', host = false) => {
    const { book, images } = alps()
    const renderSlide = vi.fn((s: number, w: number) => (
      <i>{`${String(s)}@${String(w)}`}</i>
    ))
    const { container } = render(
      <PageFace
        book={book}
        images={images}
        spread={spread}
        side={side}
        pw={300}
        renderSlide={host ? renderSlide : undefined}
      />,
    )
    return container.firstElementChild as HTMLElement | null
  }

  it('shifts a two-page spread so its right page shows on the right', () => {
    expect(face(3, 'left')?.style.left).toBe('0px')
    cleanup()
    const right = face(3, 'right')
    expect(right?.style.cssText).toBe(
      'position: absolute; top: 0px; left: -300px;',
    )
    expect(right?.querySelector('.spread-frame')).not.toBeNull()
  })

  it('shows a one-page spread on its own side only', () => {
    expect(face(0, 'left')).toBeNull()
    cleanup()
    expect(face(0, 'right')?.style.left).toBe('0px')
    cleanup()
    expect(face(10, 'right')).toBeNull()
    cleanup()
    expect(face(10, 'left')?.style.left).toBe('0px')
  })

  it('hands the host the slide at the spread width', () => {
    expect(face(3, 'right', true)?.textContent).toBe('4@600')
  })
})

describe('CoverFace', () => {
  it('paints the cloth, the photo, a hinge and the title in its place', () => {
    const { entry } = alps()
    const b = { ...entry, place: 'bottom' as const }
    const { container } = render(<CoverFace b={b} w={300} h={450} />)
    const cover = container.firstElementChild as HTMLElement
    expect(cover.style.background).toBe(b.spine.cloth)
    expect(cover.querySelector('img')?.getAttribute('src')).toBe(
      '/photos/hi/c18b.jpg',
    )
    expect(cover.querySelector<HTMLElement>('.sd-b3-hinge')?.style.width).toBe(
      '15px',
    )
    const title = cover.querySelector<HTMLElement>('.sd-b3-title')
    expect(title?.textContent).toBe('Alps')
    expect(title?.style.color).toBe(b.ink)
    expect(title?.style.fontSize).toBe('calc(var(--cover-k) * 300px)')
    expect(title?.style.bottom).toBe('9%')
    expect(title?.style.top).toBe('')
  })

  it('keeps an 8 px hinge on a small cover with no photo', () => {
    const { entry } = alps()
    const b = { ...entry, cover: null, place: 'top' as const }
    const { container } = render(<CoverFace b={b} w={200} h={150} />)
    expect(container.querySelector('img')).toBeNull()
    expect(
      container.querySelector<HTMLElement>('.sd-b3-hinge')?.style.width,
    ).toBe('8px')
    const title = container.querySelector<HTMLElement>('.sd-b3-title')
    expect(title?.style.fontSize).toBe('calc(var(--cover-k) * 150px)')
    expect(title?.style.top).toBe('9%')
  })
})
