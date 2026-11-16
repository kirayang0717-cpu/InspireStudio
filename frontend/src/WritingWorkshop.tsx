import { mutateHistory } from './historyMutation'
import { useLeaveGuard } from './useLeaveGuard'
import { useState } from 'react'
import { contentTypes, demoWritingService } from './writingService'
import type { WritingBrief } from './writingService'
import './WritingWorkshop.css'

import { initial, readVersions, writeVersions } from './writingStorage'
import type { Version } from './writingStorage'

export default function WritingWorkshop() {
  const [brief, setBrief] = useState<WritingBrief>(initial)
  const [text, setText] = useState('')
  const [stored] = useState(() => {
    try { return readVersions(localStorage) } catch { return { versions: [], error: '浏览器存储不可用。', repaired: false } }
  })
  const [versions, setVersions] = useState<Version[]>(stored.versions)
  const [active, setActive] = useState<Version | null>(null)
  const [historyOpen, setHistoryOpen] = useState(stored.versions.length > 0)
  const [notice, setNotice] = useState(stored.error || (stored.repaired ? '部分草稿字段已恢复为默认值；原始数据将在下次保存前备份。' : ''))
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  useLeaveGuard(dirty || busy)
  const update = (key: keyof WritingBrief, value: string) => { setBrief(b => ({ ...b, [key]: value })); setDirty(true) }
  async function persist(next: Version[]) {
    try { const merged = await mutateHistory('inspirestudio.writing.v1', versions, next, 20, () => { const stored = readVersions(localStorage); if (stored.error) throw Error(stored.error); return stored.versions }, items => writeVersions(localStorage, items)); setVersions(merged); return true }
    catch { setNotice('浏览器存储不可用或空间不足，请复制文案备份。'); return false }
  }
  async function save() {
    const now = new Date().toISOString()
    const version: Version = { id: crypto.randomUUID(), savedAt: now, createdAt: active?.createdAt ?? now, updatedAt: now, brief: { ...brief }, text }
    if (await persist([version, ...versions])) { setActive(version); setHistoryOpen(true); setDirty(false); setNotice('已保存到此浏览器。可在下方草稿与版本中打开，最多保留最近 20 个版本。') }
  }
  function restore(version: Version) {
    if (busy || (dirty && !window.confirm('打开此版本会替换未保存内容，继续吗？'))) return
    setBrief({ ...version.brief }); setText(version.text); setActive(version); setDirty(false)
    setNotice('已打开所选版本，内容与创作设置已恢复。')
    document.getElementById('writing-result')?.focus()
  }
  async function generate() {
    if (text && !window.confirm('用新的演示内容替换当前正文？需要保留时请先保存版本。')) return
    setBusy(true)
    try { const result = await demoWritingService.generate(brief); setText(result.text); setDirty(true); setNotice('模板演示已生成，可直接编辑；AI API 尚未接入。') }
    catch (error) { setNotice(error instanceof Error ? error.message : '生成失败，请重试。') }
    finally { setBusy(false) }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(text); setNotice('文案已复制。') }
    catch { setNotice('复制失败，请在正文编辑区全选并手动复制。') }
  }
  return <section className="writing-workshop" aria-labelledby="writing-title">
    <div className="writing-heading"><div><p className="kicker">WRITING STUDIO / 01</p><h1 id="writing-title">让灵感，落在纸上。</h1><p>从一个想法开始，慢慢打磨成你的表达。</p></div><span className="writing-demo">模板演示 · AI 未连接</span></div>
    <p className="writing-disclaimer">当前使用本地模板填充，展示创作流程，不调用 AI 服务。篇幅选项控制模板详略，不保证字数；发布前请核实并完善内容。</p>
    <div className="writing-layout"><form className="writing-panel" onSubmit={e => { e.preventDefault(); void generate() }}>
      <h2><span>01</span> 描述你的想法</h2>
      <fieldset><legend>创作类型</legend><div className="writing-types">{contentTypes.map(type => <button key={type} type="button" aria-pressed={brief.type === type} onClick={() => update('type', type)}>{type}</button>)}</div></fieldset>
      <label>主题 / 创作需求 <small>必填</small><textarea required maxLength={2000} rows={4} value={brief.topic} onChange={e => update('topic', e.target.value)} placeholder="例如：为周末的城市读书会写一篇招募文案" /></label>
      <label>目标受众<input maxLength={200} value={brief.audience} onChange={e => update('audience', e.target.value)} placeholder="例如：喜欢阅读的年轻上班族" /></label>
      <div className="writing-options"><label>语气 / 风格<select value={brief.tone} onChange={e => update('tone', e.target.value)}>{Array.from(new Set([brief.tone, '轻松亲切', '专业理性', '活泼有趣', '温暖走心'])).map(t => <option key={t}>{t}</option>)}</select></label><label>篇幅<select value={brief.length} onChange={e => update('length', e.target.value)}>{Array.from(new Set([brief.length, '简短', '标准', '详细'])).map(t => <option key={t}>{t}</option>)}</select></label></div>
      <label>关键要点 <small>选填 · 每行一条</small><textarea maxLength={3000} rows={3} value={brief.points} onChange={e => update('points', e.target.value)} placeholder={'活动时间、产品特点、行动引导……'} /></label>
      <button className="writing-primary" disabled={busy || !brief.topic.trim()} type="submit">{busy ? '正在准备…' : '生成演示文案 ↗'}</button>
    </form><div className="writing-panel writing-editor"><div className="writing-editor-heading"><h2><span>02</span> 打磨你的表达</h2><span>{text.length} 字符</span></div><div className="writing-tools"><button type="button" onClick={copy} disabled={!text}>复制文案</button><button type="button" onClick={save} disabled={!text && !brief.topic.trim()}>保存草稿 / 版本</button><span>{dirty ? '有未保存修改' : '等待创作 / 已保存'}</span></div>
      <label className="writing-result-label" htmlFor="writing-result">正文编辑区 · 纯文本</label><textarea id="writing-result" className="writing-result" value={text} onChange={e => { setText(e.target.value); setDirty(true) }} placeholder="演示文案将出现在这里。你也可以直接输入自己的文案。" />
      {active && <p className="writing-metadata">当前版本：{active.brief.topic || '未命名草稿'} · 创建：{new Date(active.createdAt).toLocaleString('zh-CN')} · 更新：{new Date(active.updatedAt).toLocaleString('zh-CN')}</p>}
      <p className="writing-status" role="status">{notice || '自由编辑、复制，或保存一个版本，留住每次灵感。'}</p>
      <details className="writing-history" open={historyOpen} onToggle={e => setHistoryOpen(e.currentTarget.open)}><summary>草稿与版本（{versions.length}）</summary><p>仅保存在此浏览器，不会同步到账号。清除浏览器数据会丢失草稿。</p>{versions.length === 0 && <p>还没有保存的版本。</p>}{versions.map(v => <div className="writing-version" data-active={active?.id === v.id} key={v.id}><div><strong>{v.brief.topic || '未命名草稿'}</strong><small>{v.brief.type} · {new Date(v.savedAt).toLocaleString('zh-CN')}</small></div><button type="button" disabled={busy} aria-pressed={active?.id === v.id} onClick={() => restore(v)}>{active?.id === v.id ? '重新载入' : '打开 / 恢复'}</button><button type="button" onClick={() => { if (window.confirm('删除这个已保存版本？')) persist(versions.filter(item => item.id !== v.id)) }}>删除</button></div>)}</details>
    </div></div>
  </section>
}
