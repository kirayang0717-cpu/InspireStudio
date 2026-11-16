import type { VideoResult } from './videoService.ts'
export interface VideoWork extends VideoResult { id: string; savedAt: string; clip?: Blob }
function open(): Promise<IDBDatabase> { return new Promise((resolve, reject) => {
  const request = indexedDB.open('inspirestudio.video.v1', 1)
  request.onupgradeneeded = () => request.result.createObjectStore('works', { keyPath: 'id' })
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(Error('视频历史存储不可用。'))
  request.onblocked = () => reject(Error('请关闭其他视频工坊页面后重试。'))
}) }
export async function videoHistory(action: 'list' | 'put' | 'delete', value?: VideoWork | string): Promise<VideoWork[]> {
  const db = await open()
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction('works', action === 'list' ? 'readonly' : 'readwrite'), store = tx.objectStore('works')
    if (action === 'put') store.put(value as VideoWork)
    if (action === 'delete') store.delete(value as string)
    const request = store.getAll()
    tx.oncomplete = () => resolve((request.result as VideoWork[]).sort((a,b) => b.savedAt.localeCompare(a.savedAt)))
    tx.onerror = () => reject(Error('视频保存失败，可能空间不足；请先导出备份。'))
    tx.onabort = () => reject(Error('视频存储事务已取消。'))
  }) } finally { db.close() }
}

