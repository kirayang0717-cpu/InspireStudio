import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkFile, encodeWav, demoTranscript } from '../src/audioService.ts'
const pcm = { sampleRate: 8000, channels: [Float32Array.from({ length: 8000 }, () => .5)] }
test('file validation rejects empty oversized and non audio files', () => {
  for (const f of [{ name: 'a.txt', size: 10 }, { name: 'a.wav', size: 0 }, { name: 'a.mp3', size: 21 * 1024 * 1024 }]) assert.throws(() => checkFile(f))
  checkFile({ name: 'a.WAV', size: 100 })
})
test('WAV crop duration, gain, header and actual sample values', async () => {
  const v = new DataView(await encodeWav(pcm, .25, .75, .5).arrayBuffer())
  assert.equal(v.byteLength, 44 + 4000 * 2); assert.equal(v.getUint32(24, true), 8000); assert.equal(v.getInt16(44, true), 8192); assert.equal(v.getUint16(22, true), 1)
})
test('stereo interleaving and clipping', async () => {
  const v = new DataView(await encodeWav({ ...pcm, channels: [pcm.channels[0], Float32Array.from({ length: 8000 }, () => -1)] }, 0, 1, 2).arrayBuffer())
  assert.equal(v.getUint16(22, true), 2); assert.equal(v.getInt16(44, true), 32767); assert.equal(v.getInt16(46, true), -32768)
})
test('invalid ranges and nonfinite parameters rejected', () => {
  for (const [s,e,g] of [[-1,1,1],[0,0,1],[0,2,1],[0,1,NaN],[0,1,3]]) assert.throws(() => encodeWav(pcm,s,e,g))
})
test('transcript demo never claims recognition', () => assert.match(demoTranscript, /非语音识别结果/))
