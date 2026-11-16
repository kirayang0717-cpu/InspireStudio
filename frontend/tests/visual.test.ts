import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateVisual, initialVisual, visualSvg } from '../src/visualService.ts'
import { readVisualWorks, writeVisualWorks, visualKey } from '../src/visualStorage.ts'
const brief = { ...initialVisual, topic: '<script>&测试', description: '窗边的书与绿植' }
function storage() { const map = new Map(); return { map, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v) } } }
test('requires topic and description', async () => { await assert.rejects(generateVisual(initialVisual)); await assert.rejects(generateVisual({ ...brief, description: '  ' })) })
test('demo snapshot, XML escaping and all canvas ratios', async () => {
  for (const [ratio, dimensions] of [['1:1', 'width="720" height="720"'], ['16:9', 'width="960" height="540"'], ['9:16', 'width="540" height="960"']]) {
    const result = await generateVisual({ ...brief, ratio }); assert.equal(result.source, 'demo'); assert.match(visualSvg(result), /非 AI 生成/); assert.ok(visualSvg(result).includes(dimensions)); assert.ok(visualSvg(result).includes('&lt;script&gt;&amp;')); assert.equal(result.brief.description, brief.description)
  }
})
test('save, fresh read, versions, restore metadata and delete; writing key untouched', async () => {
  const s = storage(); s.setItem('inspirestudio.writing.v1', 'protected')
  const work = { ...await generateVisual(brief), id: 'one', savedAt: new Date().toISOString() }
  writeVisualWorks(s, [work]); assert.deepEqual(readVisualWorks(s).works, [work])
  const next = { ...work, id: 'two', brief: { ...brief, topic: '第二版' } }; writeVisualWorks(s, [next, work]); assert.equal(readVisualWorks(s).works[1].brief.topic, brief.topic)
  writeVisualWorks(s, [work]); assert.equal(readVisualWorks(s).works.length, 1); assert.equal(s.getItem('inspirestudio.writing.v1'), 'protected')
})
test('corrupted storage is preserved and backed up before save', () => {
  const s = storage(); s.setItem(visualKey, '{broken'); assert.ok(readVisualWorks(s).error); assert.equal(s.getItem(visualKey), '{broken'); writeVisualWorks(s, []); assert.ok([...s.map.values()].includes('{broken'))
})
test('storage failures propagate for UI error handling', () => {
  assert.throws(() => writeVisualWorks({ getItem: () => null, setItem: () => { throw Error('quota') } }, []))
})
