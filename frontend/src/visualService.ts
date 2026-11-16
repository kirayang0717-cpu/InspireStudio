export const visualTypes = ['灵感插画', '活动海报', '内容封面', '产品概念'] as const
export const visualStyles = ['自然极简', '柔和几何', '复古纸感', '夜色灵感'] as const
export const ratios = ['1:1', '16:9', '9:16'] as const
export interface VisualBrief { type: string; purpose: string; topic: string; description: string; style: string; ratio: string }
export interface VisualResult { brief: VisualBrief; seed: number; source: 'demo' }
export const initialVisual: VisualBrief = { type: visualTypes[0], purpose: '社交分享', topic: '', description: '', style: visualStyles[0], ratio: '1:1' }
const escapeXml = (text: string) => text.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!)
// Local graphic template adapter. Future AI integrations must use a server-side API.
export async function generateVisual(brief: VisualBrief): Promise<VisualResult> {
  if (!brief.topic.trim() || !brief.description.trim()) throw new Error('请填写主题和画面描述。')
  return { brief: { ...brief }, seed: crypto.getRandomValues(new Uint32Array(1))[0], source: 'demo' }
}
export function visualSvg(result: VisualResult) {
  const b = result.brief
  const [w, h] = b.ratio === '16:9' ? [960, 540] : b.ratio === '9:16' ? [540, 960] : [720, 720]
  const palettes: Record<string, string[]> = { '自然极简': ['#e8ede3', '#315f49', '#b2c4a8'], '柔和几何': ['#f2e7df', '#986e59', '#d3b6a2'], '复古纸感': ['#eee4cd', '#6c6850', '#c9b881'], '夜色灵感': ['#293d3b', '#e1d8be', '#657f78'] }
  const [bg, ink, accent] = palettes[b.style] || palettes['自然极简']
  const offset = result.seed % 130
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 720 720" preserveAspectRatio="none"><rect width="720" height="720" fill="${bg}"/><circle cx="${430 + offset}" cy="265" r="175" fill="${accent}"/><path d="M0 530 Q180 ${210 + offset} 360 520 T720 430 V720 H0Z" fill="${ink}" opacity=".82"/><rect x="48" y="48" width="624" height="624" rx="${b.style === '柔和几何' ? 90 : 4}" fill="none" stroke="${ink}" opacity=".4"/><g fill="${ink}" font-family="Microsoft YaHei, sans-serif"><text x="70" y="100" font-size="15">INSPIRESTUDIO / LOCAL DEMO</text><text x="70" y="153" font-size="28">${escapeXml(b.topic.slice(0, 16))}</text><text x="70" y="190" font-size="16">${escapeXml(b.type)} · ${escapeXml(b.style)}</text></g><rect x="48" y="610" width="624" height="62" fill="${bg}"/><text x="70" y="649" fill="${ink}" font-family="Microsoft YaHei, sans-serif" font-size="18">本地图形模板演示 · 非 AI 生成</text></svg>`
}
export const visualUrl = (result: VisualResult) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(visualSvg(result))}`
