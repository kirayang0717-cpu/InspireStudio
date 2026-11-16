import type { VideoHistoryList } from './videoStorage.ts'
export type VideoHistoryState =
 | { status: 'loading' }
 | { status: 'success-empty' | 'success-with-records'; history: VideoHistoryList }
 | { status: 'read-error'; message: string }
export async function readVideoHistory(read: () => Promise<VideoHistoryList>): Promise<VideoHistoryState> {
 try { const history=await read(); return {status: history.length ? 'success-with-records' : 'success-empty', history} }
 catch (error) { return {status:'read-error',message:error instanceof Error ? error.message : '无法读取视频历史，原始数据保留。'} }
}
export function historyHeading(state: VideoHistoryState): string {
 switch(state.status) {
 case 'loading': return '读取中…'
 case 'read-error': return '读取失败'
 default: return String(state.history.length)
 }
}
