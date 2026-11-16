export interface PCM { sampleRate: number; channels: Float32Array[] }
export function checkFile(file: { name: string; size: number }) {
  if (!/\.(wav|mp3|m4a|ogg|webm|flac)$/i.test(file.name)) throw Error('请选择 WAV、MP3、M4A、OGG、WebM 或 FLAC 音频。')
  if (!file.size || file.size > 20 * 1024 * 1024) throw Error('音频必须非空且不超过 20 MB。')
}
export async function decodeAudio(blob: Blob): Promise<PCM> {
  const context = new AudioContext()
  try {
    const b = await context.decodeAudioData(await blob.arrayBuffer())
    if (b.duration > 300 || b.numberOfChannels > 2) throw Error('第一版支持最长 5 分钟、单声道或双声道音频。')
    return { sampleRate: b.sampleRate, channels: Array.from({ length: b.numberOfChannels }, (_, i) => b.getChannelData(i).slice()) }
  } finally { await context.close() }
}
export function encodeWav(pcm: PCM, start: number, end: number, gain: number): Blob {
  const { sampleRate, channels } = pcm
  const length = channels[0]?.length ?? 0
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || !channels.length || channels.length > 2 || channels.some(c => c.length !== length)) throw Error('音频数据无效。')
  if (![start, end, gain].every(Number.isFinite) || start < 0 || end <= start || end > length / sampleRate || gain < 0 || gain > 2) throw Error('请设置有效裁剪区间和 0–200% 音量。')
  const first = Math.floor(start * sampleRate), last = Math.min(length, Math.floor(end * sampleRate)), frames = last - first
  if (frames < 1) throw Error('裁剪区间至少需要一个采样。')
  const size = frames * channels.length * 2, buffer = new ArrayBuffer(44 + size), view = new DataView(buffer)
  const str = (at: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); view.setUint32(4, 36 + size, true); str(8, 'WAVE'); str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels.length, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels.length * 2, true); view.setUint16(32, channels.length * 2, true); view.setUint16(34, 16, true); str(36, 'data'); view.setUint32(40, size, true)
  let at = 44
  for (let i = first; i < last; i++) for (const c of channels) { const s = Math.max(-1, Math.min(1, c[i] * gain)); view.setInt16(at, Math.round(s * (s < 0 ? 32768 : 32767)), true); at += 2 }
  return new Blob([buffer], { type: 'audio/wav' })
}
export const demoTranscript = '【本地示例 · 非语音识别结果】\n这里展示转写文本的编辑流程。系统没有分析导入音频，请删除示例并手动填写实际听到的内容。'
