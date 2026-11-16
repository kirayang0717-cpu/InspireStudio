import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { videoHistory, videoValidationReasons } from '../src/videoStorage.ts'
import { readVideoHistory, historyHeading } from '../src/videoHistoryState.ts'
import { generateVideo, initialVideo } from '../src/videoService.ts'
async function database() {
 return await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('inspirestudio.video.v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
}
async function rawRecords() {
 const db=await database()
 try {return await new Promise<unknown[]>((resolve,reject)=>{const tx=db.transaction('works','readonly');const r=tx.objectStore('works').getAll();tx.oncomplete=()=>resolve(r.result);tx.onabort=()=>reject(tx.error)})} finally {db.close()}
}
test('history distinguishes loading, empty, records, isolated-only and read errors; raw records and Blob bytes survive reads',async()=>{
 assert.equal(historyHeading({status:'loading'}),'读取中…')
 const empty=await readVideoHistory(()=>videoHistory('list'))
 assert.equal(empty.status,'success-empty');assert.equal(historyHeading(empty),'0')
 const good={...generateVideo({...initialVideo,topic:'主题',description:'描述'}),id:'good',savedAt:'2026-11-16T00:00:00Z',clip:new Blob(['original'],{type:'video/webm'})}
 await videoHistory('put',good)
 const bad={id:'bad',savedAt:42,clip:new Blob(['bad bytes'],{type:'text/plain'})}
 const db=await database()
 await new Promise<void>((resolve,reject)=>{const tx=db.transaction('works','readwrite');tx.objectStore('works').put(bad);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error)})
 db.close()
 const before=await rawRecords()
 for(let i=0;i<2;i++) {
 const state=await readVideoHistory(()=>videoHistory('list'))
 assert.equal(state.status,'success-with-records')
 assert.ok('history' in state)
 assert.deepEqual(state.history.diagnostics,{rawCount:2,validCount:1,quarantinedCount:1,failures:[{index:0,reasons:videoValidationReasons(bad)}]})
 assert.ok(state.history.diagnostics.failures[0].reasons.includes('id 或 savedAt 无效'))
 assert.ok(state.history.warning)
 assert.equal(await state.history[0].clip!.text(),'original')
 }
 assert.deepEqual(await rawRecords(),before)
 await videoHistory('delete','good')
 const isolated=await readVideoHistory(()=>videoHistory('list'))
 assert.equal(isolated.status,'success-empty');assert.ok('history' in isolated);assert.equal(isolated.history.diagnostics.rawCount,1)
 await videoHistory('delete','bad')
})
test('open failure and transaction abort are read-error, never successful empty history',async()=>{
 const original=indexedDB.open
 indexedDB.open=()=>{throw Error('模拟存储不可用')}
 try {const state=await readVideoHistory(()=>videoHistory('list'));assert.equal(state.status,'read-error');assert.equal(historyHeading(state),'读取失败')} finally {indexedDB.open=original}
 const transaction=IDBDatabase.prototype.transaction
 IDBDatabase.prototype.transaction=function(...args: Parameters<IDBDatabase['transaction']>) {
 const tx=transaction.apply(this,args)
 const getAll=IDBObjectStore.prototype.getAll
 tx.objectStore('works').getAll=function(...params: Parameters<IDBObjectStore['getAll']>) { const request=getAll.apply(this,params);queueMicrotask(()=>tx.abort());return request }
 return tx
 }
 try {const state=await readVideoHistory(()=>videoHistory('list'));assert.equal(state.status,'read-error');assert.ok('message' in state);assert.match(state.message,/读取失败|事务已取消/)} finally {IDBDatabase.prototype.transaction=transaction}
 const recovered=await readVideoHistory(()=>videoHistory('list'));assert.equal(recovered.status,'success-empty')
})
