import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { videoHistory, videoExpectedVersion } from '../src/videoStorage.ts'
import type { HistoryMessage } from '../src/videoHistorySync.ts'
import type { VideoExpectedVersion, VideoWork } from '../src/videoStorage.ts'
import { generateVideo, initialVideo } from '../src/videoService.ts'

const nativeBroadcastChannel=globalThis.BroadcastChannel
let notifications: HistoryMessage[]=[]
beforeEach(async()=>{
 notifications=[]
 globalThis.BroadcastChannel=class {
  onmessage=null;onmessageerror=null
  postMessage(message: HistoryMessage){notifications.push(structuredClone(message))}
  close(){}
 } as unknown as typeof BroadcastChannel
 globalThis.indexedDB = new IDBFactory(); await videoHistory('list')
})
afterEach(()=>{globalThis.BroadcastChannel=nativeBroadcastChannel})

const work = (id: string, label = 'original'): VideoWork => ({...generateVideo({...initialVideo,topic:label,description:'description'}),id,savedAt:new Date().toISOString(),clip:new Blob([new Uint8Array([0,255,128,1]),label,'完整内容'],{type:'video/webm'})})
async function connect() {
 return await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('inspirestudio.video.v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
}
async function raw(id: string, value?: unknown) {
 const db=await connect()
 try {return await new Promise<unknown>((resolve,reject)=>{const tx=db.transaction('works',value?'readwrite':'readonly');const store=tx.objectStore('works');if(value)store.put(value);const r=store.get(id);tx.oncomplete=()=>resolve(r.result);tx.onabort=()=>reject(tx.error)})} finally {db.close()}
}
async function saved(id: string) {return (await videoHistory('list')).find(v=>v.id===id)!}
const version = (v: VideoWork) => ({revision:v.revision!,revisionToken:v.revisionToken!})
// Hold both independently opened connections before transaction creation, then release
// together. This prevents a sequential simulation from passing a race test.
async function race(a: ()=>ReturnType<typeof videoHistory>, b: ()=>ReturnType<typeof videoHistory>) {
 const original= indexedDB.open
 const connections: IDBDatabase[]=[]
 const pending: (()=>void)[]=[]
 indexedDB.open=function(...args: Parameters<IDBFactory['open']>) {
  const r=original.apply(this,args)
  r.addEventListener('success',()=>{
   connections.push(r.result)
   const handler=r.onsuccess
   r.onsuccess=null
   pending.push(()=>handler?.call(r,new Event('success')))
   if(pending.length===2) {assert.notEqual(connections[0],connections[1]);for(const release of pending)release()}
  })
  return r
 }
 try {const results=await Promise.allSettled([a(),b()]);assert.equal(connections.length,2);return results}
 finally {indexedDB.open=original}
}
function oneWinner(results: PromiseSettledResult<unknown>[]) {assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);return results.findIndex(r=>r.status==='fulfilled')}
async function verifyWinner(results: PromiseSettledResult<Awaited<ReturnType<typeof videoHistory>>>[], candidates: VideoWork[], revision: number, oldToken?: string) {
 const winner=oneWinner(results), candidate=candidates[winner]
 const result=await saved(candidate.id)
 assert.ok(result)
 assert.equal(result.brief.topic,candidate.brief.topic)
 assert.deepEqual(result.brief,candidate.brief)
 assert.equal(result.revision,revision)
 assert.ok(result.revisionToken?.trim())
 assert.notEqual(result.revisionToken,oldToken)
 const outcome=results[winner]
 assert.equal(outcome.status,'fulfilled')
 if(outcome.status==='fulfilled') assert.equal(result.revisionToken,outcome.value.find(w=>w.id===candidate.id)!.revisionToken)
 assert.deepEqual(await result.clip!.arrayBuffer(),await candidate.clip!.arrayBuffer())
 return result
}

test('legacy reads preserve original fields and Blob without initializing versions',async()=>{
 const v=work('legacy-read');await videoHistory('list');await raw(v.id,v)
 const result=await saved(v.id);assert.equal('revision' in result,false);assert.equal('revisionToken' in result,false)
 assert.deepEqual(await raw(v.id),v);assert.equal(await result.clip!.text(),await v.clip!.text())
})
test('two independent connections racing first legacy update have one winner',async()=>{
 const v=work('legacy-race');await raw(v.id,v)
 const candidates=[work(v.id,'legacy-a'),work(v.id,'legacy-b')]
 const results=await race(()=>videoHistory('update',candidates[0],{legacy:true}),()=>videoHistory('update',candidates[1],{legacy:true}))
 await verifyWinner(results,candidates,1)
})
test('same revision/token across independent connections permits exactly one update',async()=>{
 const v=work('update-race');await videoHistory('put',v);const old=await saved(v.id)
 const candidates=[work(v.id,'update-a'),work(v.id,'update-b')]
 const results=await race(()=>videoHistory('update',candidates[0],version(old)),()=>videoHistory('update',candidates[1],version(old)))
 await verifyWinner(results,candidates,2,old.revisionToken)
})
test('stale token cannot overwrite; missing or invalid targets cannot update/delete',async()=>{
 const v=work('stale');await videoHistory('put',v);const old=await saved(v.id)
 await videoHistory('update',v,version(old));const before=await raw(v.id)
 await assert.rejects(videoHistory('update',v,version(old)));assert.deepEqual(await raw(v.id),before)
 await assert.rejects(videoHistory('delete',v.id,{revision:2,revisionToken:old.revisionToken!}));assert.deepEqual(await raw(v.id),before)
 await assert.rejects(videoHistory('update',work('missing'),{legacy:true}));await assert.rejects(videoHistory('delete','missing',{legacy:true}))
 // @ts-expect-error Missing expected version must also fail at runtime.
 await assert.rejects(videoHistory('update',{id:v.id}));assert.deepEqual(await raw(v.id),before)
 // @ts-expect-error Missing expected version must also fail at runtime.
 await assert.rejects(videoHistory('delete',v.id));assert.deepEqual(await raw(v.id),before)
})
for(const deleteFirst of [false,true]) test(`conditional delete/update race, delete first: ${deleteFirst}`,async()=>{
 const v=work('delete-race');await videoHistory('put',v);const old=await saved(v.id), replacement=work(v.id,'updated')
 const update=()=>videoHistory('update',replacement,version(old)), remove=()=>videoHistory('delete',v.id,version(old))
 const operations=deleteFirst?[remove,update]:[update,remove]
 const results=await race(operations[0],operations[1])
 const winner=oneWinner(results)
 assert.equal(winner,0,'the first queued readwrite transaction wins')
 if(deleteFirst) assert.equal(await raw(v.id),undefined)
 else {
  const result=await verifyWinner([results[0],results[1]],[replacement,v],2,old.revisionToken)
  await assert.rejects(videoHistory('delete',v.id,version(old)))
  assert.deepEqual(await raw(v.id),result)
 }
})
test('ID collision uses add and preserves original bytes',async()=>{
 const v=work('collision');await videoHistory('put',v);const before=await raw(v.id)
 const candidates=[work('collision-new','create-a'),work('collision-new','create-b')]
 await verifyWinner(await race(()=>videoHistory('put',candidates[0]),()=>videoHistory('put',candidates[1])),candidates,1)
 await assert.rejects(videoHistory('put',{...v,clip:new Blob(['replacement'],{type:'video/webm'})}));assert.deepEqual(await raw(v.id),before)
})
test('malformed version pairs are quarantined and never rewritten or deleted',async()=>{
 const cases=[{revision:1},{revisionToken:'token'},{revision:0,revisionToken:'token'},{revision:-1,revisionToken:'token'},{revision:Infinity,revisionToken:'token'},{revision:1.5,revisionToken:'token'},{revision:NaN,revisionToken:'token'},{revision:Number.MAX_SAFE_INTEGER+1,revisionToken:'token'},{revision:1,revisionToken:''},{revision:1,revisionToken:' '},{revision:undefined,revisionToken:undefined},{revision:1,revisionToken:42}]
 for(const [i,fields] of cases.entries()) {
  const v={...work(`invalid-${i}`),...fields};await raw(v.id,v)
  const list=await videoHistory('list');assert.equal(list.some(w=>w.id===v.id),false);assert.ok(list.diagnostics.quarantinedCount);assert.ok(list.warning)
  await assert.rejects(videoHistory('update',work(v.id),{legacy:true}));await assert.rejects(videoHistory('delete',v.id,{legacy:true}));assert.deepEqual(await raw(v.id),v)
 }
})
test('abort after successful add request never reports success or persists data',async()=>{
 const original=IDBObjectStore.prototype.add
 IDBObjectStore.prototype.add=function(...args: Parameters<IDBObjectStore['add']>) {const r=original.apply(this,args);r.addEventListener('success',()=>this.transaction.abort());return r}
 try {await assert.rejects(videoHistory('put',work('aborted')),/取消|失败/);assert.equal(notifications.length,0)} finally {IDBObjectStore.prototype.add=original}
 assert.equal(await raw('aborted'),undefined)
})
test('independent connections creating different IDs retain both records and Blob bytes',async()=>{
 const a=work('parallel-a','parallel-a'),b=work('parallel-b','parallel-b')
 const result=await race(()=>videoHistory('put',a),()=>videoHistory('put',b));assert.ok(result.every(r=>r.status==='fulfilled'))
 for(const v of [a,b]) {const result=await saved(v.id);assert.equal(result.revision,1);assert.ok(result.revisionToken);assert.deepEqual(await result.clip!.arrayBuffer(),await v.clip!.arrayBuffer())}
 assert.notEqual((await saved(a.id)).revisionToken,(await saved(b.id)).revisionToken)
})
test('legacy delete is conditional; overflow and invalid expected versions preserve data',async()=>{
 const v=work('legacy-delete');await raw(v.id,v);await videoHistory('delete',v.id,{legacy:true});assert.equal(await raw(v.id),undefined)
 const max={...work('max'),revision:Number.MAX_SAFE_INTEGER,revisionToken:'max'};await raw(max.id,max)
 await assert.rejects(videoHistory('update',max,version(max)));assert.deepEqual(await raw(max.id),max)
 await assert.rejects(videoHistory('delete',max.id,{revision:NaN,revisionToken:'max'} as VideoExpectedVersion));assert.deepEqual(await raw(max.id),max)
})

test('abort after update or delete request rolls back and rejects',async()=>{
 const v=work('abort-mutations');await videoHistory('put',v);const old=await saved(v.id)
 for(const action of ['update','delete'] as const) {
  const method=action==='update'?'put':'delete'
  const original=IDBObjectStore.prototype[method]
  // Instrument only the mutation request, leaving the real transaction intact.
  Object.defineProperty(IDBObjectStore.prototype,method,{configurable:true,writable:true,value:function(this: IDBObjectStore,...args: unknown[]) {
   const r=Reflect.apply(original,this,args) as IDBRequest
   r.addEventListener('success',()=>this.transaction.abort());return r
  }})
  const noticeCount=notifications.length
  try {await assert.rejects(action==='update'?videoHistory('update',v,version(old)):videoHistory('delete',v.id,version(old)))}
  finally {Object.defineProperty(IDBObjectStore.prototype,method,{configurable:true,writable:true,value:original})}
  assert.equal(notifications.length,noticeCount)
  assert.deepEqual(await raw(v.id),old)
  assert.deepEqual(await (await saved(v.id)).clip!.arrayBuffer(),await old.clip!.arrayBuffer())
 }
})

test('omitted or undefined clip preserves all bytes and metadata; null explicitly clears',async()=>{
 const v=work('merge');await videoHistory('put',v);let old=await saved(v.id)
 for(const patch of [{id:v.id,brief:{...v.brief,topic:'edited'}},{id:v.id,clip:undefined}]) {
  await videoHistory('update',patch,version(old));const next=await saved(v.id)
  assert.deepEqual(await next.clip!.arrayBuffer(),await v.clip!.arrayBuffer())
  assert.equal(next.savedAt,v.savedAt);assert.equal(next.seed,v.seed);assert.equal(next.source,v.source)
  assert.equal(next.revision,old.revision!+1);assert.notEqual(next.revisionToken,old.revisionToken);old=next
 }
 await videoHistory('update',{id:v.id,clip:null},version(old));const cleared=await saved(v.id)
 assert.equal('clip' in cleared,false);assert.equal(cleared.revision,old.revision!+1)
 assert.notEqual(cleared.revisionToken,old.revisionToken);assert.deepEqual(cleared.brief,old.brief)
})
test('unprovided extension fields survive updates and invalid merged data rolls back',async()=>{
 const v={...work('optional'),extension:{note:'preserve',bytes:new Uint8Array([0,255])}}
 await raw(v.id,v)
 await videoHistory('update',{id:v.id},{legacy:true});const old=await saved(v.id)
 assert.deepEqual((await raw(v.id) as typeof v).extension,v.extension)
 await videoHistory('update',{id:v.id,brief:undefined},version(old));const current=await saved(v.id)
 assert.equal(current.savedAt,v.savedAt);assert.deepEqual(current.brief,v.brief)
 assert.deepEqual((await raw(v.id) as typeof v).extension,v.extension)
 await assert.rejects(videoHistory('update',{id:v.id,seed:NaN},version(current)))
 assert.deepEqual(await raw(v.id),{...current,extension:v.extension})
})
test('delete uses listed legacy/versioned snapshots and rejects stale snapshot',async()=>{
 const v=work('snapshot');await raw(v.id,v);const legacySnapshot=await saved(v.id)
 await videoHistory('update',{id:v.id},{legacy:true});const snapshot=await saved(v.id)
 await assert.rejects(videoHistory('delete',v.id,videoExpectedVersion(legacySnapshot)))
 await videoHistory('update',{id:v.id,brief:{...v.brief,topic:'new'}},videoExpectedVersion(snapshot))
 const before=await raw(v.id)
 await assert.rejects(videoHistory('delete',v.id,videoExpectedVersion(snapshot)));assert.deepEqual(await raw(v.id),before)
 await videoHistory('delete',v.id,videoExpectedVersion(await saved(v.id)));assert.equal(await raw(v.id),undefined)
 const other=work('legacy-snapshot');await raw(other.id,other)
 await videoHistory('delete',other.id,videoExpectedVersion(await saved(other.id)));assert.equal(await raw(other.id),undefined)
})
// Compile-only assertions: these calls must remain rejected by the overloads.
function storageTypeContract(v: VideoWork) {
 // @ts-expect-error savedAt is managed by storage
 void videoHistory('update',{id:v.id,savedAt:v.savedAt},{legacy:true})
 // @ts-expect-error revision is managed by storage
 void videoHistory('update',{id:v.id,revision:7},{legacy:true})
 // @ts-expect-error revisionToken is managed by storage
 void videoHistory('update',{id:v.id,revisionToken:'injected'},{legacy:true})
 // @ts-expect-error createdAt is not an editable business field
 void videoHistory('update',{id:v.id,createdAt:'injected'},{legacy:true})
 // @ts-expect-error arbitrary extensions are not editable
 void videoHistory('update',{id:v.id,extension:'injected'},{legacy:true})
 // @ts-expect-error update requires expected version
 void videoHistory('update',{id:v.id})
 // @ts-expect-error delete requires expected version
 void videoHistory('delete',v.id)
 // @ts-expect-error list cannot mutate or accept a version
 void videoHistory('list',v,{legacy:true})
}
void storageTypeContract

// Each case receives a fresh IDBFactory from beforeEach, including these metadata cases.
for(const [field,injected] of Object.entries({savedAt:'2099-01-01T00:00:00Z',revision:999,revisionToken:'injected',createdAt:'replacement',extension:{changed:true}})) {
 test(`metadata injection preserves stored ${field}`,async()=>{
  const v={...work('metadata'),createdAt:'2020-01-01T00:00:00Z',extension:{bytes:new Uint8Array([0,255]),nested:{note:'keep'}}}
  await raw(v.id,v)
  const patch={id:v.id,[field]:injected,brief:{topic:'allowed change'}}
  await videoHistory('update',patch,{legacy:true})
  const result=await raw(v.id) as typeof v & {revision:number;revisionToken:string}
  assert.equal(result.id,v.id);assert.equal(result.savedAt,v.savedAt)
  assert.equal(result.createdAt,v.createdAt);assert.deepEqual(result.extension,v.extension)
  assert.equal(result.revision,1);assert.ok(result.revisionToken);assert.notEqual(result.revisionToken,'injected')
  assert.equal(result.brief.topic,'allowed change')
  assert.deepEqual(await result.clip!.arrayBuffer(),await v.clip!.arrayBuffer())
  // Repeat against a versioned record to check increment rather than caller revision.
  await videoHistory('update',patch,version(result));const next=await saved(v.id)
  assert.equal(next.revision,2);assert.notEqual(next.revisionToken,result.revisionToken)
  assert.notEqual(next.revisionToken,'injected');assert.equal(next.savedAt,v.savedAt)
  assert.equal((await raw(v.id) as typeof v).createdAt,v.createdAt)
  assert.deepEqual((await raw(v.id) as typeof v).extension,v.extension)
 })
}
test('id is a selector, cannot rename a record or overwrite a different target using old token',async()=>{
 const v=work('original-id');await videoHistory('put',v);const original=await saved(v.id)
 await assert.rejects(videoHistory('update',{...original,id:'renamed'},version(original)))
 assert.equal(await raw('renamed'),undefined);assert.deepEqual(await raw(v.id),original)
 const other=work('other-id');await videoHistory('put',other);const beforeOther=await saved(other.id)
 await assert.rejects(videoHistory('update',{...original,id:other.id},version(original)))
 assert.deepEqual(await raw(other.id),beforeOther);assert.deepEqual(await raw(v.id),original)
 assert.deepEqual(await (await saved(v.id)).clip!.arrayBuffer(),await v.clip!.arrayBuffer())
})
test('unknown fields cannot be injected at top level or inside brief; legal fields update',async()=>{
 const v={...work('whitelist'),brief:{...work('unused').brief,legacyBrief:{bytes:new Uint8Array([0,128,255])}},extension:{keep:true}}
 await raw(v.id,v)
 const patch={id:v.id,savedAt:'2099-01-01',createdAt:'injected',newExtension:'injected',extension:null,
  seed:123,source:'demo' as const,brief:{topic:'new topic',description:'new description',style:'温暖叙事',ratio:'9:16',duration:30,legacyBrief:'overwrite',newField:'inject'}}
 await videoHistory('update',patch,{legacy:true});const result=await raw(v.id) as typeof v
 assert.equal(result.savedAt,v.savedAt);assert.equal('createdAt' in result,false);assert.equal('newExtension' in result,false)
 assert.deepEqual(result.extension,v.extension);assert.deepEqual(result.brief.legacyBrief,v.brief.legacyBrief)
 assert.equal('newField' in result.brief,false)
 assert.deepEqual({...result.brief,legacyBrief:undefined},{topic:'new topic',description:'new description',style:'温暖叙事',ratio:'9:16',duration:30,legacyBrief:undefined})
 assert.equal(result.seed,123);assert.equal(result.source,'demo')
 assert.deepEqual(await result.clip!.arrayBuffer(),await v.clip!.arrayBuffer())
})
test('replacement Blob preserves metadata and invalid business updates preserve full original',async()=>{
 const v={...work('replacement'),createdAt:'old',extension:{array:[1,2,3]}};await raw(v.id,v)
 const clip=new Blob([new Uint8Array([255,0,128,9])],{type:'video/webm'})
 await videoHistory('update',{id:v.id,clip},{legacy:true});const current=await saved(v.id)
 assert.deepEqual(await current.clip!.arrayBuffer(),await clip.arrayBuffer())
 assert.equal(current.clip!.type,clip.type);assert.equal(current.savedAt,v.savedAt)
 const before=await raw(v.id)
 await assert.rejects(videoHistory('update',{id:v.id,seed:NaN,clip:null},version(current)))
 assert.deepEqual(await raw(v.id),before)
 assert.deepEqual(await (await saved(v.id)).clip!.arrayBuffer(),await clip.arrayBuffer())
})
test('aborted whitelisted update preserves metadata, extensions and original media',async()=>{
 const v={...work('abort-metadata'),createdAt:'old',extension:{bytes:new Uint8Array([0,255])}};await raw(v.id,v)
 const original=IDBObjectStore.prototype.put
 IDBObjectStore.prototype.put=function(...args: Parameters<IDBObjectStore['put']>) {const request=original.apply(this,args);request.addEventListener('success',()=>this.transaction.abort());return request}
 try {await assert.rejects(videoHistory('update',{id:v.id,clip:null,brief:{topic:'not committed'}},{legacy:true}))}
 finally {IDBObjectStore.prototype.put=original}
 assert.deepEqual(await raw(v.id),v)
 assert.deepEqual(await (await saved(v.id)).clip!.arrayBuffer(),await v.clip!.arrayBuffer())
})

test('create/update/delete notify only after complete, list never notifies, payload has only protocol fields',async()=>{
 const original=IDBDatabase.prototype.transaction
 let completed=false
 IDBDatabase.prototype.transaction=function(...args: Parameters<IDBDatabase['transaction']>){
  const tx=original.apply(this,args);if(args[1]==='readwrite'){completed=false;tx.addEventListener('complete',()=>{completed=true})}return tx
 }
 const Channel=globalThis.BroadcastChannel
 globalThis.BroadcastChannel=class {onmessage=null;onmessageerror=null;close(){};postMessage(message: HistoryMessage){assert.equal(completed,true);notifications.push(message)}} as unknown as typeof BroadcastChannel
 try {
  const v=work('notify');await videoHistory('put',v);assert.equal(notifications.length,1)
  const first=await saved(v.id);assert.equal(notifications.length,1)
  await videoHistory('update',{id:v.id,brief:{topic:'updated'}},version(first));assert.equal(notifications.length,2)
  await videoHistory('delete',v.id,version(await saved(v.id)));assert.equal(notifications.length,3)
  assert.deepEqual(notifications.map(m=>m.operation),['create','update','delete'])
  assert.equal(new Set(notifications.map(m=>m.eventId)).size,3)
  for(const event of notifications){assert.equal(event.workId,v.id);assert.deepEqual(Object.keys(event).sort(),['eventId','operation','protocol','senderId','version','workId']);assert.equal(event.version,1);assert.equal(event.protocol,'inspirestudio.video.history')}
 }finally{IDBDatabase.prototype.transaction=original;globalThis.BroadcastChannel=Channel}
})
test('conflicts, missing records, invalid writes and ID collisions never notify',async()=>{
 const v=work('failed-notify');await videoHistory('put',v);const first=await saved(v.id)
 await videoHistory('update',{id:v.id,seed:2},version(first));const count=notifications.length
 await assert.rejects(videoHistory('update',{id:v.id,seed:3},version(first)))
 await assert.rejects(videoHistory('delete',v.id,version(first)))
 await assert.rejects(videoHistory('put',v))
 await assert.rejects(videoHistory('update',{id:v.id,seed:NaN},version(await saved(v.id))))
 await assert.rejects(videoHistory('delete','missing',{legacy:true}))
 await assert.rejects(videoHistory('put',{...v,id:''}))
 assert.equal(notifications.length,count);assert.equal((await saved(v.id)).seed,2)
})
test('absent, constructor-failing or send-failing channel never fails committed storage',async()=>{
 for(const mode of ['absent','construct','send']) {
  globalThis.BroadcastChannel=(mode==='absent'?undefined:class {
   onmessage=null;onmessageerror=null
   constructor(){if(mode==='construct')throw Error('unsupported')}
   postMessage(){throw Error('notification failed')}
   close(){}
  }) as unknown as typeof BroadcastChannel
  const v=work('fallback-'+mode);await videoHistory('put',v);const first=await saved(v.id)
  await videoHistory('update',{id:v.id,seed:5},version(first));const updated=await saved(v.id);assert.equal(updated.seed,5)
  await videoHistory('delete',v.id,version(updated));assert.equal(await raw(v.id),undefined)
 }
})
