import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { Menu, MenuItem, MenuPopover, MenuSeparator, MenuTrigger } from './Menu'

describe('Menu', () => {
  afterEach(() => {
    cleanup()
  })

  it('selects an item through the public onAction prop', async () => {
    const onAction = vi.fn()
    render(
      <MenuTrigger>
        <Button>Actions</Button>
        <MenuPopover>
          <Menu onAction={onAction}>
            <MenuItem id="dup">Duplicate</MenuItem>
            <MenuItem id="del" variant="destructive">
              Delete
            </MenuItem>
          </Menu>
        </MenuPopover>
      </MenuTrigger>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
    expect(await screen.findByRole('menu')).toBeTruthy()
    const del = screen.getByRole('menuitem', { name: 'Delete' })
    expect(del.getAttribute('data-variant')).toBe('destructive')
    fireEvent.click(del)
    expect(onAction.mock.calls[0]?.[0]).toBe('del')
  })

  it('renders a menu separator between items', async () => {
    render(
      <MenuTrigger>
        <Button>More</Button>
        <MenuPopover>
          <Menu>
            <MenuItem id="a">A</MenuItem>
            <MenuSeparator data-testid="menu-sep" />
            <MenuItem id="b">B</MenuItem>
          </Menu>
        </MenuPopover>
      </MenuTrigger>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(await screen.findByTestId('menu-sep')).toBeTruthy()
  })
})
