/* Shared motion defaults. Proposed presentation timing, never gameplay rules. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MW_BATTLE_MOTION=api;})(typeof window==='object'?window:globalThis,function(){
'use strict';
const DEFAULTS=Object.freeze({playerPlay:260,opponentReveal:700,attack:320,heroPower:260,
 turnBanner:600,drawReveal:420,drawTravel:240,playLift:180,playTravel:320,summon:180,
 attackPrepare:100,attackLunge:140,contact:100,attackReturn:180,numbers:620,endBanner:320,hourStep:520,opponentBanner:600});
function config(input={}){const result={};for(const[key,value]of Object.entries(DEFAULTS)){
 const n=Number(input[key]);result[key]=Number.isFinite(n)&&n>=0&&input[key]!==''?Math.round(Math.min(3000,n)):value;
 }return result;}
function duration(key,settings=DEFAULTS,{speed=1,reduced=false}={}){
 const base=config(settings)[key];if(base===undefined)throw Error('Unknown motion parameter');
 if(reduced)return ['attackPrepare','attackLunge','attackReturn','playLift','playTravel','drawTravel'].includes(key)?0:Math.min(base,100);
 const rate=Number.isFinite(+speed)&&+speed>0?Math.max(.25,Math.min(4,+speed)):1;
 return Math.round(base/rate);
}
function timeline(scenes,settings=DEFAULTS,options={}){let total=0;return scenes.map(scene=>{const ms=duration(scene.timing,settings,options),start=total;total+=ms;return {...scene,start,end:total,duration:ms};});}
function sample(track,ms){const total=track.at(-1)?.end||0,time=Math.max(0,Math.min(total,Number(ms)||0));
 let index=track.findIndex(s=>s.end>time);if(index<0)index=Math.max(0,track.length-1);
 const scene=track[index];return {index,scene,time,total,progress:scene?.duration?Math.min(1,Math.max(0,(time-scene.start)/scene.duration)):1,finished:time>=total};}
return {DEFAULTS,config,duration,timeline,sample};
});
