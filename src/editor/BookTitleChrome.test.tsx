import { Profiler, type ProfilerOnRenderCallback } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BookTitleChrome } from './BookTitleChrome'
import { dispatchBookOp, resetBookStore } from './bookStore'

describe('BookTitleChrome', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
  })

  it('shows Untitled book then updates only when the title changes', () => {
    resetBookStore()
    let commits = 0
    const onRender: ProfilerOnRenderCallback = () => {
      commits += 1
    }

    render(
      <Profiler id="book-title-chrome" onRender={onRender}>
        <BookTitleChrome />
      </Profiler>,
    )

    expect(screen.getByTestId('book-title').textContent).toBe('Untitled book')
    const afterMount = commits

    act(() => {
      dispatchBookOp({ type: 'addToGallery', assetIds: ['a'] })
    })
    expect(commits).toBe(afterMount)
    expect(screen.getByTestId('book-title').textContent).toBe('Untitled book')

    act(() => {
      dispatchBookOp({ type: 'setTitle', title: 'Summer' })
    })
    expect(screen.getByTestId('book-title').textContent).toBe('Summer')
    expect(commits).toBeGreaterThan(afterMount)

    const afterTitle = commits
    act(() => {
      dispatchBookOp({ type: 'addToGallery', assetIds: ['b'] })
    })
    expect(commits).toBe(afterTitle)
    expect(screen.getByTestId('book-title').textContent).toBe('Summer')
  })
})
