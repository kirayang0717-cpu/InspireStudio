import { record, finite, metadata, media, safeHistory } from './historyValidation.ts'
import type { HistoryList } from './historyValidation.ts'
import type { VideoResult } from './videoService.ts'
export interface VideoWork extends VideoResult { id: string; savedAt: string; clip?: Blob }
export function validVideo(v: unknown): v is VideoWork {
 if (!record(v) || !metadata(v) || !record(v.brief)) return false
 const b=v.brief
 return v.source==='demo' && finite(v.seed) && Number.isInteger(v.seed) && typeof b.topic==='string' && !!b.topic.trim() && typeof b.description==='string' && !!b.description.trim() && ['自然极简','温暖叙事','夜色灵感'].includes(String(b.style)) && ['16:9','9:16','1:1'].includes(String(b.ratio)) && [15,30,60].includes(Number(b.duration)) && typeof b.duration==='number' && media(v.clip,'video/webm')
}
function open(): Promise<IDBDatabase> { return new Promise((resolve, reject) => {
  const request = indexedDB.open('inspirestudio.video.v1', 1)
  request.onupgradeneeded = () => request.result.createObjectStore('works', { keyPath: 'id' })
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(Error('视频历史存储不可用。'))
  request.onblocked = () => reject(Error('请关闭其他视频工坊页面后重试。'))
}) }
export async function videoHistory(action: 'list' | 'put' | 'delete', value?: VideoWork | string): Promise<HistoryList<VideoWork>> {
  if (action === 'put' && !validVideo(value)) throw Error('作品数据无效，原历史未修改。')
  if (action === 'delete' && (typeof value !== 'string' || !value)) throw Error('历史编号无效。')
  const db = await open()
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction('works', action === 'list' ? 'readonly' : 'readwrite'), store = tx.objectStore('works')
    if (action === 'put') store.put(value as VideoWork)
    if (action === 'delete') store.delete(value as string)
    const request = store.getAll()
    tx.oncomplete = () => {
      try { const all = safeHistory(request.result as unknown[], validVideo); all.sort((a,b) => b.savedAt.localeCompare(a.savedAt)); resolve(all) }
      catch { reject(Error('历史校验失败，原始数据保留。')) }
    }
    tx.onerror = () => reject(Error('视频保存失败，可能空间不足；请先导出备份。'))
    tx.onabort = () => reject(Error('视频存储事务已取消。'))
  }) } finally { db.close() }
}

