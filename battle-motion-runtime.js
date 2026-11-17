/* T18–T20. Viewport CSS pixels, bounded cancelable work and resource lifetime. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.MW_MOTION_RUNTIME=api;})(typeof window==='object'?window:globalThis,function(){
'use strict';
let reduceOverride=false;
function reduced(doc){return !!(doc?.hidden||reduceOverride||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);}
function setReduced(v){reduceOverride=v===true;if(globalThis.document)globalThis.document.documentElement.dataset.mwReduced=String(reduceOverride);}
try{setReduced(globalThis.localStorage?.getItem('mw-reduce-motion')==='true');}catch(_){}
const MAX_ANIMATIONS=32,active=new Set();let peak=0,skipped=0;
const resources=Object.freeze([
 ['MW-FX-01','contour','battle-hand-v05S14.css','.mw14-hovered',9800,'CSS border'],
 ['MW-FX-02','target','battle-combat-motion.css','#mw6Aim',9800,'static line'],
 ['MW-FX-03','contact','battle-combat-motion.js','frames',10100,'brightness only'],
 ['MW-FX-04','summon','battle-hand-motion.js','fly',10000,'instant reconcile'],
 ['MW-FX-05','numbers','battle-combat-motion.css','.mw6-number',12000,'journal text'],
 ['MW-FX-06','turn','battle-turn-motion.css','.mw-turn-banner',12000,'live status'],
 ['MW-FX-07','weapon','battle-combat-motion.js','weaponChanged',8,'static slot'],
 ['MW-FX-08','clock','battlefield-v02.js','renderClock',3,'instant pointer'],
 ['MW-FX-09','reveal','battle-combat-motion.js','reveal',10100,'public card text']
].map(([id,kind,source,entry,layer,lightweight])=>Object.freeze({id,version:1,kind,source,entry,layer,lightweight,pivot:[.5,.5],alpha:'CSS/DOM transparency; clock preserves approved PNG alpha',coordinates:'viewport CSS pixels; clock local 1920x1080'})));
function fitRect(r,width,height,margin=8){const scale=Math.min(1,Math.max(1,width-2*margin)/Math.max(1,r.width),Math.max(1,height-2*margin)/Math.max(1,r.height)),w=r.width*scale,h=r.height*scale;
 return {width:w,height:h,left:Math.max(margin,Math.min(r.left,width-margin-w)),top:Math.max(margin,Math.min(r.top,height-margin-h))};}
function resource(promise,signal,timeoutMs=1500){return new Promise(resolve=>{
 let done=false,timer;const finish=v=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);resolve(v);},abort=()=>finish(null);
 if(signal?.aborted)return finish(null);signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(abort,timeoutMs);Promise.resolve(promise).then(finish,abort);
});}
function animate(node,keyframes,{signal,duration=280,easing='ease-out',hold=false}={}){
 if(!node?.animate||signal?.aborted||reduced(node.ownerDocument))return Promise.resolve(null);
 if(active.size>=MAX_ANIMATIONS){skipped++;return Promise.resolve(null);}let a;
 try{a=node.animate(keyframes,{duration,easing,fill:hold?'forwards':'none'});}catch(_){return Promise.resolve(null);}
 active.add(a);peak=Math.max(peak,active.size);const stop=()=>a.cancel();signal?.addEventListener('abort',stop,{once:true});
 return a.finished.catch(()=>{}).then(()=>{active.delete(a);signal?.removeEventListener('abort',stop);if(!hold||signal?.aborted)a.cancel();return a;});
}
function cancelAll(){for(const a of active)a.cancel();active.clear();}
return {resources,fitRect,resource,reduced,setReduced,animate,cancelAll,MAX_ANIMATIONS,metrics:()=>({active:active.size,peak,skipped,limit:MAX_ANIMATIONS})};});
