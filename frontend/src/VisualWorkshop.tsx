import { mutateHistory } from './historyMutation'
import { useLeaveGuard } from './useLeaveGuard'
import { useRef, useState } from 'react'
import { generateVisual, initialVisual, ratios, visualStyles, visualTypes, visualUrl } from './visualService'
import type { VisualBrief, VisualResult } from './visualService'
import { readVisualWorks, writeVisualWorks } from './visualStorage'
import type { VisualWork } from './visualStorage'
import './VisualWorkshop.css'

export default function VisualWorkshop() {
  const [stored] = useState(() => { try { return readVisualWorks(localStorage) } catch { return { works: [], error: '浏览器存储不可用，请下载作品备份。' } } })
  const [works, setWorks] = useState<VisualWork[]>(stored.works)
  const [brief, setBrief] = useState<VisualBrief>({ ...initialVisual })
  const [result, setResult] = useState<VisualResult | null>(null)
  const [notice, setNotice] = useState(stored.error)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  useLeaveGuard(dirty || busy || JSON.stringify(brief) !== JSON.stringify(result?.brief ?? initialVisual))
  const description = useRef<HTMLTextAreaElement>(null)
  const changed = result && JSON.stringify(result.brief) !== JSON.stringify(brief)
  function update(key: keyof VisualBrief, value: string) { setBrief(b => ({ ...b, [key]: value })) }
  async function generate() {
    if (dirty && !window.confirm('替换未保存的演示结果？需要保留时请先保存作品。')) return
    setBusy(true)
    try { setResult(await generateVisual(brief)); setDirty(true); setNotice('本地演示已更新。描述仅记录为提示词，不会被 AI 理解或绘制；重新生成只改变模板构图。') }
    catch (e) { setNotice(e instanceof Error ? e.message : '演示失败，请重试。') }
    finally { setBusy(false) }
  }
  async function persist(next: VisualWork[]) {
    try { const merged = await mutateHistory('inspirestudio.visual.v1', works, next, 30, () => { const stored = readVisualWorks(localStorage); if (stored.error) throw Error(stored.error); return stored.works }, items => writeVisualWorks(localStorage, items)); setWorks(merged); return true }
    catch { setNotice('保存失败：浏览器存储不可用或空间不足，请下载 SVG 备份。'); return false }
  }
  async function save() {
    if (!result) return
    if (await persist([{ ...result, id: crypto.randomUUID(), savedAt: new Date().toISOString() }, ...works])) { setDirty(JSON.stringify(brief) !== JSON.stringify(result.brief)); setNotice('作品及生成时的提示词已保存到此浏览器，最多保留最近 30 个版本。') }
  }
  function restore(work: VisualWork) {
    if ((dirty || JSON.stringify(brief) !== JSON.stringify(result?.brief ?? initialVisual)) && !window.confirm('恢复作品会替换未保存的演示结果，继续吗？')) return
    setBrief({ ...work.brief }); setResult(work); setDirty(false); setNotice('已恢复作品与生成时的全部设置。')
  }
  return <section className="visual-workshop" aria-labelledby="visual-title">
    <header className="visual-heading"><div><p className="kicker">VISUAL STUDIO / 02</p><h1 id="visual-title">让想象，有了形状。</h1><p>记录画面灵感，探索属于你的视觉表达。</p></div><span>本地演示 · AI 未连接</span></header>
    <p className="visual-disclaimer">当前使用本地 SVG 图形模板，不调用图像生成 API。主题作为文字排版，风格改变配色，比例改变画布；画面描述与用途仅保存为创作设置，不会生成对应物体。</p>
    <div className="visual-layout"><form className="visual-panel" onSubmit={e => { e.preventDefault(); void generate() }}><h2>01 / 描述你的画面</h2>
      <fieldset><legend>创作类型</legend><div className="visual-choices">{visualTypes.map(type => <button type="button" key={type} aria-pressed={brief.type === type} onClick={() => update('type', type)}>{type}</button>)}</div></fieldset>
      <label>用途<select value={brief.purpose} onChange={e => update('purpose', e.target.value)}>{['社交分享', '活动宣传', '文章配图', '灵感探索'].map(p => <option key={p}>{p}</option>)}</select></label>
      <label>主题 <small>必填</small><input required maxLength={120} value={brief.topic} onChange={e => update('topic', e.target.value)} placeholder="例如：春日城市读书会" /></label>
      <label>画面描述 / 提示词 <small>必填</small><textarea ref={description} required maxLength={3000} rows={5} value={brief.description} onChange={e => update('description', e.target.value)} placeholder="记录主体、环境、光线与构图，例如：窗边的书与绿植，柔和晨光，大面积留白。" /></label>
      <fieldset><legend>视觉风格</legend><div className="visual-choices">{visualStyles.map(style => <button type="button" key={style} aria-pressed={brief.style === style} onClick={() => update('style', style)}>{style}</button>)}</div></fieldset>
      <fieldset><legend>画面比例</legend><div className="visual-choices">{ratios.map(ratio => <button type="button" key={ratio} aria-pressed={brief.ratio === ratio} onClick={() => update('ratio', ratio)}>{ratio}</button>)}</div></fieldset>
      <button className="visual-primary" disabled={busy || !brief.topic.trim() || !brief.description.trim()} type="submit">{busy ? '正在准备…' : result ? '重新生成演示 ↗' : '生成本地演示 ↗'}</button>
    </form><section className="visual-panel" aria-labelledby="visual-preview"><h2 id="visual-preview">02 / 预览你的灵感</h2>
      <div className="visual-preview">{result ? <img src={visualUrl(result)} alt={`${result.brief.topic}，${result.brief.style}，${result.brief.ratio}本地图形模板演示，非 AI 生成`} /> : <div className="visual-empty"><span aria-hidden="true">◈</span><p>从一个画面想法开始</p><small>填写左侧设置，生成本地图形模板演示。</small></div>}</div>
      {result && <><p className="visual-meta">本地演示 · 非 AI 生成 · {result.brief.ratio} · {dirty ? '尚未保存' : '已保存'}{changed ? ' · 设置已修改，预览仍为上次结果' : ''}</p><details><summary>查看此结果的提示词</summary><p className="visual-prompt">{result.brief.description}</p><p>{result.brief.type} / {result.brief.purpose} / {result.brief.style}</p></details></>}
      <div className="visual-tools"><button type="button" disabled={!result || busy || !dirty} onClick={save}>保存作品 / 版本</button><button type="button" onClick={() => { description.current?.focus(); description.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }}>编辑提示词</button>{result && <a download="InspireStudio-local-demo.svg" href={visualUrl(result)}>下载演示 SVG</a>}</div>
      <p role="status" className="visual-status">{notice || '作品手动保存后可跨刷新恢复；未保存的结果不会保留。'}</p>
    </section></div>
    <section className="visual-panel visual-history" aria-labelledby="visual-history"><h2 id="visual-history">03 / 本地作品历史（{works.length}）</h2><p>仅此浏览器保存，不同步到账号。清除浏览器数据会丢失作品；每次保存独立保留一个版本，最多 30 个。</p>{!works.length && <p>还没有保存的作品。</p>}<div className="visual-history-grid">{works.map(work => <article key={work.id}><img src={visualUrl(work)} alt={`${work.brief.topic}本地演示缩略图`} /><strong>{work.brief.topic}</strong><small>{work.brief.style} · {work.brief.ratio}<br />{new Date(work.savedAt).toLocaleString('zh-CN')}</small><div className="visual-tools"><button type="button" disabled={busy} onClick={() => restore(work)}>打开 / 恢复</button><button type="button" onClick={async () => { if (window.confirm('删除这个本地作品版本？')) { if (await persist(works.filter(w => w.id !== work.id))) setNotice('已删除所选历史版本。') } }}>删除</button></div></article>)}</div></section>
  </section>
}
