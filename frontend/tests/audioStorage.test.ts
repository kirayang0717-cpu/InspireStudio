import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { audioHistory, initialAudio } from '../src/audioStorage.ts'
import type { AudioWork } from '../src/audioStorage.ts'
import { encodeWav } from '../src/audioService.ts'
test('IndexedDB saves and restores text settings and audio bytes across connections', async () => {
  const blob = encodeWav({ sampleRate: 8000, channels: [new Float32Array(8000)] }, 0, 1, 1)
  for (const mode of ['tts','asr','edit'] as const) {
    const work: AudioWork = { ...initialAudio, mode, id: mode, savedAt: new Date().toISOString(), text: '测试文字', name: 'test.wav', input: mode === 'tts' ? undefined : blob, output: mode === 'edit' ? blob : undefined, rate: 1.25, end: 1 }
    await audioHistory('put', work)
    const restored = (await audioHistory('list')).find(w => w.id === mode)!
    assert.equal(restored.text, work.text); assert.equal(restored.rate, 1.25); assert.equal(restored.mode, mode)
    if (restored.input) assert.deepEqual(await restored.input.arrayBuffer(), await blob.arrayBuffer())
    if (restored.output) assert.deepEqual(await restored.output.arrayBuffer(), await blob.arrayBuffer())
  }
  assert.equal((await audioHistory('list')).length, 3)
  await audioHistory('delete', 'asr'); assert.equal((await audioHistory('list')).length, 2)
  for (const id of ['tts','edit']) await audioHistory('delete', id)
  assert.equal((await audioHistory('list')).length, 0)
})
test('unavailable storage rejects without reporting success', async () => {
  const original = globalThis.indexedDB
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined })
  try { await assert.rejects(audioHistory('list')) } finally { Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: original }) }
})
