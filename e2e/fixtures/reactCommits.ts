import type { Page } from '@playwright/test'

/**
 * React commit probe: a minimal `__REACT_DEVTOOLS_GLOBAL_HOOK__` installed
 * before the app loads. Each commit records the first DOM node of every
 * component that rendered in it, with the DevTools rule: a component
 * rendered when it mounted or carries `PerformedWork`; a subtree whose child
 * list is unchanged bailed out and is skipped. DOM nodes work with minified
 * builds, where component names do not.
 */
export async function installReactCommitProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    interface Fiber {
      tag: number
      flags: number
      child: Fiber | null
      sibling: Fiber | null
      alternate: Fiber | null
      stateNode: unknown
    }
    /** Function, Class, ForwardRef, Memo, SimpleMemo */
    const COMPOSITE = new Set([0, 1, 11, 14, 15])
    const HOST = 5
    const PERFORMED_WORK = 1
    const commits: (Element | null)[][] = []
    const hostOf = (fiber: Fiber): Element | null => {
      const stack: Fiber[] = fiber.child ? [fiber.child] : []
      for (let f = stack.shift(); f; f = stack.shift()) {
        if (f.tag === HOST) return f.stateNode as Element
        if (f.child) stack.unshift(f.child)
        if (f.sibling) stack.push(f.sibling)
      }
      return null
    }
    const visit = (next: Fiber, out: (Element | null)[]) => {
      const prev = next.alternate
      if (
        COMPOSITE.has(next.tag) &&
        (prev === null || (next.flags & PERFORMED_WORK) !== 0)
      ) {
        out.push(hostOf(next))
      }
      if (prev !== null && prev.child === next.child) return
      for (let c = next.child; c; c = c.sibling) visit(c, out)
    }
    const renderers = new Map<number, unknown>()
    const none = () => undefined
    const hook = {
      renderers,
      supportsFiber: true,
      inject(renderer: unknown) {
        const id = renderers.size + 1
        renderers.set(id, renderer)
        return id
      },
      onScheduleFiberRoot: none,
      onCommitFiberRoot(_id: number, root: { current: Fiber }) {
        const out: (Element | null)[] = []
        visit(root.current, out)
        commits.push(out)
      },
      onCommitFiberUnmount: none,
      onPostCommitFiberRoot: none,
      checkDCE: none,
    }
    Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
      configurable: true,
      value: hook,
    })
    Object.defineProperty(window, '__reactCommits', { value: commits })
  })
}

type ProbeWindow = Window & { __reactCommits?: (Element | null)[][] }

/** Forget the commits so far. */
export async function clearReactCommits(page: Page): Promise<void> {
  await page.evaluate(() => {
    const commits = (window as ProbeWindow).__reactCommits
    if (!commits) throw new Error('React commit probe is not installed')
    commits.length = 0
  })
}

/**
 * Commits since the last clear, and the components that rendered outside
 * `selector` (tag + test id of their first DOM node, `-` with none).
 */
export async function reactCommitsOutside(
  page: Page,
  selector: string,
): Promise<{ commits: number; rendered: number; outside: string[] }> {
  return page.evaluate((selector) => {
    const commits = (window as ProbeWindow).__reactCommits
    if (!commits) throw new Error('React commit probe is not installed')
    const scope = document.querySelector(selector)
    const all = commits.flat()
    const outside = all
      .filter((el) => el === null || !scope?.contains(el))
      .map((el) =>
        el === null
          ? '-'
          : `${el.tagName.toLowerCase()}[${el.getAttribute('data-testid') ?? ''}]`,
      )
    return { commits: commits.length, rendered: all.length, outside }
  }, selector)
}
