import { useEffect, useRef, useState } from 'react'
import { checkFile, decodeAudio, demoTranscript, encodeWav } from './audioService'
import { audioHistory, initialAudio } from './audioStorage'
import type { AudioDraft, AudioMode, AudioWork } from './audioStorage'
import './AudioWorkshop.css'
const names = { tts: '文本配音', asr: '语音转写', edit: '声音编辑' }
function Player({ blob, label }: { blob?: Blob; label: string }) {
  const audio = useRef<HTMLAudioElement>(null)
  const link = useRef<HTMLAnchorElement>(null)
  useEffect(() => { if (!blob) return; const u = URL.createObjectURL(blob); if (audio.current) audio.current.src = u; if (link.current) link.current.href = u; return () => URL.revokeObjectURL(u) }, [blob])
  return blob ? <div className="audio-player"><p>{label}</p><audio ref={audio} controls preload="metadata" />{label === '处理后音频' && <a ref={link} download="InspireStudio-edited.wav">下载 WAV</a>}</div> : null
}
export default function AudioWorkshop() {
  const [draft, setDraft] = useState<AudioDraft>({ ...initialAudio })
  const [works, setWorks] = useState<AudioWork[]>([])
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [speaking, setSpeaking] = useState(false)
  const mounted = useRef(true)
  const utterance = useRef<SpeechSynthesisUtterance | null>(null)
  useEffect(() => {
    mounted.current = true
    void audioHistory('list').then(w => { if (mounted.current) setWorks(w) }).catch(e => { if (mounted.current) setNotice(e.message) })
    const synth = window.speechSynthesis
    const refresh = () => setVoices(synth ? synth.getVoices().filter(v => v.localService) : [])
    refresh(); synth?.addEventListener('voiceschanged', refresh)
    return () => { mounted.current = false; synth?.removeEventListener('voiceschanged', refresh); synth?.cancel() }
  }, [])
  function stop() { utterance.current = null; window.speechSynthesis?.cancel(); setSpeaking(false) }
  function update(patch: Partial<AudioDraft>) { stop(); setDraft(d => ({ ...d, ...patch })); setDirty(true) }
  function discard() { return !dirty || window.confirm('替换未保存内容？需要保留时请先保存版本。') }
  function switchMode(mode: AudioMode) { if (mode === draft.mode || !discard()) return; stop(); setDraft({ ...initialAudio, mode }); setDirty(false); setNotice('已切换；每个方向的内容请分别保存。') }
  async function load(file?: File) {
    if (!file || !discard()) return
    setBusy(true)
    try { checkFile(file); const pcm = await decodeAudio(file); if (!mounted.current) return; stop(); setDraft(d => ({ ...d, input: file, output: undefined, name: file.name, start: 0, end: pcm.channels[0].length / pcm.sampleRate, gain: 1, text: d.mode === 'asr' ? '' : d.text })); setDirty(true); setNotice('已导入；文件只在此浏览器处理，没有上传服务器。') }
    catch (e) { setNotice(e instanceof Error ? e.message : '无法解码音频，请尝试标准 WAV 或 MP3 文件。') }
    finally { if (mounted.current) setBusy(false) }
  }
  function speak() {
    const voice = voices.find(v => v.voiceURI === draft.voice) || voices.find(v => v.lang.startsWith('zh')) || voices[0]
    if (!voice || !window.speechSynthesis) { setNotice('此浏览器没有可用的本机声音，请安装系统语音包或换用支持的浏览器。'); return }
    stop(); const u = new SpeechSynthesisUtterance(draft.text); utterance.current = u; u.voice = voice; u.lang = voice.lang; u.rate = draft.rate; u.pitch = Math.min(2, draft.pitch * (draft.tone === '明快' ? 1.15 : draft.tone === '沉稳' ? .85 : 1)); u.onend = () => { if (mounted.current && utterance.current === u) setSpeaking(false) }; u.onerror = () => { if (mounted.current && utterance.current === u) { setSpeaking(false); setNotice('试听未完成或已停止；请检查系统声音与浏览器语音支持。') } }; setSpeaking(true); window.speechSynthesis.speak(u)
  }
  async function process() {
    if (!draft.input) return
    setBusy(true)
    try { const pcm = await decodeAudio(draft.input); const output = encodeWav(pcm, draft.start, draft.end, draft.gain); if (mounted.current) { setDraft(d => ({ ...d, output })); setDirty(true); setNotice('已按当前裁剪区间和音量处理，可试听或导出 WAV。') } }
    catch (e) { setNotice(e instanceof Error ? e.message : '处理失败，请重试。') }
    finally { if (mounted.current) setBusy(false) }
  }
  async function save() {
    setBusy(true)
    try { const work = { ...draft, id: crypto.randomUUID(), savedAt: new Date().toISOString() }; const all = await audioHistory('put', work); setWorks(all); setDirty(false); setNotice('版本已保存到此浏览器，包含导入音频、文本与参数。') }
    catch (e) { setNotice(e instanceof Error ? e.message : '保存失败，请导出备份。') }
    finally { setBusy(false) }
  }
  async function remove(id: string) {
    if (!window.confirm('删除这个音频历史版本？')) return
    setBusy(true)
    try { setWorks(await audioHistory('delete', id)); setNotice('已删除历史版本。') } catch { setNotice('删除失败，原记录保留，请重试。') } finally { setBusy(false) }
  }
  return <section className="audio-workshop" aria-labelledby="audio-title"><header className="audio-heading"><div><p className="kicker">AUDIO STUDIO / 03</p><h1 id="audio-title">让灵感，被听见。</h1><p>从一段文字、一句声音开始，慢慢打磨你的作品。</p></div><span>本地工具 · AI 未连接</span></header>
    <p className="audio-note">配音为本机声音演示；语音转写尚未接入识别服务，示例不代表音频内容。声音编辑是真实本地处理，不调用 AI。</p>
    <div className="audio-modes" aria-label="音频创作方向">{(Object.keys(names) as AudioMode[]).map(mode => <button key={mode} disabled={busy} aria-pressed={draft.mode === mode} onClick={() => switchMode(mode)}>{names[mode]}</button>)}</div>
    <div className="audio-layout"><section className="audio-panel"><h2>01 / {names[draft.mode]}</h2><fieldset disabled={busy}>
      {draft.mode === 'tts' ? <><p className="audio-note">本地演示：使用浏览器列出的本机声音，不是 AI 配音 API。语气仅调整音高，不保证情感效果；仅试听，不能生成可下载的配音文件。</p><label>配音文字<textarea rows={7} maxLength={5000} value={draft.text} onChange={e => update({ text: e.target.value })} placeholder="输入你想听到的文字…" /></label><label>声音类型 / 本机声音<select value={draft.voice} onChange={e => update({ voice: e.target.value })}><option value="">优先中文 / 首个可用声音</option>{voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}（{v.lang}）</option>)}</select></label>{!voices.length && <p role="status">未检测到本机声音；可保存文字，暂时无法试听。</p>}<div className="audio-options"><label>语速<select value={draft.rate} onChange={e => update({ rate: Number(e.target.value) })}>{[.75,1,1.25,1.5].map(n => <option key={n} value={n}>{n} 倍</option>)}</select></label><label>语气<select value={draft.tone} onChange={e => update({ tone: e.target.value })}>{['自然','明快','沉稳'].map(t => <option key={t}>{t}</option>)}</select></label><label>音高<input type="number" min="0.5" max="1.5" step="0.1" value={draft.pitch} onChange={e => update({ pitch: Math.max(.5, Math.min(1.5, Number(e.target.value))) })} /></label></div><div className="audio-tools"><button disabled={!draft.text.trim() || !voices.length} onClick={speak}>试听配音（演示）</button><button disabled={!speaking} onClick={stop}>停止试听</button></div></> : <><label>{draft.mode === 'asr' ? '导入待转写音频' : '导入声音素材'}<input key={draft.mode} type="file" accept=".wav,.mp3,.m4a,.ogg,.webm,.flac" onChange={e => { void load(e.target.files?.[0]); e.target.value = '' }} /></label><p className="audio-note">最长 5 分钟、20 MB、单/双声道。支持格式取决于浏览器解码能力。原文件不会被修改。</p>{draft.input && <p>{draft.name} · 原始时长与参数可在试听区域查看</p>}{draft.mode === 'asr' ? <><button disabled={!draft.input} onClick={() => { if (draft.text && !window.confirm('用明确标记的示例替换当前文本？')) return; update({ text: demoTranscript }); setNotice('仅填入编辑流程示例，没有识别音频。') }}>填入演示文本（非识别）</button><p className="audio-note">真实 ASR 未接入。可边听边手动输入，不会自动转写文件。</p></> : <><div className="audio-options"><label>开始（秒）<input type="number" min="0" step="0.01" value={draft.start} onChange={e => update({ start: Number(e.target.value), output: undefined })} /></label><label>结束（秒）<input type="number" min="0" step="0.01" value={draft.end} onChange={e => update({ end: Number(e.target.value), output: undefined })} /></label></div><label>音量 {Math.round(draft.gain * 100)}%<input type="range" min="0" max="2" step="0.05" value={draft.gain} onChange={e => update({ gain: Number(e.target.value), output: undefined })} /></label><p className="audio-note">音量超过 100% 可能产生失真；输出会限幅到有效采样范围。</p><div className="audio-tools"><button disabled={!draft.input} onClick={() => void process()}>应用裁剪与音量</button><button disabled={!draft.input} onClick={() => { void decodeAudio(draft.input!).then(p => update({ start: 0, end: p.channels[0].length / p.sampleRate, gain: 1, output: undefined })).catch(() => setNotice('重置失败，请重新导入音频。')) }}>重置编辑</button></div></>}</>}
    </fieldset></section><section className="audio-panel"><h2>02 / 试听与整理</h2>{draft.mode === 'tts' ? <p>点击左侧试听。保存的是文字与声音参数，恢复后可再次试听；不保存合成录音。</p> : <><Player blob={draft.input} label="原始音频" />{draft.mode === 'edit' && <Player blob={draft.output} label="处理后音频" />}{!draft.input && <div className="audio-empty">≋<p>导入一段声音，开始创作。</p></div>}</>}
    {draft.mode === 'asr' && <><label>转写文本 / 手动整理<textarea rows={12} maxLength={30000} disabled={busy} value={draft.text} onChange={e => update({ text: e.target.value })} placeholder="尚无识别结果。可手动输入或填入明确标记的示例。" /></label><button disabled={!draft.text} onClick={() => { void navigator.clipboard.writeText(draft.text).then(() => setNotice('文本已复制。')).catch(() => setNotice('复制失败，请全选文本手动复制。')) }}>复制文本</button></>}
    <div className="audio-tools"><button className="audio-primary" disabled={busy || (!draft.text.trim() && !draft.input)} onClick={() => void save()}>保存作品 / 版本</button><span>{dirty ? '有未保存内容' : '等待创作 / 已保存'}</span></div><p role="status" className="audio-status">{busy ? '正在处理，请稍候…' : notice || '手动保存后可跨刷新恢复。'}</p></section></div>
    <section className="audio-panel audio-history"><h2>03 / 本地作品历史（{works.length}）</h2><p className="audio-note">仅此浏览器与当前地址保存，不同步账号。音频保存在浏览器 IndexedDB；清除浏览器数据会丢失，请导出重要素材。未保存内容离开页面会丢失。</p>{!works.length && <p>还没有保存的作品。</p>}{works.map(work => <article key={work.id}><div><strong>{names[work.mode]} · {work.name || work.text.slice(0,40) || '未命名作品'}</strong><small>{new Date(work.savedAt).toLocaleString('zh-CN')} · {work.mode === 'edit' ? '本地处理' : '演示 / 手动内容'}</small></div><button disabled={busy} onClick={() => { if (!discard()) return; stop(); const { id: _id, savedAt: _saved, ...data } = work; setDraft(data); setDirty(false); setNotice('已恢复文本、参数和保存的音频。') }}>打开 / 恢复</button><button disabled={busy} onClick={() => void remove(work.id)}>删除</button></article>)}</section>
  </section>
}

