import { useEffect, useLayoutEffect, useRef } from 'react'
import { installLeaveGuard } from './leaveGuard'
export function useLeaveGuard(dirty: boolean) {
  const current = useRef(dirty)
  useLayoutEffect(() => { current.current = dirty }, [dirty])
  useEffect(() => installLeaveGuard(window, () => current.current), [])
}
