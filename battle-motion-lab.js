/* Isolated motion review player. Seeking never calls the gameplay engine. */
(() => {
'use strict';
const $=id=>document.getElementById(id),M=window.MW_BATTLE_MOTION;
const labels={turnBanner:'Баннер начала',drawReveal:'Чтение добранной карты',drawTravel:'Добор в руку',playLift:'Подъём карты',playTravel:'Перенос на поле',summon:'Появление овала',attackPrepare:'Подготовка удара',attackLunge:'Рывок',contact:'Контакт',attackReturn:'Возврат',numbers:'Чтение чисел',endBanner:'Конец хода',hourStep:'Шаг часов',opponentBanner:'Баннер соперника'};
const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
let scenario,track=[],settings=M.config(),position=0,playing=false,raf=0,lastStamp=0,lastScene=-1;
const faces=new Map(),portraits=new Map(),media=matchMedia('(prefers-reduced-motion: reduce)');
$('reduced').checked=media.matches;
const options=()=>({speed:Number($('speed').value),reduced:$('reduced').checked||media.matches});
const full=id=>faces.get(id)||'';
function unitHTML(m){return `<div class="unit" data-unit="${esc(m.uid)}"><span class="fallback">${esc(m.name)}</span>${portraits.get(m.cardId)?`<img alt="${esc(m.name)}" src="${portraits.get(m.cardId)}">`:''}<span class="stats"><b>${m.attack}</b><b>${m.health}</b></span></div>`;}
function handHTML(h,state){const c=state.cards[h.cardId];return `<div class="card" data-hand="${esc(h.uid)}"><span class="fallback">${esc(c?.name||'Монетка')}</span>${full(h.cardId)?`<img alt="${esc(c?.name||'Монетка')}" src="${full(h.cardId)}">`:''}</div>`;}
function renderState(state){
 for(const [id,owner]of [['ownBoard',0],['enemyBoard',1]])
  window.MW_BATTLE_DOM.reconcile($(id),state.players[owner].board,{key:m=>owner+'|'+m.uid,html:unitHTML});
 window.MW_BATTLE_DOM.reconcile($('hand'),state.players[0].hand,{key:h=>h.uid,html:h=>handHTML(h,state)});
 $('mana').textContent=state.players[0].mana+' / '+state.players[0].maxMana+' маны';
 $('deckCount').textContent=state.players[0].deckCount;
 for(const[id,o]of [['ownHero',0],['enemyHero',1]]){
  const img=$(id).querySelector('img');img.src=window.MW_HERO_ART.portraitFor('Воин',state.hour>=6&&state.hour<18?'day':'night');
  $(id).querySelector('b').textContent=state.players[o].health;
 }
 $('hourLabel').textContent=String(state.hour).padStart(2,'0')+':00';
 $('clockPointer').style.transform=`rotate(${(state.hour%12)*30}deg)`;
}
function point(node,fallback){if(!node)return fallback;const b=$('stage').getBoundingClientRect(),r=node.getBoundingClientRect();return {x:r.left-b.left+r.width/2,y:r.top-b.top+r.height/2};}
function findUnit(uid){return [...document.querySelectorAll('.unit[data-unit]')].find(n=>n.dataset.unit===uid);}
function ghostCard(card){$('ghost').replaceChildren();if(full(card.cardId)){const img=document.createElement('img');img.src=full(card.cardId);img.alt=card.name;$('ghost').append(img);}else{const span=document.createElement('span');span.textContent=card.name;$('ghost').append(span);}}
function rebuild(keep=true){
 const prior=track.length?M.sample(track,position):null;
 track=M.timeline(scenario.scenes,settings,options());
 position=keep&&prior?track[prior.index].start+track[prior.index].duration*prior.progress:0;
 $('seek').max=String(track.at(-1).end||1);
 $('timeline').innerHTML=track.map((s,i)=>`<li><button type="button" data-scene="${i}"><span>${i+1}. ${esc(s.label)}</span><time>${(s.start/1000).toFixed(2)}–${(s.end/1000).toFixed(2)} с</time></button></li>`).join('');
 lastScene=-1;render();
}
function render(){
 if(!scenario)return;
 const sample=M.sample(track,position),s=sample.scene,p=sample.progress,reduced=options().reduced;
 const state=s.commit&&p>=1?s.commit:s.state;
 if(lastScene!==sample.index){
  renderState(state);lastScene=sample.index;
  $('phase').textContent=s.label;
  [...$('timeline').querySelectorAll('button')].forEach((n,i)=>n.classList.toggle('active',i===sample.index));
  if(s.card)ghostCard(s.card);
 }
 $('seek').value=String(Math.round(sample.time));$('time').textContent=(sample.time/1000).toFixed(2)+' / '+(sample.total/1000).toFixed(2)+' с';
 $('stage').dataset.scene=s.id;$('stage').dataset.finished=String(sample.finished);
 $('banner').hidden=!['turn','end','opponent'].includes(s.id);
 $('banner').textContent=s.id==='end'?'Ход завершён':s.id==='opponent'?'Ход соперника':'Ваш ход';
 $('ghost').hidden=!s.card;
 const stage=$('stage'),w=stage.clientWidth,h=stage.clientHeight;
 if(s.card){
  let from,to,scale=1;
  if(s.id.startsWith('draw')){
   const deck=point($('deck'),{x:w*.9,y:h*.5}),reading={x:w*.76,y:h*.44},hand={x:w*.6,y:h*.9};
   from=reading;to=s.id==='draw-reveal'?reading:hand;
   if(s.id==='draw-reveal'&&!reduced){from=deck;to=reading;}
   scale=s.id==='draw-travel'?1-.25*p:1;
  }else{
   const selected=[...document.querySelectorAll('[data-hand]')].find(n=>n.dataset.hand===s.handUid);
   const hand=point(selected,{x:w*.55,y:h*.9}),lift={x:hand.x,y:hand.y-h*.09},field={x:w*.62,y:h*.58};
   from=s.id==='lift'?hand:lift;to=s.id==='lift'?lift:field;
   if(s.id==='play')scale=1-.2*p;
  }
  const q=reduced?1:p;
  Object.assign($('ghost').style,{left:(from.x+(to.x-from.x)*q-w*.065)+'px',top:(from.y+(to.y-from.y)*q-w*.0975)+'px',transform:`scale(${scale})`,opacity:'1'});
 }
 for(const n of document.querySelectorAll('.unit')){n.style.transform='';n.style.filter='';}
 if(s.id==='summon'){
  const n=findUnit(s.unitUid);if(n&&!reduced)n.style.transform=`scale(${.8+.2*p})`;
 }
 const attacker=findUnit(s.attackerUid),defender=findUnit(s.defenderUid);
 if(attacker&&defender&&!reduced&&['prepare','lunge','impact','return'].includes(s.id)){
  const a=point(attacker),b=point(defender),amount=s.id==='lunge'?p*.8:s.id==='impact'?.8:s.id==='return'?(1-p)*.8:0;
  attacker.style.transform=`translate(${(b.x-a.x)*amount}px,${(b.y-a.y)*amount}px)`;
  if(s.id==='prepare')attacker.style.filter='brightness(1.25)';
 }
 const numbers=['impact','return','numbers'].includes(s.id)?s.damage:[];
 $('numbers').className='numbers '+($('numberStyle').value==='badge'?'badge':'burst');
 $('numbers').replaceChildren();
 for(const d of numbers){
  const target=findUnit(d.uid),xy=point(target,{x:w*.5,y:h*(d.owner===0?.6:.3)}),n=document.createElement('span');
  n.className='damage';n.textContent='−'+d.amount;
  Object.assign(n.style,{left:xy.x+'px',top:(xy.y-(s.id==='numbers'&&!reduced?p*20:0))+'px',opacity:String(s.id==='numbers'?1-p:1)});
  $('numbers').append(n);
 }
 if(s.id==='hour')$('clockPointer').style.transform=`rotate(${(s.oldHour%12)*30+30*p}deg)`;
 if(sample.finished){playing=false;$('play').textContent='▶ Ещё раз';}
}
function stop(){playing=false;cancelAnimationFrame(raf);raf=0;$('play').textContent='▶ Воспроизвести';}
function tick(stamp){if(!playing)return;position+=Math.min(100,Math.max(0,stamp-lastStamp));lastStamp=stamp;render();if(playing)raf=requestAnimationFrame(tick);}
function play(){if(!scenario)return;if(playing){stop();return;}if(M.sample(track,position).finished)position=0;playing=true;$('play').textContent='Ⅱ Пауза';lastStamp=performance.now();raf=requestAnimationFrame(tick);}
$('play').onclick=play;
$('seek').oninput=()=>{stop();position=Number($('seek').value);lastScene=-1;render();};
$('previous').onclick=()=>{stop();const at=M.sample(track,position);position=track[Math.max(0,at.index-1)].start;lastScene=-1;render();};
$('next').onclick=()=>{stop();const at=M.sample(track,position);position=at.index===track.length-1?at.total:track[at.index+1].start;lastScene=-1;render();};
$('restart').onclick=()=>{stop();position=0;lastScene=-1;render();};
$('speed').onchange=()=>{stop();rebuild();};$('reduced').onchange=()=>{stop();rebuild();};$('numberStyle').onchange=render;
media.addEventListener('change',()=>{stop();rebuild();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
$('timeline').onclick=e=>{const n=e.target.closest('[data-scene]');if(!n)return;stop();position=track[Number(n.dataset.scene)].start;lastScene=-1;render();};
$('parameters').innerHTML=Object.entries(labels).map(([key,title])=>`<label class="parameter"><span>${title} <small>мс</small></span><input type="number" min="0" max="3000" step="10" data-parameter="${key}" aria-label="${title}, мс" value="${settings[key]}"></label>`).join('');
$('parameters').oninput=e=>{if(!e.target.dataset.parameter)return;stop();settings=M.config({...settings,[e.target.dataset.parameter]:e.target.value});e.target.value=settings[e.target.dataset.parameter];rebuild();};
$('defaults').onclick=()=>{stop();settings=M.config();$('speed').value='1';$('reduced').checked=media.matches;for(const n of $('parameters').querySelectorAll('input'))n.value=settings[n.dataset.parameter];rebuild(false);};
$('export').onclick=()=>{
 const data={format:'mw-motion-proposal',version:1,status:'proposal',parameters:settings,...options(),numberStyle:$('numberStyle').value,fixtureSeed:scenario.seed,
  timeline:track.map(({id,label,start,end,duration})=>({id,label,start,end,duration})),outcome:scenario.outcome};
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='MW_Motion_Proposal.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
try{
 scenario=window.MW_MOTION_SCENARIO.build(window.MW_GAME_ENGINE,window.MW_CANONICAL_CARDS,window.MW_APPROVED_EXAMPLE_DECKS,window.MW_BATTLE_PRESENTATION);
 $('stage').dataset.engineRuns='1';$('stage').dataset.fixtureSeed=String(scenario.seed);
 $('proof').textContent=`Контрольный сценарий seed ${scenario.seed}. Ядро рассчитано один раз. Итог: ход соперника, ${scenario.outcome.hour}:00; здоровье существ 1 / 2 против 1. Перемотка и темп итог не меняют.`;
 const all=new Map();for(const scene of scenario.scenes){for(const c of Object.values(scene.state.cards))all.set(c.cardId,c);if(scene.card)all.set(scene.card.cardId,scene.card);}
 const requests=[];for(const c of all.values()){
  requests.push(window.MW_V05_BATTLE_CARD.request(c,'full',{}).then(url=>{if(url)faces.set(c.cardId,url);}));
  if(c.cardType==='creature')requests.push(window.MW_V05_BATTLE_CARD.request(c,'boardPortrait',{}).then(url=>{if(url)portraits.set(c.cardId,url);}));
 }
 rebuild(false);
 Promise.allSettled(requests).then(()=>{lastScene=-1;render();});
 for(const id of ['play','previous','next','restart','seek'])$(id).disabled=false;
}catch(err){$('error').hidden=false;$('error').textContent='Прототип не запущен: '+err.message;console.error(err);}
})();
