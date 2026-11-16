import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateVideo, initialVideo, dimensions, timeline } from '../src/videoService.ts'
test('validates required input and supported specifications', () => {
 assert.throws(() => generateVideo(initialVideo)); assert.throws(() => generateVideo({...initialVideo,topic:'a',description:'b',duration:10}))
 for(const ratio of ['16:9','9:16','1:1']) for(const duration of [15,30,60]) {const r=generateVideo({...initialVideo,topic:'主题',description:'描述',ratio,duration}); assert.equal(r.source,'demo'); assert.equal(r.brief.duration,duration)}
})
test('dimensions and timeline honor ratio duration scenes and boundaries', () => {
 assert.deepEqual(dimensions('16:9'),[960,540]); assert.deepEqual(dimensions('9:16'),[540,960]); assert.deepEqual(dimensions('1:1'),[720,720])
 const r=generateVideo({...initialVideo,topic:'a',description:'b',duration:30}); assert.equal(timeline(r,10).scene,1); assert.equal(timeline(r,30).progress,1); assert.equal(timeline(r,99).seconds,30); assert.equal(timeline(r,-2).seconds,0)
})
test('result keeps generation settings as independent snapshot', () => { const b={...initialVideo,topic:'原始',description:'描述'};const r=generateVideo(b);b.topic='修改';assert.equal(r.brief.topic,'原始') })
