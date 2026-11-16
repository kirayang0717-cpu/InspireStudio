import { useEffect, useRef, useState } from 'react'
import ConnectionStatus from './ConnectionStatus'
import './App.css'
import WritingWorkshop from './WritingWorkshop'
import VisualWorkshop from './VisualWorkshop'
import AudioWorkshop from './AudioWorkshop'
import VideoWorkshop from './VideoWorkshop'

const workshops = [
  { id: 'writing', name: '文案工坊', en: 'WRITING', icon: 'Aa', color: 'sage', description: '让每一个想法，找到恰好的表达。', tags: ['社交文案', '文章创作', '短视频脚本'], detail: '从社交媒体文案、文章、广告到产品介绍与短视频脚本，逐步接入生成、润色、富文本编辑和版本管理。' },
  { id: 'visual', name: '视觉工坊', en: 'VISUAL', icon: '◈', color: 'peach', description: '把脑海里的画面，变成眼前的作品。', tags: ['灵感生图', '海报设计', '封面创作'], detail: '逐步接入文生图、参考图、风格与比例选择，并提供海报文字排版、图片预览和下载。' },
  { id: 'audio', name: '音频工坊', en: 'AUDIO', icon: '≋', color: 'lavender', description: '赋予文字声音，让故事被听见。', tags: ['文本配音', '语音转写', '声音编辑'], detail: '逐步接入文本转语音、语音转文字、音色与语速选择，以及基础裁剪和音频导出。' },
  { id: 'video', name: '视频工坊', en: 'VIDEO', icon: '▷', color: 'sand', description: '串联文字、画面与声音，讲好一个故事。', tags: ['脚本分镜', '字幕编辑', '视频合成'], detail: '逐步接入脚本与分镜、素材和配音导入、字幕编辑及视频合成，支持 15、30、60 秒视频与 MP4 导出。' },
] as const

function getRoute() { return window.location.hash.slice(1) || '/' }

export default function App() {
  const [route, setRoute] = useState(getRoute)
  const main = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const change = () => { setRoute(getRoute()); window.scrollTo(0, 0); main.current?.focus() }
    window.addEventListener('hashchange', change)
    return () => window.removeEventListener('hashchange', change)
  }, [])
  const workshop = workshops.find(item => route === `/workshops/${item.id}`)
  const home = route === '/'
  const connection = route === '/connection'
  return (
    <div className="studio-app">
      <a className="skip-link" href="#page-content" onClick={event => { event.preventDefault(); main.current?.focus() }}>跳转到内容</a>
      <header className="studio-header">
        <a className="brand" href="#/" aria-label="InspireStudio 首页"><span className="brand-mark" aria-hidden="true">✳</span><span>InspireStudio<small>灵感工坊</small></span></a>
        <nav aria-label="主导航">
          <a href="#/" aria-current={home ? 'page' : undefined}>创意首页</a>
          <a href="#/workshops/writing" aria-current={workshop ? 'page' : undefined}>四大工坊</a>
          <a href="#/connection" aria-current={connection ? 'page' : undefined}>系统连接</a>
        </nav>
        <span className="header-note">为每一个灵感，留一扇门</span>
      </header>
      <div id="page-content" ref={main} tabIndex={-1}>
        {home ? <main className="home-page">
          <section className="welcome" aria-labelledby="welcome-title">
            <div className="welcome-copy"><p className="kicker">YOUR IDEAS, BROUGHT TO LIFE</p><h1 id="welcome-title">一点灵感，<br />无限<span>可能。</span></h1><p className="intro">从第一行文字到最后一帧画面，<br />在这里，让创意自然生长。</p><a className="primary-button" href="#/workshops/writing">从文案开始创作 <span aria-hidden="true">↗</span></a><p className="welcome-caption">你的多模态 AI 创意工作台</p></div>
            <div className="idea-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><span className="art-label">A LITTLE SPARK.</span><div className="art-card card-word">Aa<span>文字的力量</span></div><div className="art-card card-image">◈<span>想象的形状</span></div><div className="art-card card-sound">≋<span>故事的声音</span></div><div className="art-card card-video">▷<span>流动的灵感</span></div><div className="art-center">✳</div><span className="art-bottom">ENDLESS POSSIBILITIES.</span></div>
          </section>
          <section className="workshops" aria-labelledby="workshops-title"><div className="section-heading"><div><p className="kicker">EXPLORE YOUR STUDIO</p><h2 id="workshops-title">今天，想创造点什么？</h2></div><p>四种表达方式，同一个创意起点。</p></div><div className="workshop-grid">{workshops.map((item, i) => <a className={`workshop-card ${item.color}`} href={`#/workshops/${item.id}`} key={item.id}><div className="card-top"><span className="workshop-icon" aria-hidden="true">{item.icon}</span><span className="card-number">0{i + 1} / {item.en}</span></div><h3>{item.name}</h3><p>{item.description}</p><div className="tags">{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div><div className="card-bottom">探索工坊<span aria-hidden="true">↗</span></div></a>)}</div></section>
          <aside className="studio-note"><span aria-hidden="true">✳</span><div><h2>好作品，从一个小小的念头开始。</h2><p>选择一个工坊，开启你的下一次创作。</p></div><span className="phase-label">首页与导航已就绪 · 创作功能逐步开放</span></aside>
        </main> : connection ? <><div className="connection-back"><a href="#/">← 返回创意首页</a></div><ConnectionStatus /></> : workshop ? <main className="detail-page"><a className="back-link" href="#/">← 返回创意首页</a><nav className="workshop-tabs" aria-label="工坊导航">{workshops.map(item => <a key={item.id} href={`#/workshops/${item.id}`} aria-current={item.id === workshop.id ? 'page' : undefined}>{item.name}</a>)}</nav>{workshop.id === 'writing' ? <WritingWorkshop /> : workshop.id === 'visual' ? <VisualWorkshop /> : workshop.id === 'audio' ? <AudioWorkshop /> : <VideoWorkshop />}</main> : <main className="detail-page"><h1>这个页面还不存在</h1><a className="primary-button" href="#/">返回首页</a></main>}
      </div>
      <footer className="studio-footer"><span>InspireStudio · 灵感工坊</span><span>让灵感发生，让创作继续。</span><a href="#/connection">查看系统连接 ↗</a></footer>
    </div>
  )
}




