let currentGuard: (() => boolean) | undefined
export function allowRouteChange() { return currentGuard?.() ?? true }
export function installLeaveGuard(target: Window, dirty: () => boolean) {
  let accepted = target.location.hash
  const unload = (event: BeforeUnloadEvent) => { if (dirty()) { event.preventDefault(); event.returnValue = '' } }
  const approve = () => {
    if (target.location.hash === accepted) return true
    if (dirty() && !target.confirm('有未保存的修改，离开将丢失这些内容。确定离开吗？')) {
      target.history.replaceState(null, '', target.location.pathname + target.location.search + accepted)
      return false
    }
    accepted = target.location.hash
    return true
  }
  currentGuard = approve
  const change = (event: Event) => { if (!approve()) event.stopImmediatePropagation() }
  target.addEventListener('beforeunload', unload)
  target.addEventListener('hashchange', change, true)
  return () => { if (currentGuard === approve) currentGuard = undefined; target.removeEventListener('beforeunload', unload); target.removeEventListener('hashchange', change, true) }
}
