export const videoRatios = ['16:9', '9:16', '1:1'] as const
export const videoDurations = [15, 30, 60] as const
export const videoStyles = ['自然极简', '温暖叙事', '夜色灵感'] as const
export interface VideoBrief { topic: string; description: string; style: string; ratio: string; duration: number }
export interface VideoResult { brief: VideoBrief; seed: number; source: 'demo' }
export const initialVideo: VideoBrief = { topic: '', description: '', style: videoStyles[0], ratio: '16:9', duration: 15 }
export function dimensions(ratio: string) { return ratio === '16:9' ? [960,540] : ratio === '9:16' ? [540,960] : [720,720] }
export function generateVideo(brief: VideoBrief): VideoResult {
  if (!brief.topic.trim() || !brief.description.trim()) throw Error('请填写主题和创意描述。')
  if (!videoRatios.includes(brief.ratio as typeof videoRatios[number]) || !videoDurations.includes(brief.duration as typeof videoDurations[number]) || !videoStyles.includes(brief.style as typeof videoStyles[number])) throw Error('视频设置无效。')
  return { brief: { ...brief }, seed: crypto.getRandomValues(new Uint32Array(1))[0], source: 'demo' }
}
export function timeline(result: VideoResult, seconds: number) {
  const t = Math.max(0, Math.min(result.brief.duration, seconds))
  return { seconds: t, progress: t / result.brief.duration, scene: Math.min(2, Math.floor(t / result.brief.duration * 3)) }
}
export function drawVideo(canvas: HTMLCanvasElement, result: VideoResult, seconds: number) {
  const ctx = canvas.getContext('2d'); if (!ctx) throw Error('浏览器不支持画布预览。')
  const [w,h] = dimensions(result.brief.ratio)
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
  const { progress, scene } = timeline(result, seconds), b = result.brief
  const palette = b.style === '夜色灵感' ? ['#293d3b','#e5dcc5','#657f78'] : b.style === '温暖叙事' ? ['#f2e7df','#795f4e','#d7bca6'] : ['#e8ede3','#315f49','#a8bba0']
  ctx.fillStyle = palette[0]; ctx.fillRect(0,0,w,h)
  ctx.fillStyle = palette[2]; ctx.beginPath(); ctx.arc(w * (.5 + Math.sin(progress * Math.PI * 2 + result.seed % 10) * .18), h * .37, Math.min(w,h) * .27, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = palette[1]; ctx.globalAlpha = .2; ctx.fillRect(w*.12,h*.38,w*.76,h*.32); ctx.globalAlpha = 1
  ctx.font = '18px Microsoft YaHei, sans-serif'; ctx.fillText('INSPIRESTUDIO / LOCAL DEMO',w*.08,h*.1)
  ctx.font = 'bold 30px Microsoft YaHei, sans-serif'; ctx.fillText(b.topic.slice(0,16),w*.08,h*.53,w*.84)
  ctx.font = '20px Microsoft YaHei, sans-serif'
  const text = scene === 0 ? '灵感序章' : scene === 1 ? b.description : '让创作继续'
  Array.from({length: 3},(_,i) => text.slice(i*18,i*18+18)).forEach((line,i) => ctx.fillText(line,w*.08,h*.61+i*29,w*.84))
  ctx.fillText('本地模板演示 · 非 AI 生成',w*.08,h*.9,w*.84)
  ctx.fillStyle = palette[2]; ctx.fillRect(0,h-8,w*progress,8)
}
// Real-time browser recording. No AI service or microphone is used.
export async function recordVideo(canvas: HTMLCanvasElement, result: VideoResult, signal: AbortSignal, progress: (seconds: number) => void): Promise<Blob> {
  if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) throw Error('此浏览器不支持视频录制，可使用动画预览与作品保存。')
  const mime = ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t => MediaRecorder.isTypeSupported(t))
  if (!mime) throw Error('此浏览器不支持 WebM 导出。')
  drawVideo(canvas,result,0)
  const stream = canvas.captureStream(24)
  try { return await new Promise((resolve,reject) => {
    let timer: ReturnType<typeof setInterval>; let cancelled = false; const chunks: BlobPart[] = []
    const recorder = new MediaRecorder(stream,{ mimeType: mime })
    const clean = () => { clearInterval(timer); signal.removeEventListener('abort', abort) }
    const abort = () => { cancelled = true; if (recorder.state !== 'inactive') recorder.stop() }
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
    recorder.onerror = () => { clean(); reject(Error('录制失败，请检查浏览器资源后重试。')) }
    recorder.onstop = () => { clean(); if (cancelled) reject(Error('已取消导出。')); else { const blob = new Blob(chunks,{type:mime}); if (blob.size) resolve(blob); else reject(Error('没有录制到视频数据。')) } }
    if (signal.aborted) { reject(Error('已取消导出。')); return }
    signal.addEventListener('abort',abort,{once:true}); recorder.start(1000); const start = performance.now()
    timer = setInterval(() => { const t = Math.min(result.brief.duration,(performance.now()-start)/1000); drawVideo(canvas,result,t); progress(t); if (t >= result.brief.duration && recorder.state !== 'inactive') recorder.stop() },1000/24)
  }) } finally { stream.getTracks().forEach(t => t.stop()) }
}

