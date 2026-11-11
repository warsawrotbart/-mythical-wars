'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');

class FakeEl{
 constructor(id,cls='',tagName='DIV'){
  this.id=id;this.tagName=tagName;this.children=[];this.parentNode=null;this.listeners={};this.attrs={};
  this.classes=new Set(cls.split(' ').filter(Boolean));
  this.classList={contains:x=>this.classes.has(x),toggle:(x,on)=>{if(on)this.classes.add(x);else this.classes.delete(x);}};
  this.vars={};this.style={setProperty:(k,v)=>{this.vars[k]=v}};
  this.clientWidth=820;
 }
 appendChild(el){el.parentNode=this;this.children.push(el);return el;}
 insertAdjacentElement(where,el){assert.equal(where,'afterend');const ix=this.parentNode.children.indexOf(this);el.parentNode=this.parentNode;this.parentNode.children.splice(ix+1,0,el);}
 getBoundingClientRect(){return {width:116,height:136,x:0,y:0}}
 addEventListener(name,cb){this.listeners[name]=cb}
 setAttribute(name,value){this.attrs[name]=value}
 querySelector(selector){if(selector==='.battle-quick-actions')return this.quickActions;return null}
}
function setup(){
 const workspace=new FakeEl('battleWorkspace');
 const actions=new FakeEl('actions');workspace.quickActions=actions;
 const art=actions.appendChild(new FakeEl('battleArtToggle'));
 const player=new FakeEl('myHand');
 const enemy=new FakeEl('botHand');
 for(let i=0;i<5;i++)player.appendChild(new FakeEl('', 'battle-card hand'));
 for(let i=0;i<4;i++)enemy.appendChild(new FakeEl('', '', 'SPAN'));
 const map={battleWorkspace:workspace,battleArtToggle:art,myHand:player,botHand:enemy};
 const stored={};const registry=[];
 const doc={readyState:'complete',querySelector:()=>null,getElementById:id=>map[id]||null,
  createElement:tag=>{const el=new FakeEl('', '', tag.toUpperCase());Object.defineProperty(el,'id',{get(){return this._id},set(v){this._id=v;map[v]=this}});return el;},
  addEventListener:()=>{throw new Error('must initialize immediately')}
 };
 class MutationObserver{constructor(fn){registry.push(fn)}observe(){} }
 class ResizeObserver{constructor(fn){registry.push(fn)}observe(){} }
 const win={document:doc,MutationObserver,ResizeObserver,
  localStorage:{getItem:k=>stored[k]||null,setItem:(k,v)=>stored[k]=v},
  requestAnimationFrame:fn=>fn(),addEventListener:()=>{}};
 win.window=win;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','arena-layout-v05S13.js'),'utf8'),win,{filename:'arena-layout-v05S13.js'});
 return {win,workspace,actions,player,enemy,stored,registry};
}
test('stage B initializes a reversible 2D layout button without editing battle objects',()=>{
 const {win,workspace,actions,player,enemy,stored,registry}=setup();
 const api=win.MW_ARENA_V05S13;
 assert.equal(api.getState().ready,true);
 assert.ok(workspace.classes.has('mw13-2d-layout'));
 const toggle=actions.children.find(el=>el.id==='battleLayoutToggle');
 assert.ok(toggle);
 assert.equal(toggle.attrs['aria-pressed'],'true');
 assert.equal(player.children.length,5);
 assert.equal(player.children[0].vars['--mw13-fan-rot'],'-8.5deg');
 assert.equal(player.children.at(-1).vars['--mw13-fan-rot'],'8.5deg');
 assert.ok(enemy.children[0].vars['--mw13-fan-rot'].endsWith('deg'));
 assert.ok(registry.length>=2);
 toggle.listeners.click();
 assert.ok(!workspace.classes.has('mw13-2d-layout'));
 assert.equal(toggle.attrs['aria-pressed'],'false');
 assert.equal(stored[api.storageKey],'classic');
 toggle.listeners.click();
 assert.ok(workspace.classes.has('mw13-2d-layout'));
 assert.equal(stored[api.storageKey],'new');
 assert.equal(actions.children.filter(el=>el.id==='battleLayoutToggle').length,1);
});
