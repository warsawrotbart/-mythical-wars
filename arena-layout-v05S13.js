/* Mythical Wars v05.13 Stage B: layout-only helper for real battle hand and rollback.
 * Reads hand nodes, adds CSS custom properties to them. It never mutates the game
 * model, card content, event handlers, card IDs, or 3D render objects.
 */
(function(global){
  'use strict';
  const KEY='mw-v0513-battle-layout';
  function fanPlan(count,stepCap=4.25){
    const n=Math.max(0,Math.min(128,Math.trunc(Number(count)||0)));
    const center=(n-1)/2;
    const step=Math.min(stepCap,28/Math.max(1,n-1));
    return Array.from({length:n},(_,i)=>{
      const offset=i-center;
      const rise=Math.min(16,Math.round(Math.abs(offset)*5.5));
      return {angle:Math.round(offset*step*100)/100,y:rise?-rise:0};
    });
  }
  function overlapFor(count,space,cardWidth){
    const n=Math.max(0,Math.trunc(Number(count)||0));
    if(n<2)return 0;
    const spaceWidth=Math.max(1,Number(space)||1);
    const width=Math.max(1,Number(cardWidth)||1);
    const wanted=n>7?-28:-17;
    return Math.max(-width+34,Math.min(wanted,(spaceWidth-width*n)/(n-1)-4));
  }
  const api={fanPlan,overlapFor,storageKey:KEY};
  if(typeof module==='object'&&module.exports)module.exports=api;
  const doc=global.document;
  if(!doc||typeof doc.querySelector!=='function')return;
  let workspace=null,button=null,enabled=true,observer=null,resizeObserver=null,queued=false;
  function readPreference(){
    try{return global.localStorage?.getItem(KEY)!=='classic';}catch(_){return true;}
  }
  function savePreference(){try{global.localStorage?.setItem(KEY,enabled?'new':'classic');}catch(_){/* transient storage, still usable */}}
  function syncHand(){
    if(!workspace)return;
    const hand=doc.getElementById('myHand');
    if(hand){
      const cards=Array.from(hand.children).filter(el=>el.classList.contains('battle-card')&&el.classList.contains('hand'));
      const plan=fanPlan(cards.length);
      const cardWidth=cards[0]?.getBoundingClientRect?.().width||115;
      const overlap=overlapFor(cards.length,hand.clientWidth-30,cardWidth);
      cards.forEach((card,i)=>{
        card.style.setProperty('--mw13-fan-rot',plan[i].angle+'deg');
        card.style.setProperty('--mw13-fan-y',plan[i].y+'px');
        card.style.setProperty('--mw13-overlap',overlap+'px');
      });
    }
    const enemy=doc.getElementById('botHand');
    if(enemy){
      const backs=Array.from(enemy.children).filter(e=>e.tagName==='SPAN');
      const plan=fanPlan(backs.length,7);
      backs.forEach((back,i)=>{
        back.style.setProperty('--mw13-fan-rot',plan[i].angle+'deg');
        back.style.setProperty('--mw13-fan-y',plan[i].y+'px');
      });
    }
  }
  function schedule(){
    if(queued)return;
    queued=true;
    const raf=global.requestAnimationFrame||((fn)=>fn());
    raf(()=>{queued=false;syncHand();});
  }
  function applyMode(next,persist=true){
    enabled=!!next;
    workspace?.classList.toggle('mw13-2d-layout',enabled);
    if(button){
      button.setAttribute('aria-pressed',String(enabled));
      button.textContent=enabled?'▣ Поле: новое':'▣ Поле: классика';
      button.title='Переключить только оформление 2D-поля. Правила и текущая партия сохраняются.';
    }
    if(persist)savePreference();
    schedule();
    return enabled;
  }
  function init(){
    if(workspace)return;
    workspace=doc.getElementById('battleWorkspace');
    const actions=workspace?.querySelector('.battle-quick-actions');
    if(!workspace||!actions){workspace=null;return;}
    button=doc.getElementById('battleLayoutToggle');
    if(!button){
      button=doc.createElement('button');
      button.type='button';button.id='battleLayoutToggle';
      button.className='btn btn-outline';
      const art=doc.getElementById('battleArtToggle');
      if(art?.parentNode===actions)art.insertAdjacentElement('afterend',button);
      else actions.appendChild(button);
    }
    button.addEventListener('click',()=>applyMode(!enabled));
    if(typeof global.MutationObserver==='function'){
      observer=new global.MutationObserver(()=>schedule());
      for(const id of ['myHand','botHand']){
        const hand=doc.getElementById(id);
        if(hand)observer.observe(hand,{childList:true});
      }
    }
    if(typeof global.ResizeObserver==='function'){
      resizeObserver=new global.ResizeObserver(()=>schedule());
      const hand=doc.getElementById('myHand');if(hand)resizeObserver.observe(hand);
    }
    global.addEventListener?.('resize',schedule,{passive:true});
    applyMode(readPreference(),false);
  }
  Object.assign(api,{init,syncHand,applyMode,getState:()=>({enabled,ready:!!workspace})});
  global.MW_ARENA_V05S13=api;
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(typeof window!=='undefined'?window:globalThis);
