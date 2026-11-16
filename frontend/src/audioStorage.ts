import { record, finite, metadata, media, safeHistory } from './historyValidation.ts'
import type { HistoryList } from './historyValidation.ts'
export type AudioMode = 'tts' | 'asr' | 'edit'
export interface AudioDraft { mode: AudioMode; text: string; voice: string; rate: number; pitch: number; tone: string; name: string; start: number; end: number; gain: number; input?: Blob; output?: Blob }
export interface AudioWork extends AudioDraft { id: string; savedAt: string }
export const initialAudio: AudioDraft = { mode: 'tts', text: '', voice: '', rate: 1, pitch: 1, tone: '自然', name: '', start: 0, end: 0, gain: 1 }
export function validAudio(v: unknown): v is AudioWork {
 if (!record(v) || !metadata(v) || !['tts','asr','edit'].includes(String(v.mode))) return false
 if (!['text','voice','tone','name'].every(k => typeof v[k] === 'string')) return false
 if (!['rate','pitch','start','end','gain'].every(k => finite(v[k]))) return false
 return Number(v.rate)>0 && Number(v.rate)<=10 && Number(v.pitch)>=0 && Number(v.pitch)<=2 && Number(v.start)>=0 && Number(v.end)>=Number(v.start) && Number(v.gain)>=0 && Number(v.gain)<=2 && media(v.input,'audio/') && media(v.output,'audio/')
}
function open(): Promise<IDBDatabase> { return new Promise((resolve, reject) => {
  const request = indexedDB.open('inspirestudio.audio.v1', 1)
  request.onupgradeneeded = () => request.result.createObjectStore('works', { keyPath: 'id' })
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(Error('音频历史存储不可用。'))
  request.onblocked = () => reject(Error('请关闭其他音频工坊页面后重试。'))
}) }
export async function audioHistory(action: 'list' | 'put' | 'delete', value?: AudioWork | string): Promise<HistoryList<AudioWork>> {
  if (action === 'put' && !validAudio(value)) throw Error('作品数据无效，原历史未修改。')
  if (action === 'delete' && (typeof value !== 'string' || !value)) throw Error('历史编号无效。')
  const db = await open()
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction('works', action === 'list' ? 'readonly' : 'readwrite'), store = tx.objectStore('works')
    if (action === 'put') store.put(value as AudioWork)
    if (action === 'delete') store.delete(value as string)
    const request = store.getAll()
    tx.oncomplete = () => {
      try { const all = safeHistory(request.result as unknown[], validAudio); all.sort((a,b) => b.savedAt.localeCompare(a.savedAt)); resolve(all) }
      catch { reject(Error('历史校验失败，原始数据保留。')) }
    }
    tx.onerror = () => reject(Error('音频保存失败，可能空间不足；请先导出备份。'))
    tx.onabort = () => reject(Error('音频存储事务已取消。'))
  }) } finally { db.close() }
}
