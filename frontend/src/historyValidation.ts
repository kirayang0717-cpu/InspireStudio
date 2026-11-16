export type HistoryList<T> = T[] & { warning?: string }
export const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
export const metadata = (v: Record<string, unknown>) => typeof v.id === 'string' && !!v.id && typeof v.savedAt === 'string' && Number.isFinite(Date.parse(v.savedAt))
export const media = (v: unknown, prefix: string) => v === undefined || (v instanceof Blob && v.size > 0 && v.type.startsWith(prefix))
export function safeHistory<T>(items: unknown[], valid: (v: unknown) => v is T): HistoryList<T> {
  const result: HistoryList<T> = items.filter(valid)
  if (result.length !== items.length) result.warning = '部分历史记录损坏或不完整，已隔离显示；原始记录仍保留在浏览器中，未删除或覆盖。'
  return result
}
