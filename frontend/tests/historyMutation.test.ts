import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeHistory, mutateHistory } from '../src/historyMutation.ts'
test('stale saves preserve other tab versions and stale deletes never resurrect records', () => {
 const a={id:'a'},b={id:'b'},c={id:'c'}
 assert.deepEqual(mergeHistory([a],[],[b],20),[b,a])
 assert.deepEqual(mergeHistory([b],[a,b],[c,a,b],20),[c,b])
 assert.deepEqual(mergeHistory([c,a,b],[a,b],[b],20),[c,b])
})
test('concurrent writers serialize read/merge/write under a shared lock; write failure propagates',async()=>{
 let queue=Promise.resolve();let items:{id:string}[]=[]
 const locks={request: (_key:string,run:()=>unknown) => {const result=queue.then(run);queue=result.then(()=>{},()=>{});return result}} as unknown as Pick<LockManager,'request'>
 const save=(id:string)=>mutateHistory('key',[],[{id}],20,()=>items,v=>{items=v},locks)
 await Promise.all([save('a'),save('b')]);assert.deepEqual(items,[{id:'b'},{id:'a'}])
 await assert.rejects(mutateHistory('key',[],[{id:'c'}],20,()=>items,()=>{throw Error('quota')},locks),/quota/)
 assert.equal(items.length,2)
})
