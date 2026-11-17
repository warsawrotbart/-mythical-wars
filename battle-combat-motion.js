/* MW T10–T13: causal combat presentation. It never executes gameplay commands. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.MW_COMBAT_MOTION=api;})(typeof window==='object'?window:globalThis,function(){
'use strict';
let flight=null,flightSerial=0;const lastRects=new Map();
const reduced=doc=>globalThis.MW_MOTION_RUNTIME?.reduced(doc);
const id=t=>t.kind==='hero'?'hero:'+t.owner:t.owner+'|'+t.uid;
function targetNode(doc,t){if(!t)return null;if(t.kind==='hero')return doc.getElementById(t.owner?'botHeroPortrait':'myHeroPortrait');
 return [...doc.querySelectorAll('[data-battle-minion]')].find(n=>n.dataset.battleMinion===t.owner+'|'+t.uid);}
function weaponNode(doc,o){return doc.querySelector(`[data-hero-owner="${o}"] .mw11-weapon-slot`);}
function vector(a,b){const x=b.left+b.width/2-a.left-a.width/2,y=b.top+b.height/2-a.top-a.height/2,len=Math.hypot(x,y);
 const ratio=len?Math.max(0,(len-(a.width+b.width)*.25)/len):0;return {x:x*ratio,y:y*ratio};}
function damageLabel(p){return p.blocked?p.blocked:p.actual>0?'−'+p.actual+' урон':'Без урона';}
function damageDetail(p){return 'Броня −'+p.armorLoss+' · HP −'+p.healthLoss;}
function frames(node,keyframes,signal,duration,hold=false){
 if(!node?.animate||signal.aborted)return Promise.resolve(null);
 if(globalThis.MW_MOTION_RUNTIME)return globalThis.MW_MOTION_RUNTIME.animate(node,keyframes,{signal,duration,hold,easing:'cubic-bezier(.25,.7,.2,1)'});
 const a=node.animate(keyframes,{duration,easing:'cubic-bezier(.25,.7,.2,1)',fill:hold?'forwards':'none'});
 const stop=()=>a.cancel();signal.addEventListener('abort',stop,{once:true});
 return a.finished.catch(()=>{}).then(()=>{signal.removeEventListener('abort',stop);if(!hold||signal.aborted)a.cancel();return a;});
}
function copyVisual(doc,node,r){
 const n=doc.createElement('div');n.className='mw6-actor';n.setAttribute('aria-hidden','true');
 const face=node?.querySelector('.mw-template-face,img');
 if(face)n.append(face.cloneNode(true));else if(node){n.style.backgroundImage=getComputedStyle(node).backgroundImage;n.style.backgroundSize='contain';n.style.backgroundRepeat='no-repeat';n.style.backgroundPosition='center';}
 Object.assign(n.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});doc.body.append(n);return n;
}
function journal(doc,text){
 let list=doc.getElementById('mw6CombatJournal');
 if(!list){const details=doc.createElement('details');details.className='mw6-journal';const title=doc.createElement('summary');title.textContent='Боевые события: урон, броня, HP';
 list=doc.createElement('ol');list.id='mw6CombatJournal';details.append(title,list);(doc.getElementById('battleSidePanel')||doc.getElementById('battleWorkspace')).append(details);}
 const li=doc.createElement('li');li.textContent=text;list.append(li);while(list.children.length>80)list.firstElementChild.remove();
}
async function label(doc,text,t,signal,detail=''){
 const node=targetNode(doc,t),r=flight&&flight.key===id(t)?flight.node.getBoundingClientRect():node?.getBoundingClientRect()||lastRects.get(id(t));if(!r)return;
 const n=doc.createElement('div');n.className='mw6-number';n.setAttribute('role','status');
 const strong=doc.createElement('strong');strong.textContent=text;n.append(strong);
 if(detail){const small=doc.createElement('small');small.textContent=detail;n.append(small);}
 Object.assign(n.style,{left:Math.max(90,Math.min(globalThis.innerWidth-90,r.left+r.width/2))+'px',top:Math.max(45,Math.min(globalThis.innerHeight-70,r.top+r.height*.28))+'px'});doc.body.append(n);
 try{if(!reduced(doc))await frames(n,[{opacity:0,transform:'translate(-50%,8px) scale(.85)'},{opacity:1,transform:'translate(-50%,-12px)',offset:.2},{opacity:1,transform:'translate(-50%,-18px)',offset:.8},{opacity:0,transform:'translate(-50%,-35px)'}],signal,620);}finally{n.remove();}
}
async function finishAttack(doc,snapshot,signal){
 const f=flight;if(!f)return;flight=null;
 try{
  const alive=f.ref.kind==='hero'?snapshot.players[f.ref.owner].health>0:snapshot.players[f.ref.owner].board.some(m=>m.uid===f.ref.uid&&m.health>0);
  f.animation?.cancel();
  if(!reduced(doc))await frames(f.node,alive?[{transform:`translate(${f.delta.x}px,${f.delta.y}px)`},{transform:'translate(0,0)'}]:[{opacity:1},{opacity:0}],signal,180);
 }finally{f.node.remove();if(f.source?.dataset.mw6Flight===f.token){f.source.classList.remove('mw6-source-hidden');delete f.source.dataset.mw6Flight;}}
}
async function attack(doc,p,{signal}){
 reset(doc);clearAim(doc);if(reduced(doc)||signal.aborted)return;
 const ref={kind:p.hero?'hero':'minion',owner:p.owner,uid:p.attackerUid};
 const source=targetNode(doc,ref),target=targetNode(doc,p.target);if(!source||!target)return;
 const a=source.getBoundingClientRect(),b=target.getBoundingClientRect(),delta=vector(a,b),node=copyVisual(doc,source,a);
 const token=String(++flightSerial);source.dataset.mw6Flight=token;source.classList.add('mw6-source-hidden');flight={source,node,ref,key:id(ref),delta,token};
 await frames(node,[{filter:'brightness(1)'},{filter:'brightness(1.45)'}],signal,100);
 if(signal.aborted)return reset(doc);
 const animation=await frames(node,[{transform:'translate(0,0)'},{transform:`translate(${delta.x}px,${delta.y}px)`}],signal,140,true);
 if(flight)flight.animation=animation;
}
async function reveal(doc,p,{signal}){
 if(reduced(doc)||signal.aborted)return;
 const own=p.owner===0?[...doc.querySelectorAll('#myHand [data-battle-hand]')].find(n=>n.dataset.battleHand===p.uid):null;
 const source=own||doc.getElementById(p.owner?'mwArtBotDeck':'mwArtMyDeck');if(!source)return;
 const target=p.card?.cardType==='weapon'?weaponNode(doc,p.owner):targetNode(doc,p.target)||doc.querySelector('.battle-main');
 if(!target)return;const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
 const node=copyVisual(doc,own,a);if(p.card){const url=await globalThis.MW_MOTION_RUNTIME.resource(window.MW_BATTLE_CARD_RENDERER?.request(p.card,'full',{}),signal);if(url&&!signal.aborted){const image=doc.createElement('img');image.src=url;node.replaceChildren(image);}}
 try{if(!signal.aborted)await frames(node,[{transform:'translate(0,0)',opacity:1},{transform:`translate(${b.left+b.width/2-a.left-a.width/2}px,${b.top+b.height/2-a.top-a.height/2}px) scale(.6)`,opacity:.2}],signal,320);}finally{node.remove();}
}
async function step(doc,p,{signal,apply}){
 if(signal.aborted)return;
 const threeD=doc.getElementById('battleWorkspace')?.classList.contains('mw3d-active');if(threeD)return;
 const change=async item=>{
  if(item.type==='damage'){
   const recipient=item.target.kind==='hero'?(item.target.owner?'Герой соперника':'Ваш герой'):(targetNode(doc,item.target)?.getAttribute('aria-label')||item.target.uid).split(' · ')[0];
   journal(doc,recipient+': '+damageLabel(item)+' · '+damageDetail(item)+(item.blocked?' · потери отсутствуют':''));
   return label(doc,damageLabel(item),item.target,signal,item.blocked?'HP и броня сохранены':damageDetail(item));
  }
  if(item.type==='healing'){journal(doc,'Лечение: +'+item.actual+' HP');return label(doc,'+'+item.actual+' HP',item.target,signal);}
  if(item.type==='attributesChanged'){const text=[item.attack?(item.attack>0?'+':'')+item.attack+' атака':'',item.maxHealth?(item.maxHealth>0?'+':'')+item.maxHealth+' макс. HP':''].filter(Boolean).join(' · ');if(text){journal(doc,'Характеристики: '+text);return label(doc,text,item.target,signal);}}
 };
 if(p.type==='creaturesDied'){
  const nodes=p.instances.map(x=>{const t={kind:'minion',owner:x.owner,uid:x.instance.uid},n=targetNode(doc,t);if(n)lastRects.set(id(t),n.getBoundingClientRect());return n;}).filter(Boolean);
  if(!reduced(doc))await Promise.all(nodes.map(n=>frames(n,[{opacity:1},{opacity:0,filter:'brightness(1.8) blur(3px)'}],signal,240)));
  if(!signal.aborted){apply(p.snapshot);journal(doc,'Гибель: '+p.instances.map(x=>x.instance.name).join(', '));}return;
 }
 if(p.type==='deathrattleTriggered'){
  const target={kind:'minion',owner:p.owner,uid:p.instance.uid};journal(doc,'Предсмертный эффект: '+p.instance.name);
  await label(doc,'☠ '+p.instance.name,target,signal,'Предсмертный эффект');return;
 }
 if(p.type==='destroyed'){journal(doc,'Уничтожение: без числа урона');return;}
 if(p.type==='legacyRebirth'){journal(doc,'Восстановление: '+p.instance.name+' (текущее поведение ядра)');if(!signal.aborted)apply(p.snapshot);return;}
 if(!signal.aborted)apply(p.snapshot);
 if(flight)targetNode(doc,flight.ref)?.classList.add('mw6-source-hidden');
 if(p.type==='impactBatch'){
  const nodes=p.changes.filter(x=>x.target).map(x=>targetNode(doc,x.target)).filter(Boolean);
  const flash=!reduced(doc)?Promise.all(nodes.map(n=>frames(n,[{filter:'brightness(1)'},{filter:'brightness(1.7)',offset:.4},{filter:'brightness(1)'}],signal,100))):Promise.resolve();
  await Promise.all([flash,...p.changes.map(change)]);
  if(p.kind==='combat')await finishAttack(doc,p.snapshot,signal);return;
 }
 if(p.type==='weaponChanged'){
  const text=p.after?(p.before?.cardId===p.after.cardId?'Прочность '+p.after.durability:p.before?'Замена оружия':'Оружие экипировано'):'Оружие сломано';journal(doc,text);
  const node=weaponNode(doc,p.owner);if(node&&!reduced(doc))await frames(node,[{filter:'brightness(1)'},{filter:'brightness(1.8)',offset:.4},{filter:'brightness(1)'}],signal,280);return;
 }
 if(p.type==='heroPowerUsed'){
  journal(doc,'Сила героя использована');const n=doc.getElementById(p.owner?'botHeroPower':'myHeroPower');
  if(n&&!reduced(doc))await frames(n,[{filter:'brightness(1.8)'},{filter:'brightness(1)'}],signal,260);return;
 }
 await change(p);
}
function clearAim(doc){doc.getElementById('mw6Aim')?.remove();}
function aim(doc,source,point,allowed){
 clearAim(doc);if(!source||!point||!allowed.length)return;
 const n=targetNode(doc,{kind:source.hero?'hero':'minion',owner:source.owner??0,uid:source.uid});if(!n)return;
 const r=n.getBoundingClientRect(),svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.id='mw6Aim';svg.setAttribute('aria-hidden','true');
 const line=doc.createElementNS(svg.namespaceURI,'line');line.setAttribute('x1',r.left+r.width/2);line.setAttribute('y1',r.top+r.height/2);line.setAttribute('x2',point.x);line.setAttribute('y2',point.y);svg.append(line);doc.body.append(svg);
}
function reset(doc){lastRects.clear();if(flight){flight.animation?.cancel();flight.node.remove();flight.source?.classList.remove('mw6-source-hidden');flight=null;}
 doc.querySelectorAll('.mw6-actor,.mw6-number').forEach(n=>n.remove());doc.querySelectorAll('.mw6-source-hidden').forEach(n=>n.classList.remove('mw6-source-hidden'));clearAim(doc);}
return {vector,damageLabel,damageDetail,attack,reveal,step,aim,clearAim,reset};
});
