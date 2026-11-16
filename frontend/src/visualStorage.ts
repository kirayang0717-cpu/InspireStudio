import { ratios, visualStyles, visualTypes } from './visualService.ts'
import type { VisualResult } from './visualService.ts'
export interface VisualWork extends VisualResult { id: string; savedAt: string }
export const visualKey = 'inspirestudio.visual.v1'
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>
function decode(raw: string | null): VisualWork[] {
  const data: unknown = JSON.parse(raw ?? '[]')
  if (!Array.isArray(data) || data.length > 30) throw new Error('作品存储格式异常')
  const ids = new Set<string>()
  for (const item of data) {
    const b = item?.brief
    if (!item || typeof item.id !== 'string' || ids.has(item.id) || !Number.isFinite(Date.parse(item.savedAt)) || item.source !== 'demo' || !Number.isInteger(item.seed) || !b || !['topic', 'description', 'purpose'].every(k => typeof b[k] === 'string') || !visualTypes.includes(b.type) || !visualStyles.includes(b.style) || !ratios.includes(b.ratio)) throw new Error('作品存储格式异常')
    ids.add(item.id)
  }
  return data as VisualWork[]
}
export function readVisualWorks(storage: StorageAccess) {
  try { return { works: decode(storage.getItem(visualKey)), error: '' } }
  catch { return { works: [] as VisualWork[], error: '无法读取本地作品；原始数据保留。下次保存前会备份，请先下载当前作品。' } }
}
export function writeVisualWorks(storage: StorageAccess, works: VisualWork[]) {
  const raw = storage.getItem(visualKey)
  try { decode(raw) } catch { if (raw !== null) storage.setItem(`${visualKey}.backup.${crypto.randomUUID()}`, raw) }
  storage.setItem(visualKey, JSON.stringify(works))
}
