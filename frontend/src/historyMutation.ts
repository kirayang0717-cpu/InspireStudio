// Apply only this tab's additions/deletions to the latest persisted collection.
export function mergeHistory<T extends { id: string }>(latest: T[], previous: T[], next: T[], limit: number): T[] {
  const previousIds = new Set(previous.map(item => item.id))
  const nextIds = new Set(next.map(item => item.id))
  const removed = new Set(previous.filter(item => !nextIds.has(item.id)).map(item => item.id))
  const added = next.filter(item => !previousIds.has(item.id))
  return [...added, ...latest.filter(item => !removed.has(item.id) && !added.some(a => a.id === item.id))].slice(0, limit)
}
export async function mutateHistory<T extends { id: string }>(key: string, previous: T[], next: T[], limit: number, read: () => T[], write: (items: T[]) => void, locks: Pick<LockManager, 'request'> = navigator.locks): Promise<T[]> {
  if (!locks) throw Error('浏览器不支持安全的多标签保存，请更新浏览器。')
  return locks.request(key, () => {
    const merged = mergeHistory(read(), previous, next, limit)
    write(merged)
    return merged
  })
}
