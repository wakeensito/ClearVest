type Focusable = Pick<HTMLElement, 'focus' | 'isConnected'>

/**
 * Where focus goes when a dialog closes: back to what had it when the dialog opened (the search box
 * after Shift+Enter), if that element is still on the page and focusable; otherwise the fallback.
 */
export function focusReturnTarget(previous: Element | Partial<Focusable> | null, fallback: Focusable | null): Focusable | null {
  const el = previous as Partial<Focusable> | null
  return el && el.isConnected && typeof el.focus === 'function' ? (el as Focusable) : fallback
}
