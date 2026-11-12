import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { imageSrc, keptQuery, pageHref, sitePageUrl } from './siteUrl'

const PAGE = 'https://site.test/books/abc/'

describe('pageHref', () => {
  it('keeps the links the export and the sample site write', () => {
    expect(pageHref('../../')).toBe('./../../')
    expect(pageHref('books/0123abcd/')).toBe('./books/0123abcd/')
    expect(pageHref('site.html?book=alps&x=1')).toBe(
      './site.html?book=alps&x=1',
    )
    expect(pageHref('a-b_c~d%20e')).toBe('./a-b_c~d%20e')
    expect(pageHref('')).toBe('./')
  })

  it('drops scheme and markup characters', () => {
    expect(pageHref('javascript:alert(1)')).toBe('./javascriptalert1')
    expect(pageHref('"><img src=x>')).toBe('./imgsrc=x')
    expect(pageHref('https://evil.test/')).toBe('./https//evil.test/')
  })

  it('keeps a protocol-relative link on this site', () => {
    expect(new URL(pageHref('//evil.test/x'), PAGE).origin).toBe(
      'https://site.test',
    )
  })

  test.prop([fc.string({ unit: 'binary' })], { numRuns: 1000 })(
    'every link resolves on this site',
    (href) => {
      expect(new URL(pageHref(href), PAGE).origin).toBe('https://site.test')
    },
  )
})

describe('imageSrc', () => {
  it('keeps the photo paths the export and the sample site write', () => {
    expect(imageSrc('../../media/a-480.webp')).toBe('../../media/a-480.webp')
    expect(imageSrc('/photos/hi/c18b.jpg')).toBe('/photos/hi/c18b.jpg')
  })

  it('rejects schemes, other hosts and markup', () => {
    expect(imageSrc('javascript:alert(1)')).toBe('javascriptalert1')
    expect(imageSrc('data:image/svg+xml,<svg>')).toBe('dataimage/svgxmlsvg')
    expect(imageSrc('https://evil.test/x.jpg')).toBe('https//evil.test/x.jpg')
    expect(imageSrc('//evil.test/x.jpg')).toBe('.//evil.test/x.jpg')
    expect(imageSrc('"><b>')).toBe('b')
  })

  test.prop([fc.string({ unit: 'binary' })], { numRuns: 1000 })(
    'every image loads from this site',
    (src) => {
      expect(new URL(imageSrc(src), PAGE).origin).toBe('https://site.test')
    },
  )
})

describe('keptQuery', () => {
  it('keeps only the listed keys, values to path characters', () => {
    expect(keptQuery('?book=sea&x=1&empty=1', ['book', 'empty'])).toBe(
      '?book=sea&empty=1',
    )
    expect(keptQuery('?book=%22%3E%3Cimg%3E', ['book'])).toBe('?book=img')
  })

  it('is empty without a listed key', () => {
    expect(keptQuery('?x=1', ['book'])).toBe('')
    expect(keptQuery('', ['book'])).toBe('')
  })
})

describe('sitePageUrl', () => {
  it('joins the site URL and the page path', () => {
    expect(sitePageUrl('https://site.test', 'books/abc/')).toBe(
      'https://site.test/books/abc/',
    )
    expect(sitePageUrl('https://site.test/photo/', '')).toBe(
      'https://site.test/photo/',
    )
    expect(sitePageUrl('http://Site.Test:8080/a', 'b/')).toBe(
      'http://site.test:8080/a/b/',
    )
  })

  it('drops the query, hash and markup characters', () => {
    expect(sitePageUrl('https://site.test/a?q=1#h', 'b"<x>/')).toBe(
      'https://site.test/a/bx/',
    )
  })

  it('has no URL without an http(s) site URL', () => {
    expect(sitePageUrl(undefined, '')).toBeUndefined()
    expect(sitePageUrl('', '')).toBeUndefined()
    expect(sitePageUrl('site.test', '')).toBeUndefined()
    expect(sitePageUrl('javascript:alert(1)', '')).toBeUndefined()
    expect(sitePageUrl('ftp://site.test', '')).toBeUndefined()
  })
})
