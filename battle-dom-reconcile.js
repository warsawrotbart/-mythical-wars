/* Stable card roots keyed by zone instance UID. Renderer-owned faces stay attached. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MW_BATTLE_DOM=api;})(typeof window==='object'?window:globalThis,function(){
'use strict';
const records=new WeakMap();let nodeSerial=0;
function classSet(el){return new Set((el.getAttribute('class')||'').split(/\s+/).filter(Boolean));}
function update(node,fresh,previous){
 const priorClasses=new Set((previous?.className||'').split(/\s+/).filter(Boolean));
 const nextClasses=classSet(fresh);
 for(const cls of priorClasses)if(!nextClasses.has(cls))node.classList.remove(cls);
 for(const cls of nextClasses)node.classList.add(cls);
 const previousAttrs=previous?.attrs||new Set();
 const attrs=new Set([...fresh.attributes].map(a=>a.name).filter(n=>n!=='class'));
 for(const key of previousAttrs)if(!attrs.has(key))node.removeAttribute(key);
 for(const attr of fresh.attributes)if(attr.name!=='class'&&node.getAttribute(attr.name)!==attr.value)node.setAttribute(attr.name,attr.value);
 const oldChildren=previous?.children||new Map(),children=new Map();
 for(const child of [...fresh.children]){
  const key=child.tagName+':'+(child.classList[0]||'');
  const old=oldChildren.get(key),html=child.outerHTML;
  let live=old?.node;
  if(!live||live.parentNode!==node){live=child;node.append(live);}
  else if(old.html!==html){live.replaceWith(child);live=child;}
  children.set(key,{node:live,html});
 }
 for(const [key,old]of oldChildren)if(!children.has(key))old.node.remove();
 records.set(node,{className:fresh.getAttribute('class')||'',attrs,children});
 return node;
}
function reconcile(container,items,{key,html,empty=''}={}){
 const doc=container.ownerDocument,known=new Map([...container.children].filter(n=>n.dataset.mwInstanceKey).map(n=>[n.dataset.mwInstanceKey,n]));
 const keys=items.map(key);if(new Set(keys).size!==keys.length)throw new Error('Duplicate card instance key');
 const desired=[];
 for(let i=0;i<items.length;i++){
  const template=doc.createElement('template');template.innerHTML=html(items[i]);
  const fresh=template.content.firstElementChild;if(!fresh)throw new Error('Card root required');
  const id=keys[i];let node=known.get(id);
  if(node){update(node,fresh,records.get(node));known.delete(id);}
  else{
   node=fresh;node.dataset.mwDomSerial=String(++nodeSerial);
   const children=new Map([...node.children].map(c=>[c.tagName+':'+(c.classList[0]||''),{node:c,html:c.outerHTML}]));
   records.set(node,{className:node.getAttribute('class')||'',attrs:new Set([...node.attributes].map(a=>a.name).filter(n=>!['class','data-mw-dom-serial'].includes(n))),children});
  }
  node.dataset.mwInstanceKey=id;desired.push(node);
 }
 for(const node of known.values())node.remove();
 const keep=new Set(desired);for(const node of [...container.children])if(!keep.has(node))node.remove();
 for(let i=0;i<desired.length;i++)if(container.children[i]!==desired[i])container.insertBefore(desired[i],container.children[i]||null);
 if(!desired.length&&container.innerHTML!==empty)container.innerHTML=empty;
 return desired;
}
return {reconcile};
});
