import { describe, expect, it } from 'vitest'
import { pagesOf } from '../core/pages'
import {
  bookMeta,
  hashForSlide,
  homeHead,
  homeLead,
  roomMeta,
  siteMetaOf,
  siteTitle,
  slideForHash,
  spreadRatio,
  viewLabel,
} from './siteModel'

describe('views', () => {
  it('labels the cover, single pages, page pairs and the back cover (D40)', () => {
    const labels = Array.from({ length: 13 }, (_, v) => viewLabel(v, 11))

    expect(labels.slice(0, 3)).toStrictEqual([
      'Cover',
      'Page 1 of 20',
      'Pages 2–3 of 20',
    ])
    expect(labels.slice(11)).toStrictEqual(['Page 20 of 20', 'Back cover'])
  })

  it('counts the pages a visitor sees', () => {
    expect([0, 1, 2, 11].map(pagesOf)).toStrictEqual([0, 1, 2, 20])
  })

  it('writes the room meta line with centimetres', () => {
    expect(
      roomMeta({ year: 2024, pageCount: 20, trimMm: { w: 190, h: 230 } }),
    ).toBe('2024 · 20 pages · 19 × 23 cm')
    expect(
      roomMeta({ year: 2025, pageCount: 1, trimMm: { w: 215, h: 279.4 } }),
    ).toBe('2025 · 1 page · 21.5 × 27.9 cm')
  })
})

describe('hash', () => {
  it('puts the first page of the spread in the hash; the covers have none', () => {
    expect([0, 1, 2, 3, 11, 12].map((s) => hashForSlide(s, 11))).toStrictEqual([
      '',
      '#p1',
      '#p2',
      '#p4',
      '#p20',
      '',
    ])
  })

  it('opens the spread holding the page, else the cover', () => {
    expect(slideForHash('#p6', 11)).toBe(4)
    expect(slideForHash('#p7', 11)).toBe(4)
    expect(slideForHash('#p1', 11)).toBe(1)
    expect(slideForHash('#p20', 11)).toBe(11)
    for (const hash of [
      '',
      '#p0',
      '#p21',
      '#p01',
      '#x6',
      '#p6x',
      '#p-1',
      'x#p6',
    ]) {
      expect(slideForHash(hash, 11)).toBe(0)
    }
  })

  it('takes the spread ratio from two trim pages', () => {
    expect(spreadRatio({ widthMm: 190, heightMm: 230 })).toBe(380 / 230)
  })
})

describe('text', () => {
  it('falls back to Photobooks for an empty site title', () => {
    expect(siteTitle('  ')).toBe('Photobooks')
    expect(siteTitle('Alex')).toBe('Alex')
  })

  it('heads the home with the author, else the site title (D37)', () => {
    expect(homeHead({ title: 'Site', author: ' Alex ' })).toBe('Alex')
    expect(homeHead({ title: 'Site', author: '  ' })).toBe('Site')
    expect(homeHead({ title: '' })).toBe('Photobooks')
  })

  it('leads with the intro, else Photobooks by the author, else none (D37)', () => {
    expect(homeLead({ author: 'Alex', intro: ' Lakes. ' })).toBe('Lakes.')
    expect(homeLead({ author: 'Alex', intro: ' ' })).toBe('Photobooks by Alex.')
    expect(homeLead({ author: ' ' })).toBeUndefined()
    expect(homeLead({})).toBeUndefined()
  })

  it('writes the book meta line', () => {
    expect(bookMeta('Alex', 20)).toBe('by Alex · 20 pages')
    expect(bookMeta('', 20)).toBe('20 pages')
  })
})

describe('siteMetaOf (site-settings S3, S7)', () => {
  it('falls back to the title "Photobooks" and nothing else', () => {
    expect(siteMetaOf({})).toStrictEqual({ title: 'Photobooks' })
    expect(siteMetaOf({ site: { theme: 'light' } })).toStrictEqual({
      title: 'Photobooks',
      theme: 'light',
    })
  })

  it('passes the stored settings through; the lead falls back via homeLead', () => {
    const site = siteMetaOf({
      site: { title: 'Alps', author: 'Ann', theme: 'dark' },
    })
    expect(site).toStrictEqual({ title: 'Alps', author: 'Ann', theme: 'dark' })
    expect(homeLead(site)).toBe('Photobooks by Ann.')
    expect(
      homeLead(siteMetaOf({ site: { author: 'Ann', intro: 'Lakes.' } })),
    ).toBe('Lakes.')
  })

  it('adds the publish url without trailing slashes; export has none', () => {
    expect(siteMetaOf({}, 'https://books.example.com//')).toStrictEqual({
      title: 'Photobooks',
      url: 'https://books.example.com',
    })
    expect(siteMetaOf({}, 'https://books.example.com/a')).toHaveProperty(
      'url',
      'https://books.example.com/a',
    )
  })
})
