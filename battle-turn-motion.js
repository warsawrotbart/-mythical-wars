/* T14–T17. Transient indicators never execute gameplay commands. */
(function(root){'use strict';
async function step(doc,p,{signal,apply}){
 if(signal.aborted)return;let text='';
 if(p.type==='turnStage'){apply(p.snapshot);if(p.stage==='ready')text=p.owner?'Ход соперника':'Ваш ход';}
 if(p.type==='clockAdvanced'){apply(p.snapshot);text=String(p.hour).padStart(2,'0')+':00 · '+root.MW_GAME_ENGINE.phaseOfHour(p.hour);}
 if(p.type==='cardDiscarded')text=p.reason==='overflow'?'Рука заполнена: карта сброшена':p.reason==='burn'?'Падпал: карта сброшена':'Карта сброшена';
 if(p.type==='fatigue')text='Пустая колода · усталость '+p.amount;
 if(p.type==='creatureReturned'){apply(p.snapshot);text='Существо возвращается в руку';}
 if(!text)return false;const status=doc.getElementById('mwTurnStatus');if(status)status.textContent=text;
 if(root.MW_MOTION_RUNTIME.reduced(doc))return true;
 const n=doc.createElement('div');n.className='mw-turn-banner';n.textContent=text;n.setAttribute('aria-hidden','true');doc.body.append(n);
 try{await root.MW_MOTION_RUNTIME.animate(n,[{opacity:0,transform:'translate(-50%,-10px)'},{opacity:1,transform:'translate(-50%,0)',offset:.25},{opacity:1,offset:.8},{opacity:0}],{signal,duration:p.type==='turnStage'?480:360});}finally{n.remove();}return true;
}
root.MW_TURN_MOTION={step};})(typeof window==='object'?window:globalThis);
