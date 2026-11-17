// Temporary, opt-in diagnostics. Emits JSON snapshots only; never stores media or controls it.
const MEDIA_DIAGNOSTIC_PREFIX = '[InspireStudio:VideoMedia]'
let diagnosticPageId: string | undefined
let diagnosticObjectSequence = 0
const diagnosticObjects = new WeakMap<object, number>()
export function videoMediaDiagnosticsEnabled(): boolean {
 try { return typeof location !== 'undefined' && new URLSearchParams(location.search).get('debugVideoMedia') === '1' } catch { return false }
}
export function videoMediaObjectId(value: object): number {
 let id = diagnosticObjects.get(value)
 if (id === undefined) { id = ++diagnosticObjectSequence; diagnosticObjects.set(value,id) }
 return id
}
export function traceVideoMedia(event: string, details: () => Record<string, unknown> = () => ({})): void {
 if (!videoMediaDiagnosticsEnabled()) return
 try {
  diagnosticPageId ??= crypto.randomUUID()
  console.info(MEDIA_DIAGNOSTIC_PREFIX + ' ' + JSON.stringify({event,pageId:diagnosticPageId,
   timeOriginMs:performance.timeOrigin,tMs:performance.now(),...details()}))
 } catch { /* Observation must not fail a media, history, or storage operation. */ }
}

export const VIDEO_HISTORY_CHANNEL = 'inspirestudio.video.history.v1'
// Notification-only marker: never a database key or mutation instruction.
export const VIDEO_HISTORY_ALL = '*'
export const VIDEO_HISTORY_PROTOCOL = 'inspirestudio.video.history'
export type HistoryOperation = 'create' | 'update' | 'delete'
export interface HistoryMessage { protocol: typeof VIDEO_HISTORY_PROTOCOL; version: 1; eventId: string; senderId: string; operation: HistoryOperation; workId: string }
export interface HistoryChannel {
 onmessage: ((event: { data: unknown }) => void) | null
 onmessageerror: (() => void) | null
 postMessage(message: HistoryMessage): void
 close(): void
}
export type ChannelFactory = (name: string) => HistoryChannel | undefined
const nativeChannel: ChannelFactory = name => {
 if (typeof BroadcastChannel !== 'function') return undefined
 const native = new BroadcastChannel(name)
 const adapter: HistoryChannel = {
  onmessage: null, onmessageerror: null,
  postMessage: message => native.postMessage(message),
  close: () => { native.onmessage = null; native.onmessageerror = null; native.close() },
 }
 native.onmessage = event => adapter.onmessage?.({data:event.data})
 native.onmessageerror = () => adapter.onmessageerror?.()
 return adapter
}
export function validHistoryMessage(value: unknown): value is HistoryMessage {
 try {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  const keys = ['protocol','version','eventId','senderId','operation','workId']
  const text = (key: string, max: number) => typeof v[key] === 'string' && !!v[key].trim() && v[key].length <= max
  return Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v,key)) &&
   v.protocol === VIDEO_HISTORY_PROTOCOL && v.version === 1 && text('eventId',128) && text('senderId',128) && text('workId',1024) &&
   ['create','update','delete'].includes(String(v.operation)) && typeof v.operation === 'string'
 } catch { return false }
}
// One bus per document runtime; no sessionStorage identity and no persistent connection without subscribers.
export function createVideoHistoryBus(factory: ChannelFactory = nativeChannel, senderId: string = crypto.randomUUID()) {
 const listeners = new Set<() => void>(), seen = new Set<string>()
 let channel: HistoryChannel | undefined
 const notify = () => { for (const listener of listeners) { try { listener() } catch { /* A listener cannot break delivery to others. */ } } }
 const connect = () => {
  if (channel) return channel
  try {
   channel = factory(VIDEO_HISTORY_CHANNEL)
   if (channel) {
    channel.onmessage = ({data}) => {
     traceVideoMedia('history.notification.received',()=>validHistoryMessage(data)?{eventId:data.eventId,senderId:data.senderId,operation:data.operation,workId:data.workId}:{valid:false})
     if (!validHistoryMessage(data) || data.senderId === senderId || seen.has(data.eventId)) return
     traceVideoMedia('history.notification.accepted',()=>({eventId:data.eventId,operation:data.operation,workId:data.workId}))
     seen.add(data.eventId)
     if (seen.size > 256) seen.delete(seen.values().next().value!)
     // All accepted events, including '*', only invalidate the full history.
     notify()
    }
    channel.onmessageerror = notify
   }
  } catch { channel = undefined }
  return channel
 }
 const disconnect = () => {
  const old = channel; channel = undefined
  if (old) { old.onmessage = null; old.onmessageerror = null; try { old.close() } catch { /* best effort */ } }
  seen.clear()
 }
 return {
  subscribe(listener: () => void) {
   listeners.add(listener); connect()
   return () => { listeners.delete(listener); if (!listeners.size) disconnect() }
  },
  publish(operation: HistoryOperation, workId: string) {
   try {
    const target = connect()
    // Keep storage's broader legacy ID rules; use full-history invalidation when
    // a real ID cannot fit the bounded transport protocol. Never alter the stored ID.
    const notificationId = workId.trim() && workId.length <= 1024 ? workId : VIDEO_HISTORY_ALL
    traceVideoMedia('history.notification.send',()=>({operation,workId:notificationId,channelAvailable:!!target}))
    target?.postMessage({protocol:VIDEO_HISTORY_PROTOCOL,version:1,eventId:crypto.randomUUID(),senderId,operation,workId:notificationId})
   } catch { /* Notification failure must never change a committed storage result. */ }
   finally { if (!listeners.size) disconnect() }
  },
 }
}
export const videoHistoryBus = createVideoHistoryBus()

// All initial, local and remote refreshes share this single-flight coordinator.
// Disposal doesn't cancel IndexedDB, so remounts share a gate until an old read settles.
export function createHistoryReadGate<T>() {
 let active: Promise<T> | undefined
 return gated
 function gated(read: () => Promise<T>): Promise<T> {
  if (active) return active.then(() => gated(read), () => gated(read))
  const next = Promise.resolve().then(read); active = next
  const clear = () => { if (active === next) active = undefined }
  void next.then(clear,clear); return next
 }
}
export function createHistoryRefresh<T>(options: {
 read: () => Promise<T>; onHistory: (history: T) => void; onError: (error: unknown) => void
 subscribe: (listener: () => void) => () => void
 delayMs?: number; gate?: (read: () => Promise<T>) => Promise<T>
}) {
 let disposed = false, paused = false, pending = false, reading = false, generation = 0
 let timer: ReturnType<typeof setTimeout> | undefined
 const gate = options.gate ?? createHistoryReadGate<T>()
 const schedule = () => {
  if (disposed || paused || reading || !pending || timer !== undefined) return
  timer = setTimeout(() => { timer = undefined; void drain() }, options.delayMs ?? 100)
 }
 const drain = async () => {
  if (disposed || paused || reading || !pending) return
  pending = false; reading = true
  const started = generation
  try {
   const history = await gate(() => { if (disposed || paused || started !== generation) throw Error('Obsolete history reader'); traceVideoMedia('history.refresh.start',()=>({generation:started})); return options.read() })
   traceVideoMedia('history.refresh.complete',()=>({generation:started,currentGeneration:generation,applied:!disposed&&!paused&&started===generation}))
   if (!disposed && !paused && started === generation) options.onHistory(history)
  } catch (error) {
   traceVideoMedia('history.refresh.error',()=>({generation:started,currentGeneration:generation,message:error instanceof Error?error.message:String(error)}))
   if (!disposed && !paused && started === generation) options.onError(error)
  } finally { reading = false; schedule() }
 }
 const request = () => { if (!disposed) { generation++; pending = true; schedule() } }
 const unsubscribe = options.subscribe(request)
 request()
 return {
  request,
  setPaused(value: boolean) {
   if (disposed || value === paused) return
   paused = value
   // Invalidate an in-flight result when recording/local mutation starts.
   if (value) { generation++; pending = true; if (timer !== undefined) { clearTimeout(timer); timer = undefined } }
   else schedule()
  },
  dispose() { if (disposed) return; disposed = true; generation++; if (timer !== undefined) clearTimeout(timer); unsubscribe() },
 }
}
