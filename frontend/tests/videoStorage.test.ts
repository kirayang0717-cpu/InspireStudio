import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { videoHistory } from '../src/videoStorage.ts'
import { generateVideo, initialVideo } from '../src/videoService.ts'
test('video versions retain settings and clip bytes across connections, restore and delete',async()=>{
 const r=generateVideo({...initialVideo,topic:'视频一',description:'描述',duration:60,ratio:'9:16'})
 const clip=new Blob(['webm-test-bytes'],{type:'video/webm'})
 await videoHistory('put',{...r,id:'one',savedAt:new Date().toISOString(),clip})
 await videoHistory('put',{...r,brief:{...r.brief,topic:'第二版'},id:'two',savedAt:new Date().toISOString()})
 const all=await videoHistory('list');assert.equal(all.length,2);const restored=all.find(w=>w.id==='one')!;assert.deepEqual(restored.brief,r.brief);assert.equal(await restored.clip!.text(),'webm-test-bytes')
 await videoHistory('delete','two', (await videoHistory('list')).find(w=>w.id==='two') as {revision:number;revisionToken:string});assert.equal((await videoHistory('list')).length,1);await videoHistory('delete','one', restored as {revision:number;revisionToken:string});assert.equal((await videoHistory('list')).length,0)
})
