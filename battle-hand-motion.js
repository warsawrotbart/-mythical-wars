/* MW T05–T09. Screen-space presentation; accepted engine commands are never replayed. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.MW_HAND_MOTION=api;})(typeof window==='object'?window:globalThis,function(){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function grabOffset(rect,point,width,height){return {x:clamp(((point?.x??rect.left+rect.width/2)-rect.left)/Math.max(1,rect.width),0,1)*width,
 y:clamp(((point?.y??rect.top+rect.height/2)-rect.top)/Math.max(1,rect.height),0,1)*height};}
function releaseRect(rect,grab,drop){
 const offset=grabOffset(rect,grab,rect.width,rect.height);
 return {...rect,left:drop.x-offset.x,top:drop.y-offset.y};
}
function insertionIndex(rects,x){return rects.reduce((n,r)=>n+(x>r.left+r.width/2?1:0),0);}
function slots(rects,boardRect,capacity=7){
 if(rects.length>=capacity)return [];
 if(!rects.length)return [{index:0,x:boardRect.left+boardRect.width/2,y:boardRect.top+boardRect.height/2}];
 return Array.from({length:rects.length+1},(_,i)=>({index:i,
 x:i===0?rects[0].left:i===rects.length?rects[i-1].right:(rects[i-1].right+rects[i].left)/2,
 y:boardRect.top+boardRect.height/2}));
}
const rect=n=>n?.getBoundingClientRect(),center=r=>({left:r.left+r.width/2,top:r.top+r.height/2});
const cards=(doc,owner)=>[...doc.querySelectorAll('#'+(owner?'botBoard':'myBoard')+' [data-battle-minion]')];
function clearSlots(doc){doc.querySelectorAll('.mw-placement-slot').forEach(n=>n.remove());}
function showSlots(doc,onChoose,selected=null){
 clearSlots(doc);const board=doc.getElementById('myBoard');if(!board)return;
 const row=cards(doc,0);const b=rect(board);
 for(const slot of slots(row.map(rect),b)){
  const button=doc.createElement('button');button.type='button';button.className='mw-placement-slot';
  button.dataset.placementIndex=slot.index;button.setAttribute('aria-label','Поставить существо: место '+(slot.index+1));
  button.textContent='＋';button.classList.toggle('active',slot.index===selected);
  Object.assign(button.style,{left:slot.x+'px',top:slot.y+'px'});
  button.onclick=e=>{e.stopPropagation();onChoose(slot.index);};doc.body.append(button);
 }
}
async function animate(node,frames,signal,duration=280){
 if(!node?.animate||signal?.aborted||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 if(globalThis.MW_MOTION_RUNTIME)return globalThis.MW_MOTION_RUNTIME.animate(node,frames,{signal,duration,easing:'cubic-bezier(.2,.75,.25,1)'});
 const a=node.animate(frames,{duration,easing:'cubic-bezier(.2,.75,.25,1)',fill:'none'});
 const cancel=()=>a.cancel();signal?.addEventListener('abort',cancel,{once:true});
 try{await a.finished;}catch(_){}finally{signal?.removeEventListener('abort',cancel);a.cancel();}
}
function ghost(doc,node,r,label='Карта'){
 const n=node?node.cloneNode(true):doc.createElement('div');n.removeAttribute('id');
 n.querySelectorAll('[id]').forEach(x=>x.removeAttribute('id'));n.className='mw-card-flight';
 n.setAttribute('aria-hidden','true');if(!node)n.textContent=label;
 Object.assign(n.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});doc.body.append(n);return n;
}
async function fly(doc,node,from,to,signal,{duration=300,definition=null,oval=null,cost=null}={}){
 if(!from||!to||signal?.aborted)return;
 const n=ghost(doc,node,from);let board;const layers=[];
 try{
  if(definition){const request=window.MW_BATTLE_CARD_RENDERER?.request(definition,'full',{cost});const url=await globalThis.MW_MOTION_RUNTIME.resource(request,signal);if(url&&!signal?.aborted){const img=doc.createElement('img');img.src=url;n.replaceChildren(img);}}
  if(signal?.aborted)return;
  const end={transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(${to.width/from.width},${to.height/from.height})`,opacity:1};
  if(oval){
   n.style.background='transparent';n.style.border='0';
   const faces=[...n.children];
   board=doc.createElement('div');board.className='mw-flight-oval';
   const source=oval.querySelector('.mw-template-face');
   const image=source?.cloneNode(true)||doc.createElement('img');
   image.className='mw-template-face';board.append(image);n.append(board);
   if(definition){
    const portrait=await globalThis.MW_MOTION_RUNTIME.resource(window.MW_BATTLE_CARD_RENDERER?.request(definition,'boardPortrait',{}),signal);
    if(portrait&&!signal?.aborted)image.src=portrait;
   }
   // Fade between the approved full and oval renders; no new frame or art crop.
   if(signal?.aborted)return;
   for(const face of faces)layers.push(animate(face,[{opacity:1},{opacity:1,offset:.45},{opacity:0}],signal,duration));
   layers.push(animate(board,[{opacity:0},{opacity:0,offset:.45},{opacity:1}],signal,duration));
  }
  await Promise.all([...layers,animate(n,[{transform:'translate(0,0) scale(1)',opacity:1},end],signal,duration)]);
 }finally{n.remove();}
}
function cardNode(doc,uid){return [...doc.querySelectorAll('#myHand [data-battle-hand]')].find(n=>n.dataset.battleHand===uid);}
function count(doc,owner,deckCount,handCount){
 const deck=doc.getElementById(owner?'mwArtBotDeckCount':'mwArtMyDeckCount');if(deck){deck.textContent=deckCount;deck.parentElement.setAttribute('aria-label',(owner?'Колода соперника: ':'Моя колода: ')+deckCount+' карт');}
 // Hand nodes remain reserved until their individual arrival; no engine array is changed.
 const hand=doc.getElementById(owner?'botHand':'myHand');if(hand)hand.dataset.presentedCount=handCount;
 const stats=doc.getElementById(owner?'botStats':'myStats');if(stats)stats.textContent=owner?deckCount+' карт в колоде · '+handCount+' в руке':stats.textContent.replace(/\d+ в колоде/,deckCount+' в колоде');
}
async function transition(doc,{before,after,played,release,movements=[],render,signal,isCurrent=()=>true}){
 clearSlots(doc);
 const reduced=globalThis.MW_MOTION_RUNTIME?.reduced(doc);
 const threeD=doc.getElementById('battleWorkspace').classList.contains('mw3d-active');
 if(reduced||threeD||signal.aborted){render();doc.getElementById('battleMulligan').hidden=after.phase!=='mulligan';return;}
 const old=new Map();doc.querySelectorAll('[data-battle-minion],#myHand [data-battle-hand]').forEach(n=>old.set(n.dataset.battleMinion||n.dataset.battleHand,{rect:rect(n),clone:n.cloneNode(true)}));
 const mulligan=before.phase==='mulligan'&&after.phase!=='mulligan';
 const opening=[...doc.querySelectorAll('#mulliganCards [data-mulligan]')].map(n=>({uid:n.dataset.mulligan,rect:rect(n),clone:n.cloneNode(true)}));
 const deckRect=o=>rect(doc.getElementById(o?'mwArtBotDeck':'mwArtMyDeck'));
 const hidden=[];const hide=n=>{if(n){n.style.visibility='hidden';hidden.push(n);}};
 try{
  if(mulligan){
   const survivors=new Set(after.players[0].hand.map(h=>h.uid));
   await Promise.all(opening.filter(x=>!survivors.has(x.uid)).map(x=>fly(doc,x.clone,x.rect,deckRect(0),signal)));
   doc.getElementById('battleMulligan').hidden=true;
  }
  if(signal.aborted)return;
  render();
  for(const o of [0,1])count(doc,o,before.players[o].deckCount,before.players[o].handCount);
  // Reserve all new hand positions before any arrival, including series of draws.
  const arrivals=mulligan?after.players[0].hand.map(h=>({owner:0,uid:h.uid,cardId:h.cardId,source:'opening',card:after.cards[h.cardId]})):movements;
  for(const m of arrivals){const n=m.owner===0?cardNode(doc,m.uid):null;hide(n);}
  if(movements.some(m=>m.owner===1))doc.getElementById('botHand').style.visibility='hidden';
  const flips=[];
  doc.querySelectorAll('[data-battle-minion],#myHand [data-battle-hand]').forEach(n=>{
   const was=old.get(n.dataset.battleMinion||n.dataset.battleHand);if(!was)return;
   const now=rect(n),sx=now.width/Math.max(1,n.offsetWidth),sy=now.height/Math.max(1,n.offsetHeight);
   const base=getComputedStyle(n).transform;
   flips.push(animate(n,[{transform:`translate(${(was.rect.left-now.left)/sx}px,${(was.rect.top-now.top)/sy}px) ${base==='none'?'':base}`},{transform:base}],signal,280));
  });
  const summoned=played&&after.players[played.owner].board.find(m=>m.cardId===played.cardId&&!before.players[played.owner].board.some(x=>x.uid===m.uid));
  const destination=summoned?cards(doc,played.owner).find(n=>n.dataset.battleMinion===played.owner+'|'+summoned.uid):null;
  if(destination){
   hide(destination);
   const origin=old.get(played.uid),from=origin&&release?.uid===played.uid?releaseRect(origin.rect,release.grab,release.point):origin?.rect||deckRect(played.owner);
   await fly(doc,origin?.clone,from,rect(destination),signal,{duration:420,definition:played.card,oval:destination});
   destination.style.visibility='';
  }else if(played){const origin=old.get(played.uid);if(origin)await fly(doc,origin.clone,origin.rect,{...origin.rect,top:origin.rect.top-90},signal,{duration:260});}
  for(const m of arrivals){
   if(signal.aborted)break;
   const n=m.owner===0?cardNode(doc,m.uid):null;
   const target=rect(n)||rect(doc.getElementById(m.owner?'botHand':'myHand'));
   const prior=mulligan?opening.find(x=>x.uid===m.uid):null;
   const from=prior?.rect||(m.source==='deck'||m.source==='opening'?deckRect(m.owner):m.source==='graveyard'?rect(doc.getElementById(m.owner?'botGraveyardBtn':'myGraveyardBtn')):(played?.owner===m.owner?rect(destination):null)||rect(doc.querySelector(`[data-hero-owner="${m.owner}"]`)));
   if(from&&target){
    const c=center(rect(doc.querySelector('.battle-main'))),reading=globalThis.MW_MOTION_RUNTIME.fitRect({left:c.left-80,top:c.top-120,width:160,height:240},globalThis.innerWidth,globalThis.innerHeight);
    if(m.owner===0&&!prior){
     await fly(doc,null,from,reading,signal,{duration:180,definition:m.card,cost:m.cost});
     await fly(doc,null,reading,target,signal,{duration:220,definition:m.card,cost:m.cost});
    }else await fly(doc,prior?.clone||null,from,target,signal,{duration:240});
   }
   if(n)n.style.visibility='';
   if(Number.isInteger(m.deckCount))count(doc,m.owner,m.deckCount,m.handCount);
  }
  await Promise.all(flips);
 }finally{
  if(isCurrent()){hidden.forEach(n=>n.style.visibility='');doc.getElementById('botHand').style.visibility='';}
  if(isCurrent()&&!signal.aborted)for(const o of [0,1])count(doc,o,after.players[o].deckCount,after.players[o].handCount);
 }
}
async function returnCard(doc,node,point){
 if(!node?.isConnected)return;
 const target=rect(node),offset=point.offset||grabOffset(target,point,target.width,target.height);
 const from={...target,left:point.x-offset.x,top:point.y-offset.y};
 const controller=new AbortController();
 await fly(doc,node,from,target,controller.signal,{duration:180});
}
function opening(doc,game,animateCards=true){
 const panel=doc.getElementById('mulliganCards');let info=doc.getElementById('mwOpeningInfo');
 if(!info){info=doc.createElement('p');info.id='mwOpeningInfo';panel.before(info);}
 info.textContent=(game.firstPlayer===0?'Вы ходите первым':'Первым ходит соперник')+' · Начальный час '+String(game.time).padStart(2,'0')+':00';
 if(!animateCards||globalThis.MW_MOTION_RUNTIME?.reduced(doc))return;
 // UID-based staggering animates the already dealt cards, without another draw or RNG call.
 [...panel.children].forEach((n,i)=>{n.animate?.([{opacity:0,transform:'translateY(20px)'},{opacity:1,transform:'none'}],{duration:200,delay:i*70,fill:'backwards'});});
}
return {grabOffset,releaseRect,insertionIndex,slots,clearSlots,showSlots,transition,opening,returnCard};
});
