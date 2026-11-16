import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installLeaveGuard, allowRouteChange } from '../src/leaveGuard.ts'
test('dirty navigation cancellation retains route; confirm permits navigation; refresh prompts only while dirty', () => {
 const target = new EventTarget() as EventTarget & Record<string, any>
 let dirty=true, allow=false
 target.location={hash:'#/workshops/video',pathname:'/',search:''}
 target.history={replaceState: (_a:unknown,_b:unknown,url:string)=>{target.location.hash=url.slice(url.indexOf('#'))}}
 target.confirm=()=>allow
 const clean=installLeaveGuard(target as unknown as Window,()=>dirty)
 let navigated=0;target.addEventListener('hashchange',()=>navigated++)
 target.location.hash='#/';target.dispatchEvent(new Event('hashchange'))
 assert.equal(target.location.hash,'#/workshops/video');assert.equal(navigated,0)
 const refresh=new Event('beforeunload',{cancelable:true});target.dispatchEvent(refresh);assert.equal(refresh.defaultPrevented,true)
 allow=true;target.location.hash='#/';target.dispatchEvent(new Event('hashchange'));assert.equal(navigated,1)
 dirty=false;const saved=new Event('beforeunload',{cancelable:true});target.dispatchEvent(saved);assert.equal(saved.defaultPrevented,false)
 clean()
})

test('router registered before workshop still checks guard before unloading editor', () => {
 const target = new EventTarget() as EventTarget & Record<string, any>
 target.location={hash:'#/workshops/visual',pathname:'/',search:''}
 target.history={replaceState: (_a:unknown,_b:unknown,url:string)=>{target.location.hash=url.slice(url.indexOf('#'))}}
 target.confirm=()=>false
 let navigated=false
 target.addEventListener('hashchange',event=>{if(!allowRouteChange()){event.stopImmediatePropagation();return}navigated=true})
 const cleanup=installLeaveGuard(target as unknown as Window,()=>true)
 target.location.hash='#/';target.dispatchEvent(new Event('hashchange'))
 assert.equal(navigated,false);assert.equal(target.location.hash,'#/workshops/visual')
 cleanup()
})
