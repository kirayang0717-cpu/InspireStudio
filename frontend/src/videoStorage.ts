import { record, finite, metadata, media, safeHistory } from './historyValidation.ts'
import type { HistoryList } from './historyValidation.ts'
import type { VideoResult } from './videoService.ts'
export interface VideoWork extends VideoResult { id: string; savedAt: string; clip?: Blob }
export interface VideoDiagnostics { rawCount: number; validCount: number; quarantinedCount: number; failures: { index: number; reasons: string[] }[] }
export type VideoHistoryList = HistoryList<VideoWork> & { diagnostics: VideoDiagnostics }
export function videoValidationReasons(v: unknown): string[] {
 if (!record(v)) return ['记录不是对象']
 const reasons: string[] = []
 if (!metadata(v)) reasons.push('id 或 savedAt 无效')
 if (v.source !== 'demo') reasons.push('source 无效')
 if (!finite(v.seed) || !Number.isInteger(v.seed)) reasons.push('seed 无效')
 if (!record(v.brief)) reasons.push('brief 缺失或无效')
 else {
  const b=v.brief
  if (typeof b.topic!=='string' || !b.topic.trim()) reasons.push('主题缺失或无效')
  if (typeof b.description!=='string' || !b.description.trim()) reasons.push('描述缺失或无效')
  if (!['自然极简','温暖叙事','夜色灵感'].includes(String(b.style))) reasons.push('风格无效')
  if (!['16:9','9:16','1:1'].includes(String(b.ratio))) reasons.push('比例无效')
  if (typeof b.duration!=='number' || ![15,30,60].includes(b.duration)) reasons.push('时长无效')
 }
 if (!media(v.clip,'video/webm')) reasons.push('WebM Blob 为空或类型无效')
 return reasons
}
export function validVideo(v: unknown): v is VideoWork { return videoValidationReasons(v).length===0 }
function open(): Promise<IDBDatabase> { return new Promise((resolve, reject) => {
  const request = indexedDB.open('inspirestudio.video.v1', 1)
  request.onupgradeneeded = () => request.result.createObjectStore('works', { keyPath: 'id' })
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(Error('视频历史存储不可用。'))
  request.onblocked = () => reject(Error('请关闭其他视频工坊页面后重试。'))
}) }
export async function videoHistory(action: 'list' | 'put' | 'delete', value?: VideoWork | string): Promise<VideoHistoryList> {
  if (action === 'put' && !validVideo(value)) throw Error('作品数据无效，原历史未修改。')
  if (action === 'delete' && (typeof value !== 'string' || !value)) throw Error('历史编号无效。')
  const db = await open()
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction('works', action === 'list' ? 'readonly' : 'readwrite'), store = tx.objectStore('works')
    if (action === 'put') store.put(value as VideoWork)
    if (action === 'delete') store.delete(value as string)
    const request = store.getAll()
    tx.oncomplete = () => {
      try { const raw = request.result as unknown[]
        const failures = raw.flatMap((v,index) => { const reasons=videoValidationReasons(v); return reasons.length ? [{index,reasons}] : [] })
        const all = safeHistory(raw, validVideo) as VideoHistoryList
        all.diagnostics = { rawCount: raw.length, validCount: all.length, quarantinedCount: failures.length, failures }
         all.sort((a,b) => b.savedAt.localeCompare(a.savedAt)); resolve(all) }
      catch { reject(Error('历史校验失败，原始数据保留。')) }
    }
    tx.onerror = () => reject(Error(action === 'list' ? '视频历史读取失败，原始数据保留。' : '视频保存失败，可能空间不足；请先导出备份。'))
    tx.onabort = () => reject(Error('视频存储事务已取消。'))
  }) } finally { db.close() }
}

