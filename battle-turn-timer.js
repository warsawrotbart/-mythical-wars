/* T14. Optional encounter timer; never enters game RNG or replay. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.MW_TURN_TIMER=api;})(typeof window==='object'?window:globalThis,function(){
'use strict';
function create({durationMs=0,now=()=>performance.now()}={}){
 let duration=durationMs===90000?90000:0,remaining=duration,token=null,stamp=now(),running=false,expired=false;
 function account(){const time=now();if(running)remaining=Math.max(0,remaining-Math.max(0,time-stamp));stamp=time;}
 return {sync(turnToken,active){account();if(turnToken!==token){token=turnToken;remaining=duration;expired=false;}running=!!active&&duration>0&&!expired;return remaining;},
 claimExpiry(){account();if(!duration||remaining>0||expired)return false;expired=true;running=false;return true;},
 save(){account();return {version:1,durationMs:duration,remainingMs:remaining,token,expired};},
 restore(v){if(!v||v.version!==1||![0,90000].includes(v.durationMs)||!Number.isFinite(v.remainingMs)||v.remainingMs<0||v.remainingMs>v.durationMs||typeof v.token!=='string')return false;
 duration=v.durationMs;remaining=v.remainingMs;token=v.token;expired=false;running=false;stamp=now();return true;},
 get remaining(){account();return remaining;},get enabled(){return duration>0;}};
}
return {create};});
