import { useEffect, useState } from 'react'
import './connection.css'

export default function ConnectionStatus() {
  const [status, setStatus] = useState('正在检查连接…')
  const [busy, setBusy] = useState(false)
  const [connected, setConnected] = useState(false)
  async function check() {
    setBusy(true)
    setStatus('正在检查连接…')
    try {
      const response = await fetch('http://127.0.0.1:8000/api/health', {
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) throw new Error('Health check failed')
      const result = await response.json()
      if (result.status !== 'ok' || result.database !== 'connected') throw new Error('Unavailable')
      setConnected(true)
      setStatus('连接成功 · 后端服务与 SQLite 数据库正常')
    } catch {
      setConnected(false)
      setStatus('连接失败，请确认后端已启动，然后重试。')
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => { void check() }, 0)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <main className="connection-page">
      <p className="eyebrow">INSPIRESTUDIO · 灵感工坊</p>
      <h1>创意，从这里开始。</h1>
      <p>第一阶段 · 开发环境与基础架构</p>
      <section aria-label="系统连接状态">
        <h2>系统连接</h2>
        <p role="status" data-connected={connected}>{status}</p>
        <button disabled={busy} onClick={() => void check()}>{busy ? '检查中…' : '重新检查'}</button>
      </section>
    </main>
  )
}

