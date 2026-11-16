import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { audioHistory, initialAudio } from '../src/audioStorage.ts'
import { videoHistory } from '../src/videoStorage.ts'
import { generateVideo, initialVideo } from '../src/videoService.ts'
async function raw(name:string, value:unknown) {
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name,1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
 try {await new Promise<void>((resolve,reject)=>{const tx=db.transaction('works','readwrite');tx.objectStore('works').put(value);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})} finally{db.close()}
}
test('malformed audio/video records are hidden without deleting raw data; invalid writes reject and valid history remains usable',async()=>{
 const savedAt=new Date().toISOString()
 await audioHistory('put',{...initialAudio,id:'good',savedAt})
 await videoHistory('put',{...generateVideo({...initialVideo,topic:'主题',description:'描述'}),id:'good',savedAt})
 for(const [name,history] of [['audio',audioHistory],['video',videoHistory]] as const){
 await raw('inspirestudio.'+name+'.v1',{id:'bad',savedAt:42})
 await raw('inspirestudio.'+name+'.v1',{id:'incomplete',savedAt})
 const works=await history('list');assert.equal(works.length,1);assert.ok(works.warning)
 if(name==='video') await assert.rejects(videoHistory('put',{id:'invalid'} as never))
 else await assert.rejects(audioHistory('put',{id:'invalid'} as never))
 assert.equal((await history('list')).length,1)
 if(name==='video') await videoHistory('delete','good',works[0] as {revision:number;revisionToken:string})
 else await audioHistory('delete','good');assert.equal((await history('list')).length,0);assert.ok((await history('list')).warning)
 }
})
