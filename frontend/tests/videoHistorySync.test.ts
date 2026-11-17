import { IDBFactory, IDBObjectStore as FakeObjectStore } from 'fake-indexeddb'
import { videoHistory, videoExpectedVersion } from '../src/videoStorage.ts'
import type { VideoHistoryList } from '../src/videoStorage.ts'
import { generateVideo, initialVideo } from '../src/videoService.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createVideoHistoryBus, createHistoryRefresh, createHistoryReadGate, validHistoryMessage, VIDEO_HISTORY_CHANNEL, VIDEO_HISTORY_PROTOCOL, VIDEO_HISTORY_ALL, traceVideoMedia, videoMediaDiagnosticsEnabled, videoMediaObjectId } from '../src/videoHistorySync.ts'
import type { HistoryChannel, HistoryMessage } from '../src/videoHistorySync.ts'
import { readFileSync } from 'node:fs'

function network() {
 const channels=new Set<HistoryChannel>(), messages: HistoryMessage[]=[]
 let opened=0,closed=0
 const factory=(name: string) => {
  assert.equal(name,VIDEO_HISTORY_CHANNEL);opened++
  const channel: HistoryChannel={onmessage:null,onmessageerror:null,
   postMessage(message){messages.push(message);for(const peer of channels)if(peer!==channel)peer.onmessage?.({data:structuredClone(message)})},
   close(){closed++;channels.delete(channel)}}
  channels.add(channel);return channel
 }
 return {factory,channels,messages,counts:()=>({opened,closed})}
}
const message=(eventId='event'): HistoryMessage=>({protocol:VIDEO_HISTORY_PROTOCOL,version:1,eventId,senderId:'remote',operation:'create',workId:'work'})
async function until(check:()=>boolean) {for(let i=0;i<200;i++){if(check())return;await new Promise(r=>setTimeout(r,2))}assert.fail('condition did not settle')}
function deferred<T>() {let resolve!: (value:T)=>void, reject!: (error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}

test('protocol accepts only six bounded fields; rejects malformed and extra payload',()=>{
 assert.equal(validHistoryMessage(message()),true)
 for(const value of [null,[],{}, {...message(),version:2},{...message(),operation:'put'},{...message(),eventId:''},{...message(),senderId:'x'.repeat(129)},{...message(),workId:'x'.repeat(1025)},{...message(),clip:new Blob(['forbidden'])},Object.create(message())]) assert.equal(validHistoryMessage(value),false)
})
test('buses deliver to multiple tabs, suppress self, deduplicate and bound event cache',()=>{
 const n=network(),a=createVideoHistoryBus(n.factory,'a'),b=createVideoHistoryBus(n.factory,'b'),c=createVideoHistoryBus(n.factory,'c');let countA=0,countB=0,countC=0
 const offA=a.subscribe(()=>countA++),offB=b.subscribe(()=>countB++),offC=c.subscribe(()=>countC++)
 a.publish('create','one');assert.deepEqual([countA,countB,countC],[0,1,1])
 const peer=[...n.channels][1]
 peer.onmessage?.({data:message()});peer.onmessage?.({data:message()});assert.equal(countB,2)
 peer.onmessage?.({data:{...message('self'),senderId:'b'}});peer.onmessage?.({data:{bad:true}});assert.equal(countB,2)
 for(let i=0;i<257;i++)peer.onmessage?.({data:message('id-'+i)})
 peer.onmessage?.({data:message()});assert.equal(countB,260,'old event is evicted from bounded cache')
 offA();offB();offC();assert.equal(n.channels.size,0);assert.deepEqual(n.counts(),{opened:3,closed:3})
})
test('publish-only channels close; throwing or unavailable transport does not throw',()=>{
 const n=network(),bus=createVideoHistoryBus(n.factory,'a');bus.publish('update','one');assert.equal(n.channels.size,0)
 assert.equal(n.messages[0].operation,'update')
 for(const factory of [()=>undefined,()=>{throw Error('unavailable')},()=>({onmessage:null,onmessageerror:null,postMessage(){throw Error('send')},close(){}})]) {
  const bus=createVideoHistoryBus(factory,'b');const off=bus.subscribe(()=>{});assert.doesNotThrow(()=>bus.publish('create','one'));off()
 }
})
test('invalid and duplicate notifications do not cause extra database reads; burst merges',async()=>{
 const n=network(),bus=createVideoHistoryBus(n.factory,'local');let reads=0
 const sync=createHistoryRefresh({read:async()=>++reads,onHistory:()=>{},onError:(error:unknown)=>assert.fail(String(error)),subscribe:bus.subscribe,delayMs:0})
 try {
  await until(()=>reads===1)
  const channel=[...n.channels][0]
  channel.onmessage?.({data:{invalid:true}});assert.equal(reads,1)
  for(let i=0;i<10;i++){channel.onmessage?.({data:message('burst'+i)});channel.onmessage?.({data:message('burst'+i)})}
  await until(()=>reads===2);await new Promise(r=>setTimeout(r,5));assert.equal(reads,2)
 } finally {sync.dispose()}
})
test('notification during read invalidates old result and schedules exactly one followup',async()=>{
 const first=deferred<string>();let reads=0,active=0,max=0;const applied:string[]=[]
 let notify=()=>{}
 const sync=createHistoryRefresh({read:async()=>{active++;max=Math.max(max,active);const value=++reads===1?await first.promise:'new';active--;return value},onHistory:v=>applied.push(v),onError:(error:unknown)=>assert.fail(String(error)),subscribe:fn=>{notify=fn;return()=>{}},delayMs:0})
 try {await until(()=>reads===1);notify();notify();first.resolve('old');await until(()=>applied.length===1);assert.deepEqual(applied,['new']);assert.equal(reads,2);assert.equal(max,1)}finally{sync.dispose()}
})
test('failed notification refresh preserves last history and recovers on next request',async()=>{
 let fail=false,errors=0,applied=0;let history:string[]=[];let notify=()=>{}
 const sync=createHistoryRefresh({read:async()=>{if(fail)throw Error('IDB failed');return ['saved']},onHistory:v=>{history=v;applied++},onError:()=>errors++,subscribe:fn=>{notify=fn;return()=>{}},delayMs:0})
 try {await until(()=>applied===1);fail=true;notify();await until(()=>errors===1);assert.deepEqual(history,['saved']);fail=false;notify();await until(()=>applied===2);assert.equal(errors,1);assert.deepEqual(history,['saved'])}finally{sync.dispose()}
})
test('coordinator simulation: resuming after either recording outcome drains pending refresh',async()=>{
 for(const ending of ['normal','exceptional']) {
  let reads=0;const applied:number[]=[]
  const sync=createHistoryRefresh({read:async()=>++reads,onHistory:v=>applied.push(v),onError:(error:unknown)=>assert.fail(String(error)),subscribe:()=>()=>{},delayMs:0})
  try {sync.setPaused(true);sync.request();sync.request();await new Promise(r=>setTimeout(r,5));assert.equal(reads,0,ending);sync.setPaused(false);await until(()=>applied.length===1);assert.equal(reads,1)}finally{sync.dispose()}
 }
})
test('pausing invalidates an in-flight result and resumes with latest history',async()=>{
 const old=deferred<number>();let reads=0;const applied:number[]=[]
 const sync=createHistoryRefresh({read:()=>++reads===1?old.promise:Promise.resolve(2),onHistory:v=>applied.push(v),onError:(error:unknown)=>assert.fail(String(error)),subscribe:()=>()=>{},delayMs:0})
 try{await until(()=>reads===1);sync.setPaused(true);old.resolve(1);await new Promise(r=>setTimeout(r,5));assert.deepEqual(applied,[]);sync.setPaused(false);await until(()=>applied.length===1);assert.deepEqual(applied,[2])}finally{sync.dispose()}
})
test('coordinator simulation: disposal/remount closes channels, discards obsolete results and shares read gate',async()=>{
 const n=network(),bus=createVideoHistoryBus(n.factory,'local'),gate=createHistoryReadGate<number>(),old=deferred<number>();let active=0,max=0,reads=0;const applied:number[]=[]
 const options={read:async()=>{active++;max=Math.max(max,active);const v=++reads===1?await old.promise:2;active--;return v},onHistory:(v:number)=>applied.push(v),onError:(error:unknown)=>assert.fail(String(error)),subscribe:bus.subscribe,delayMs:0,gate}
 const first=createHistoryRefresh(options);await until(()=>reads===1);first.dispose();first.dispose();assert.equal(n.channels.size,0)
 const second=createHistoryRefresh(options)
 try{await new Promise(r=>setTimeout(r,5));assert.equal(reads,1);old.resolve(1);await until(()=>applied.length===1);assert.deepEqual(applied,[2]);assert.equal(max,1)}finally{second.dispose()}
 assert.equal(n.channels.size,0);assert.equal(n.counts().opened,n.counts().closed)
})
test('messageerror requests a safe re-read; close and reopen can receive again',async()=>{
 const n=network(),bus=createVideoHistoryBus(n.factory,'local');let reads=0
 for(let i=0;i<2;i++) {
  const sync=createHistoryRefresh({read:async()=>++reads,onHistory:()=>{},onError:(error:unknown)=>assert.fail(String(error)),subscribe:bus.subscribe,delayMs:0})
  await until(()=>reads===i*2+1);[...n.channels][0].onmessageerror?.();await until(()=>reads===i*2+2);sync.dispose()
 }
 assert.equal(n.channels.size,0)
})
test('coordinator contract and source inspection: history callback preserves editor/preview state',async()=>{
 const editor={brief:{topic:'unsaved'},result:{seed:1},clip:new Blob(['preview']),time:12,playing:true,dirty:true,recording:false};const before=structuredClone(editor)
 let works:string[]=[];let state='loading'
 const sync=createHistoryRefresh({read:async()=>['remote'],onHistory:history=>{works=history;state='success'},onError:(error:unknown)=>assert.fail(String(error)),subscribe:()=>()=>{},delayMs:0})
 try{await until(()=>state==='success');assert.deepEqual(works,['remote']);assert.deepEqual(editor,before)}finally{sync.dispose()}
 // Verify the actual component's integration callbacks have only history setters.
 const source=readFileSync(new URL('../src/VideoWorkshop.tsx',import.meta.url),'utf8')
 const callbacks=source.slice(source.indexOf('onHistory:'),source.indexOf('historySync.current=sync'))
 for(const name of ['setBrief','setResult','setClip','setTime','setPlaying','setDirty','setRecording','restore('])assert.equal(callbacks.includes(name),false)
 assert.match(source,/setPaused\(busy\|\|recording\)/)
 assert.match(source,/removeEventListener\('visibilitychange'/)
 assert.match(source,/removeEventListener\('pageshow'/)
})

test('committed IndexedDB create/update/delete converge in two receiving tabs without payload data',async()=>{
 const n=network(),originalChannel=globalThis.BroadcastChannel,originalDB=globalThis.indexedDB
 globalThis.indexedDB=new IDBFactory()
 globalThis.BroadcastChannel=class {constructor(name:string){return n.factory(name)}} as unknown as typeof BroadcastChannel
 const b=createVideoHistoryBus(n.factory,'tab-b'),c=createVideoHistoryBus(n.factory,'tab-c')
 let historyB:VideoHistoryList|undefined,historyC:VideoHistoryList|undefined
 const syncB=createHistoryRefresh({read:()=>videoHistory('list'),subscribe:b.subscribe,onHistory:v=>{historyB=v},onError:(error:unknown)=>assert.fail(String(error)),delayMs:0})
 const syncC=createHistoryRefresh({read:()=>videoHistory('list'),subscribe:c.subscribe,onHistory:v=>{historyC=v},onError:(error:unknown)=>assert.fail(String(error)),delayMs:0})
 try {
  await until(()=>historyB?.length===0&&historyC?.length===0)
  const v={...generateVideo({...initialVideo,topic:'tab-a',description:'description'}),id:'three-tabs',savedAt:new Date().toISOString(),clip:new Blob([new Uint8Array([0,255,128])],{type:'video/webm'})}
  const first=(await videoHistory('put',v))[0]
  await until(()=>historyB?.length===1&&historyC?.length===1)
  assert.equal(historyB![0].revisionToken,first.revisionToken)
  await videoHistory('update',{id:v.id,brief:{topic:'updated in a'}},videoExpectedVersion(first))
  await until(()=>historyB?.[0]?.revision===2&&historyC?.[0]?.revision===2)
  for(const history of [historyB!,historyC!]){assert.equal(history[0].brief.topic,'updated in a');assert.deepEqual(await history[0].clip!.arrayBuffer(),await v.clip.arrayBuffer())}
  await videoHistory('delete',v.id,videoExpectedVersion(historyB![0]))
  await until(()=>historyB?.length===0&&historyC?.length===0)
  assert.deepEqual(n.messages.map(m=>m.operation),['create','update','delete'])
 }finally{syncB.dispose();syncC.dispose();globalThis.BroadcastChannel=originalChannel;globalThis.indexedDB=originalDB}
 assert.equal(n.channels.size,0)
})
test('local mutation and remote invalidations share ordering even when local operation fails immediately',async()=>{
 const first=deferred<string>();let reads=0;const applied:string[]=[]
 const sync=createHistoryRefresh({read:()=>++reads===1?first.promise:Promise.resolve('latest'),subscribe:()=>()=>{},onHistory:v=>applied.push(v),onError:(error:unknown)=>assert.fail(String(error)),delayMs:0})
 try {
  await until(()=>reads===1);sync.setPaused(true);sync.request()
  // This also models a rejected validation before React commits a busy render.
  sync.request();sync.setPaused(false);first.resolve('stale pre-mutation list')
  await until(()=>applied.length===1);assert.deepEqual(applied,['latest']);assert.equal(reads,2)
 }finally{sync.dispose()}
})

test('a reader queued behind an old mount cannot start while recording is paused',async()=>{
 const gate=createHistoryReadGate<number>(),old=deferred<number>();let firstReads=0,secondReads=0
 const first=createHistoryRefresh({gate,read:()=>{firstReads++;return old.promise},subscribe:()=>()=>{},onHistory:()=>{},onError:(error:unknown)=>assert.fail(String(error)),delayMs:0})
 await until(()=>firstReads===1);first.dispose()
 const second=createHistoryRefresh({gate,read:async()=>++secondReads,subscribe:()=>()=>{},onHistory:()=>{},onError:(error:unknown)=>assert.fail(String(error)),delayMs:0})
 try {
  await new Promise(r=>setTimeout(r,5));second.setPaused(true);old.resolve(1)
  await new Promise(r=>setTimeout(r,5));assert.equal(secondReads,0)
  second.setPaused(false);await until(()=>secondReads===1)
 }finally{second.dispose()}
})

// No browser/React DOM is mounted by this suite. Lifecycle cases above are
// coordinator simulations; actual StrictMode and MediaRecorder remain manual acceptance.
for(const [label,id,expectedId] of [
 ['uuid','123e4567-e89b-42d3-a456-426614174000','123e4567-e89b-42d3-a456-426614174000'],
 ['whitespace',' \t\n','*'],
 ['1024 characters','x'.repeat(1024),'x'.repeat(1024)],
 ['1025 characters','x'.repeat(1025),'*'],
 ['literal star','*','*'],
] as const) test(`ID boundary end-to-end: ${label}, create/update/delete and dedup preserve full history`,async()=>{
 const n=network(),originalDB=globalThis.indexedDB,originalChannel=globalThis.BroadcastChannel
 globalThis.indexedDB=new IDBFactory()
 globalThis.BroadcastChannel=class {constructor(name:string){return n.factory(name)}} as unknown as typeof BroadcastChannel
 const receiver=createVideoHistoryBus(n.factory,'receiver')
 let history:VideoHistoryList|undefined,reads=0
 const sync=createHistoryRefresh({read:()=>videoHistory('list'),subscribe:receiver.subscribe,
  onHistory:next=>{history=next;reads++},onError:(error:unknown)=>assert.fail(String(error)),delayMs:0})
 const makeWork=(key:string,topic:string)=>({...generateVideo({...initialVideo,topic,description:'boundary'}),id:key,savedAt:new Date().toISOString(),clip:new Blob([new Uint8Array([0,255,128]),key],{type:'video/webm'})})
 try {
  await until(()=>history?.length===0)
  const unrelated=(await videoHistory('put',makeWork('unrelated','keep'))).find(w=>w.id==='unrelated')!
  await until(()=>history?.length===1);n.messages.length=0
  const v=makeWork(id,label),first=(await videoHistory('put',v)).find(w=>w.id===id)!
  await until(()=>history?.length===2)
  assert.ok(history!.some(w=>w.id==='unrelated'));assert.ok(history!.some(w=>w.id===id))
  assert.deepEqual(await history!.find(w=>w.id===id)!.clip!.arrayBuffer(),await v.clip.arrayBuffer())
  assert.equal(n.messages[0].workId,expectedId);assert.equal(validHistoryMessage(n.messages[0]),true)
  const delivered=n.messages[0],receiverChannel=[...n.channels][0],beforeReads=reads
  receiverChannel.onmessage?.({data:structuredClone(delivered)})
  receiverChannel.onmessage?.({data:structuredClone(delivered)})
  receiverChannel.onmessage?.({data:{...delivered,eventId:'bad-operation',operation:'clear'}})
  receiverChannel.onmessage?.({data:{...delivered,eventId:'bad-workId',workId:' '}})
  receiverChannel.onmessage?.({data:{...delivered,eventId:'bad-extra',records:[]}})
  await new Promise(r=>setTimeout(r,10));assert.equal(reads,beforeReads)
  await videoHistory('update',{id,brief:{topic:'updated boundary'}},videoExpectedVersion(first))
  await until(()=>history?.find(w=>w.id===id)?.revision===2)
  const updated=history!.find(w=>w.id===id)!
  assert.equal(updated.brief.topic,'updated boundary');assert.notEqual(updated.revisionToken,first.revisionToken)
  assert.deepEqual(await updated.clip!.arrayBuffer(),await v.clip.arrayBuffer())
  const stored=await videoHistory('list');assert.equal(stored.find(w=>w.id===id)!.revisionToken,updated.revisionToken)
  const beforeFailures=n.messages.length
  await assert.rejects(videoHistory('put',v))
  await assert.rejects(videoHistory('update',{id,seed:9},videoExpectedVersion(first)))
  await assert.rejects(videoHistory('delete',id,videoExpectedVersion(first)))
  const originalPut=FakeObjectStore.prototype.put
  FakeObjectStore.prototype.put=function(...args:Parameters<typeof originalPut>){const request=originalPut.apply(this,args);request.addEventListener('success',()=>this.transaction.abort());return request}
  try {await assert.rejects(videoHistory('update',{id,clip:null},videoExpectedVersion(updated)))}
  finally {FakeObjectStore.prototype.put=originalPut}
  assert.equal(n.messages.length,beforeFailures)
  const afterFailures=(await videoHistory('list')).find(w=>w.id===id)!
  assert.deepEqual(afterFailures,updated)
  assert.deepEqual(await afterFailures.clip!.arrayBuffer(),await v.clip.arrayBuffer())
  assert.equal(history!.find(w=>w.id===id)!.revisionToken,updated.revisionToken)
  await videoHistory('delete',id,videoExpectedVersion(updated))
  await until(()=>history?.length===1)
  assert.equal(history!.some(w=>w.id===id),false)
  const final=await videoHistory('list');assert.equal(final.length,1);assert.deepEqual(final[0],unrelated)
  assert.deepEqual(await final[0].clip!.arrayBuffer(),await unrelated.clip!.arrayBuffer())
  assert.deepEqual(n.messages.map(m=>m.operation),['create','update','delete'])
  assert.ok(n.messages.every(m=>m.workId===expectedId&&validHistoryMessage(m)))
  assert.equal(new Set(n.messages.map(m=>m.eventId)).size,3)
 }finally{sync.dispose();globalThis.indexedDB=originalDB;globalThis.BroadcastChannel=originalChannel}
 assert.equal(n.channels.size,0)
})
test('wildcard protocol marker is accepted without accepting malformed or expanded messages',()=>{
 assert.equal(VIDEO_HISTORY_ALL,'*')
 const wildcard={...message(),workId:VIDEO_HISTORY_ALL}
 assert.equal(validHistoryMessage(wildcard),true)
 for(const invalid of [{...wildcard,version:2},{...wildcard,operation:'clear'},{...wildcard,revisionToken:'forbidden'},{...wildcard,workId:''},{...wildcard,workId:'x'.repeat(1025)}])assert.equal(validHistoryMessage(invalid),false)
})
test('default 100ms window uses actual timers and coalesces request bursts',async()=>{
 const started=performance.now(),times:number[]=[]
 const sync=createHistoryRefresh({read:async()=>{times.push(performance.now());return times.length},subscribe:()=>()=>{},onHistory:()=>{},onError:(error:unknown)=>assert.fail(String(error))})
 try {
  sync.request();sync.request()
  await new Promise(r=>setTimeout(r,40));assert.equal(times.length,0);sync.request()
  await until(()=>times.length===1);assert.ok(times[0]-started>=90,'default delay must be approximately 100ms')
  const firstRead=times[0];await new Promise(r=>setTimeout(r,120));assert.equal(times.length,1)
  const next=performance.now();sync.request();sync.request()
  await new Promise(r=>setTimeout(r,40));assert.equal(times.length,1)
  await until(()=>times.length===2);assert.ok(times[1]-next>=90);assert.ok(times[1]>firstRead)
 }finally{sync.dispose()}
})

test('media diagnostic URL switch is off by default, logs snapshots only when explicitly enabled',()=>{
 const originalLocation=Object.getOwnPropertyDescriptor(globalThis,'location'),originalInfo=console.info
 const logs:string[]=[];console.info=(value:unknown)=>{logs.push(String(value))}
 const setSearch=(search:string)=>Object.defineProperty(globalThis,'location',{configurable:true,value:{search}})
 let evaluated=0
 try {
  for(const search of ['', '?debugVideoMedia=0','?debugVideoMedia=true']) {
   setSearch(search);assert.equal(videoMediaDiagnosticsEnabled(),false)
   traceVideoMedia('disabled',()=>{evaluated++;return {value:1}})
  }
  assert.equal(evaluated,0);assert.equal(logs.length,0)
  setSearch('?debugVideoMedia=1');assert.equal(videoMediaDiagnosticsEnabled(),true)
  traceVideoMedia('enabled',()=>{evaluated++;return {nodeId:3,count:2}})
  assert.equal(evaluated,1);assert.equal(logs.length,1)
  const prefix='[InspireStudio:VideoMedia] '
  assert.ok(logs[0].startsWith(prefix));const record=JSON.parse(logs[0].slice(prefix.length))
  assert.equal(record.event,'enabled');assert.equal(record.nodeId,3);assert.equal(record.count,2)
  assert.equal(typeof record.pageId,'string');assert.equal(typeof record.tMs,'number');assert.equal(typeof record.timeOriginMs,'number')
  const object={};assert.equal(videoMediaObjectId(object),videoMediaObjectId(object));assert.notEqual(videoMediaObjectId(object),videoMediaObjectId({}))
  assert.doesNotThrow(()=>traceVideoMedia('bad-details',()=>{throw Error('diagnostic failure')}))
  console.info=()=>{throw Error('console failure')};assert.doesNotThrow(()=>traceVideoMedia('bad-console'))
 }finally{console.info=originalInfo;if(originalLocation)Object.defineProperty(globalThis,'location',originalLocation);else Reflect.deleteProperty(globalThis,'location')}
})
test('diagnostic instrumentation only observes media; source dependency, cleanup and StrictMode remain',()=>{
 const source=readFileSync(new URL('../src/VideoWorkshop.tsx',import.meta.url),'utf8')
 const clip=source.slice(source.indexOf('function Clip('),source.indexOf('export default'))
 for(const operation of [/\.play\(/,/\.pause\(/,/\.load\(/,/\.currentTime\s*=/,/key=/])assert.equal(operation.test(clip),false)
 assert.match(clip,/URL\.createObjectURL\(blob\)/);assert.match(clip,/URL\.revokeObjectURL\(u\)/)
 assert.match(clip,/const instance=useId\(\)/);assert.match(clip,/},\[blob,instance\]\)/)
 for(const event of ['pause','play','playing','waiting','stalled','loadstart','loadedmetadata','emptied','abort','error'])assert.ok(clip.includes("'"+event+"'"))
 assert.match(clip,/if \(!videoMediaDiagnosticsEnabled\(\)\) return/)
 assert.match(clip,/removeEventListener/);assert.match(clip,/observer\.disconnect\(\)/)
 assert.match(readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8'),/<StrictMode>/)
})
test('enabled diagnostics do not change refresh ordering or turn log errors into refresh errors',async()=>{
 const originalLocation=Object.getOwnPropertyDescriptor(globalThis,'location'),originalInfo=console.info
 Object.defineProperty(globalThis,'location',{configurable:true,value:{search:'?debugVideoMedia=1'}})
 const events:string[]=[];console.info=(value:unknown)=>{events.push(JSON.parse(String(value).slice('[InspireStudio:VideoMedia] '.length)).event)}
 let history=0
 const sync=createHistoryRefresh({read:async()=>7,subscribe:()=>()=>{},onHistory:value=>{history=value},onError:(error:unknown)=>assert.fail(String(error)),delayMs:0})
 try{await until(()=>history===7);assert.ok(events.indexOf('history.refresh.start')>=0);assert.ok(events.indexOf('history.refresh.complete')>events.indexOf('history.refresh.start'))}
 finally{sync.dispose();console.info=originalInfo;if(originalLocation)Object.defineProperty(globalThis,'location',originalLocation);else Reflect.deleteProperty(globalThis,'location')}
})
