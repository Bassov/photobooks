import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { AlertDialog } from './AlertDialog'
import { Button } from './Button'
import { Icon } from './Icon'
import { Menu, MenuItem, MenuPopover, MenuTrigger } from './Menu'

describe('AlertDialog icon tile', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the leading icon tile when given an icon', async () => {
    render(
      <AlertDialog
        isOpen
        title="Remove?"
        icon={<Icon name="delete" size={16} />}
      />,
    )
    const dialog = await screen.findByRole('alertdialog')
    const tile = dialog.querySelector('.pb-alert-dialog-head > span')
    expect(tile?.querySelector('svg')).not.toBeNull()
    expect(tile?.className).toContain('text-destructive')
  })

  it('uses the gray tile for neutral tone and none without an icon', async () => {
    const { rerender } = render(
      <AlertDialog
        isOpen
        tone="neutral"
        title="Change?"
        icon={<Icon name="folderSync" size={16} />}
      />,
    )
    const dialog = await screen.findByRole('alertdialog')
    const tile = dialog.querySelector('.pb-alert-dialog-head > span')
    expect(tile?.className).not.toContain('text-destructive')
    rerender(<AlertDialog isOpen tone="neutral" title="Change?" />)
    expect(
      (await screen.findByRole('alertdialog')).querySelector(
        '.pb-alert-dialog-head > span',
      ),
    ).toBeNull()
  })
})

describe('Menu selected item', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows a check on the selected item only', async () => {
    render(
      <MenuTrigger>
        <Button>Sort</Button>
        <MenuPopover>
          <Menu selectionMode="single" selectedKeys={['b']}>
            <MenuItem id="a">A</MenuItem>
            <MenuItem id="b">B</MenuItem>
          </Menu>
        </MenuPopover>
      </MenuTrigger>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sort' }))
    const b = await screen.findByRole('menuitemradio', { name: 'B' })
    expect(b.querySelector('.pb-menu-item__check svg')).not.toBeNull()
    const a = screen.getByRole('menuitemradio', { name: 'A' })
    expect(a.querySelector('.pb-menu-item__check svg')).toBeNull()
  })

  it('has no check slot in a plain action menu', async () => {
    render(
      <MenuTrigger>
        <Button>More</Button>
        <MenuPopover>
          <Menu>
            <MenuItem id="a">A</MenuItem>
          </Menu>
        </MenuPopover>
      </MenuTrigger>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    const a = await screen.findByRole('menuitem', { name: 'A' })
    expect(a.querySelector('.pb-menu-item__check')).toBeNull()
  })
})
