/* Reproducible development fixture; never changes card catalog or campaign progress. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.MW_COMBAT_QA=api;})(typeof window==='object'?window:globalThis,function(){
'use strict';
function build(E,R,catalog,decks){
 const C=new Map(catalog.map(c=>[c.cardId,c])),d=decks[0];
 const s=E.makeGame(d,d,C,{seed:758,firstPlayer:0,hour:12,heroProfiles:['demo-unlocked','ragvalod']});E.confirmMulligan(s,[]);E.setDeveloperMode(s,true);
 function command(type,owner,cardId,value){const result=E.debugAction(s,{type,owner,cardId,value,definition:C.get(cardId)});if(!result.ok)throw Error(result.reason);}
 command('summon',0,'KNZ-002');command('summon',1,'CHR-002');command('give',0,'KNZ-006');command('mana',0,null,10);
 const h=s.players[0].hand.find(h=>h.cardId==='KNZ-006');E.playCard(s,0,h.uid);E.endTurn(s,0);E.endTurn(s,1);command('mana',0,null,10);command('give',0,'NEU-043');
 if(!R.verify(R.exportReplay(s)).ok)throw Error('Fixture replay failed');return s;
}
return {build};
});
if(typeof document==='object')document.addEventListener('DOMContentLoaded',()=>{
 if(!document.getElementById('prepareCombatQA'))return;
 document.getElementById('prepareCombatQA').onclick=()=>{
  try{
   const E=window.MW_GAME_ENGINE,R=window.MW_BATTLE_REPLAY,s=window.MW_COMBAT_QA.build(E,R,window.MW_CANONICAL_CARDS,window.MW_APPROVED_EXAMPLE_DECKS);
   const old=localStorage.getItem('mw-active-battle-v2.0');if(old)localStorage.setItem('mw-previous-battle-v2.0',old);
   localStorage.setItem('mw-active-battle-v2.0',JSON.stringify(E.exportBattle(s)));
   document.getElementById('combatQAResult').textContent='Готово: тестовая партия, броня соперника 10, оружие 4/2. Откройте бой и нажмите «Продолжить».';
   document.getElementById('combatQAOpen').hidden=false;
  }catch(err){document.getElementById('combatQAResult').textContent='Ошибка: '+err.message;}
 };
});
