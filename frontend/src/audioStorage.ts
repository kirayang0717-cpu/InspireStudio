export type AudioMode = 'tts' | 'asr' | 'edit'
export interface AudioDraft { mode: AudioMode; text: string; voice: string; rate: number; pitch: number; tone: string; name: string; start: number; end: number; gain: number; input?: Blob; output?: Blob }
export interface AudioWork extends AudioDraft { id: string; savedAt: string }
export const initialAudio: AudioDraft = { mode: 'tts', text: '', voice: '', rate: 1, pitch: 1, tone: '自然', name: '', start: 0, end: 0, gain: 1 }
function open(): Promise<IDBDatabase> { return new Promise((resolve, reject) => {
  const request = indexedDB.open('inspirestudio.audio.v1', 1)
  request.onupgradeneeded = () => request.result.createObjectStore('works', { keyPath: 'id' })
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(Error('音频历史存储不可用。'))
  request.onblocked = () => reject(Error('请关闭其他音频工坊页面后重试。'))
}) }
export async function audioHistory(action: 'list' | 'put' | 'delete', value?: AudioWork | string): Promise<AudioWork[]> {
  const db = await open()
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction('works', action === 'list' ? 'readonly' : 'readwrite'), store = tx.objectStore('works')
    if (action === 'put') store.put(value as AudioWork)
    if (action === 'delete') store.delete(value as string)
    const request = store.getAll()
    tx.oncomplete = () => resolve((request.result as AudioWork[]).sort((a,b) => b.savedAt.localeCompare(a.savedAt)))
    tx.onerror = () => reject(Error('音频保存失败，可能空间不足；请先导出备份。'))
    tx.onabort = () => reject(Error('音频存储事务已取消。'))
  }) } finally { db.close() }
}
