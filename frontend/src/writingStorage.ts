import { contentTypes } from './writingService.ts'
import type { WritingBrief } from './writingService.ts'

export type Version = { id: string; savedAt: string; createdAt: string; updatedAt: string; brief: WritingBrief; text: string }
export const storageKey = 'inspirestudio.writing.v1'
export const initial: WritingBrief = { type: '社交媒体文案', topic: '', audience: '', tone: '轻松亲切', length: '标准', points: '' }
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const date = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v))

function decode(raw: string | null) {
  const data: unknown = JSON.parse(raw ?? '[]')
  if (!Array.isArray(data)) throw new Error('草稿存储格式异常')
  const versions: Version[] = []
  let repaired = false
  data.forEach((v: unknown, index) => {
    if (!record(v) || typeof v.text !== 'string' || !record(v.brief)) { repaired = true; return }
    const brief = { ...initial }
    for (const key of Object.keys(initial) as (keyof WritingBrief)[]) {
      const value = v.brief[key]
      if (typeof value === 'string' && (key !== 'type' || contentTypes.includes(value as WritingBrief['type']))) {
        Object.assign(brief, { [key]: value })
      } else repaired = true
    }
    const savedAt = date(v.savedAt) ? v.savedAt : date(v.updatedAt) ? v.updatedAt : new Date(0).toISOString()
    const candidate = typeof v.id === 'string' && v.id ? v.id : `recovered-${index}`
    const id = versions.some(item => item.id === candidate) ? `${candidate}-recovered-${index}` : candidate
    versions.push({ id, savedAt, createdAt: date(v.createdAt) ? v.createdAt : savedAt,
      updatedAt: date(v.updatedAt) ? v.updatedAt : savedAt, brief, text: v.text })
  })
  return { versions, repaired }
}

export function readVersions(storage: StorageAccess) {
  try {
    const result = decode(storage.getItem(storageKey))
    return { ...result, error: '' }
  } catch {
    return { versions: [] as Version[], repaired: false, error: '无法读取草稿存储；原始数据保留，保存前会尝试备份。' }
  }
}

export function writeVersions(storage: StorageAccess, versions: Version[]) {
  // Never overwrite unreadable or partially recoverable data without a backup.
  const raw = storage.getItem(storageKey)
  let backup = false
  try { backup = decode(raw).repaired } catch { backup = true }
  if (backup && raw !== null) storage.setItem(`${storageKey}.backup.${crypto.randomUUID()}`, raw)
  storage.setItem(storageKey, JSON.stringify(versions))
}
