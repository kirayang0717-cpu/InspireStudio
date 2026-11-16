import { record, finite, metadata, media, safeHistory } from './historyValidation.ts'
import type { HistoryList } from './historyValidation.ts'
import type { VideoBrief, VideoResult } from './videoService.ts'
export interface VideoWork extends VideoResult { id: string; savedAt: string; clip?: Blob; revision?: number; revisionToken?: string }
export interface VideoDiagnostics { rawCount: number; validCount: number; quarantinedCount: number; failures: { index: number; reasons: string[] }[] }
export type VideoHistoryList = HistoryList<VideoWork> & { diagnostics: VideoDiagnostics }
export type VideoExpectedVersion = { legacy: true } | { revision: number; revisionToken: string }
// Omitted/undefined fields preserve stored values; null explicitly clears clip.
// id selects the target; it is never merged into the stored record.
export type VideoUpdate = Pick<VideoWork, 'id'> & Partial<Pick<VideoWork, 'seed' | 'source'>> & { brief?: Partial<VideoBrief>; clip?: Blob | null }
const businessFields = ['seed', 'source', 'clip'] as const
const briefFields = ['topic', 'description', 'style', 'ratio', 'duration'] as const
function providedFields(value: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
 return Object.fromEntries(keys.filter(key => Object.hasOwn(value, key) && value[key] !== undefined).map(key => [key, value[key]]))
}
export function videoExpectedVersion(work: VideoWork): VideoExpectedVersion {
 if (!validVideo(work)) throw Error('作品数据无效。')
 return legacy(work) ? { legacy: true } : { revision: work.revision!, revisionToken: work.revisionToken! }
}
function validVersion(v: Record<string, unknown>): boolean {
 return Number.isSafeInteger(v.revision) && (v.revision as number) >= 1 &&
  typeof v.revisionToken === 'string' && v.revisionToken.trim().length > 0
}
function legacy(v: object): boolean { return !('revision' in v) && !('revisionToken' in v) }
function matches(v: VideoWork, expected: VideoExpectedVersion): boolean {
 return 'legacy' in expected ? expected.legacy === true && legacy(v) :
  validVersion(expected) && v.revision === expected.revision && v.revisionToken === expected.revisionToken
}
export function videoValidationReasons(v: unknown): string[] {
 if (!record(v)) return ['记录不是对象']
 const reasons: string[] = []
 if (!legacy(v) && !validVersion(v)) reasons.push('revision 或 revisionToken 无效')
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
// `put` remains create-only. Updates and deletes require the caller's read version.
export function videoHistory(action: 'list'): Promise<VideoHistoryList>
export function videoHistory(action: 'put', value: VideoWork): Promise<VideoHistoryList>
export function videoHistory(action: 'update', value: VideoUpdate, expected: VideoExpectedVersion): Promise<VideoHistoryList>
export function videoHistory(action: 'delete', value: string, expected: VideoExpectedVersion): Promise<VideoHistoryList>
export async function videoHistory(action: 'list' | 'put' | 'update' | 'delete', value?: VideoWork | VideoUpdate | string, expected?: VideoExpectedVersion): Promise<VideoHistoryList> {
  if (action === 'put' && !validVideo(value)) throw Error('作品数据无效，原历史未修改。')
  if (action === 'update' && (!record(value) || typeof value.id !== 'string' || !value.id)) throw Error('历史编号无效。')
  if (action === 'delete' && (typeof value !== 'string' || !value)) throw Error('历史编号无效。')
  if ((action === 'update' || action === 'delete') && !expected) throw Error('必须提供预期版本，原历史未修改。')
  // Snapshot caller inputs before opening the database or yielding control.
  const input = typeof value === 'object' ? structuredClone(value) : value
  const version = expected ? structuredClone(expected) : undefined
  const db = await open()
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction('works', action === 'list' ? 'readonly' : 'readwrite'), store = tx.objectStore('works')
    let request: IDBRequest<unknown[]> | undefined
    let failure: Error | undefined
    const read = () => { request = store.getAll() }
    tx.oncomplete = () => {
      try { const raw = request!.result
        const failures = raw.flatMap((v,index) => { const reasons=videoValidationReasons(v); return reasons.length ? [{index,reasons}] : [] })
        const all = safeHistory(raw, validVideo) as VideoHistoryList
        all.diagnostics = { rawCount: raw.length, validCount: all.length, quarantinedCount: failures.length, failures }
        all.sort((a,b) => b.savedAt.localeCompare(a.savedAt)); resolve(all) }
      catch { reject(Error('历史校验失败，原始数据保留。')) }
    }
    tx.onerror = () => { failure ??= Error(action === 'list' ? '视频历史读取失败，原始数据保留。' : '视频写入失败，原历史未修改。') }
    tx.onabort = () => reject(failure ?? Error('视频存储事务已取消。'))
    try {
      if (action === 'put') {
        store.add({ ...(input as VideoWork), revision: 1, revisionToken: crypto.randomUUID() })
        read()
      } else if (action === 'update' || action === 'delete') {
        const id = action === 'delete' ? input as string : (input as VideoWork).id
        const current = store.get(id)
        current.onsuccess = () => {
          try {
            if (!validVideo(current.result) || !matches(current.result, version!)) throw Error('记录不存在、无效或版本冲突，原历史未修改。')
            if (action === 'delete') store.delete(id)
            else {
              const revision = legacy(current.result) ? 1 : current.result.revision! + 1
              if (!Number.isSafeInteger(revision)) throw Error('版本已达上限，原历史未修改。')
              const patch = input as VideoUpdate
              const fields = providedFields(patch, businessFields)
              if (patch.brief !== undefined) {
                // Preserve unknown legacy fields inside brief as well as at the top level.
                fields.brief = record(patch.brief) ? { ...current.result.brief, ...providedFields(patch.brief, briefFields) } : patch.brief
              }
              const next = { ...current.result, ...fields, revision, revisionToken: crypto.randomUUID() }
              if (fields.clip === null) delete next.clip
              if (!validVideo(next)) throw Error('作品数据无效，原历史未修改。')
              store.put(next)
            }
            read()
          } catch (error) { failure = error instanceof Error ? error : Error('视频写入失败。'); tx.abort() }
        }
      } else read()
    } catch (error) { failure = error instanceof Error ? error : Error('视频写入失败。'); tx.abort() }
  }) } finally { db.close() }
}
