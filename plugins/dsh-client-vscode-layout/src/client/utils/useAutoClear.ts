/**
 * Auto-clearing timer hook for transient notifications and state resets.
 *
 * Automatically triggers a clear callback after `delayMs` whenever `trigger`
 * is active/truthy, ensuring timer cleanup on unmount or trigger transition.
 */
import { useEffect } from 'react'

export function useAutoClear(
  trigger: unknown,
  onClear: () => void,
  delayMs: number,
): void {
  useEffect(() => {
    if (!trigger) return
    const timer = setTimeout(onClear, delayMs)
    return () => { clearTimeout(timer) }
  }, [trigger, onClear, delayMs])
}
