/* Mythical Wars v05.13 Stage B: layout-only helper for real battle hand and rollback.
 * Reads hand nodes, adds CSS custom properties to them. It never mutates the game
 * model, card content, event handlers, card IDs, or 3D render objects.
 */
(function(global){
  'use strict';
  // Only the new 2D battlefield remains available; WebGL 3D is separate.
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
  const api={fanPlan,overlapFor};
  if(typeof module==='object'&&module.exports)module.exports=api;
  const doc=global.document;
  if(!doc||typeof doc.querySelector!=='function')return;
  let workspace=null,enabled=true,observer=null,resizeObserver=null,queued=false;
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
  function applyMode(){
    enabled=true;
    workspace?.classList.add('mw13-2d-layout');
    schedule();
    return true;
  }
  function init(){
    if(workspace)return;
    workspace=doc.getElementById('battleWorkspace');    if(!workspace)return;
    doc.getElementById('battleLayoutToggle')?.remove?.();
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
    applyMode();
  }
  Object.assign(api,{init,syncHand,applyMode,getState:()=>({enabled,ready:!!workspace})});
  global.MW_ARENA_V05S13=api;
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(typeof window!=='undefined'?window:globalThis);
