'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {reconcile}=require('../battle-dom-reconcile.js');
// Minimal DOM port, with templates supplied as known element trees. Browser QA covers HTML parsing.
class Node {
 constructor(doc,tag='DIV',attrs={},text=''){this.ownerDocument=doc;this.tagName=tag;this.attrs={...attrs};this.children=[];this.text=text;this.parentNode=null;
  this.dataset=new Proxy({}, {get:(_,key)=>this.attrs['data-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())],set:(_,key,value)=>(this.attrs['data-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())]=value,true)});
  const classes=()=>new Set((this.attrs.class||'').split(/\s+/).filter(Boolean));
  this.classList={get 0(){return [...classes()][0]},add:(x)=>{const s=classes();s.add(x);this.attrs.class=[...s].join(' ')},remove:x=>{const s=classes();s.delete(x);this.attrs.class=[...s].join(' ')}};
 }
 get attributes(){return Object.entries(this.attrs).map(([name,value])=>({name,value}));}
 getAttribute(k){return this.attrs[k]??null;}setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}
 get outerHTML(){return this.tagName+JSON.stringify(this.attrs)+this.text+this.children.map(n=>n.outerHTML).join('');}
 get innerHTML(){return this.children.map(n=>n.outerHTML).join('');}set innerHTML(x){for(const c of this.children)c.parentNode=null;this.children=[];this.text=x;}
 append(n){this.insertBefore(n,null);}insertBefore(n,b){n.remove();const at=b?this.children.indexOf(b):this.children.length;this.children.splice(at,0,n);n.parentNode=this;}
 remove(){if(this.parentNode){const p=this.parentNode;p.children.splice(p.children.indexOf(this),1);this.parentNode=null;}}
 replaceWith(n){const p=this.parentNode;p.insertBefore(n,this);this.remove();}
 cloneNode(){const n=new Node(this.ownerDocument,this.tagName,this.attrs,this.text);for(const c of this.children)n.append(c.cloneNode());return n;}
}
function setup(){
 const doc={createElement(){return {content:{},set innerHTML(item){this.content.firstElementChild=item.cloneNode();}}}};
 const zone=new Node(doc),card=(id,hp=2)=>{const n=new Node(doc,'DIV',{class:'battle-card ready','data-card':id});n.append(new Node(doc,'SPAN',{class:'bc-health'},String(hp)));return {id,node:n};};
 const render=items=>reconcile(zone,items,{key:x=>x.id,html:x=>x.node});
 return {doc,zone,card,render};
}
test('reordering and inserting keeps roots, rendered images and unchanged children attached',()=>{
 const {doc,zone,card,render}=setup();const [a,b]=render([card('a'),card('b')]),stat=a.children[0],face=new Node(doc,'IMG',{class:'mw-template-face'});
 a.append(face);a.classList.add('mw-hybrid-ready');const serial=a.dataset.mwDomSerial;
 const changed=render([card('b'),card('c'),card('a')]);
 assert.equal(changed[0],b);assert.equal(changed[2],a);assert.equal(a.children[0],stat);assert.equal(face.parentNode,a);
 assert.equal(a.dataset.mwDomSerial,serial);assert.ok(a.getAttribute('class').includes('mw-hybrid-ready'));assert.equal(zone.children.length,3);
});
test('stat update replaces only the changed base child and removes departed instances',()=>{
 const {doc,card,render}=setup();const [a,b]=render([card('a'),card('b')]),face=new Node(doc,'IMG',{class:'mw-template-face'});a.append(face);
 const stat=a.children[0];render([card('a',1)]);
 assert.equal(a.children[0].text,'1');assert.notEqual(a.children[0],stat);assert.equal(face.parentNode,a);assert.equal(b.parentNode,null);
});
test('duplicate instance keys are rejected before modifying the visible zone',()=>{
 const {zone,card,render}=setup();const [a]=render([card('a')]);assert.throws(()=>render([card('b'),card('b')]),/Duplicate/);assert.equal(zone.children[0],a);
});
