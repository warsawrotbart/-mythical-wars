/* T04 isolated, deterministic motion fixture calculated entirely by the game engine. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MW_MOTION_SCENARIO=api;})(typeof window==='object'?window:globalThis,function(){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
function build(engine,cards,decks,presentation){
 const catalog=new Map(cards.map(c=>[c.cardId,c])),deck=decks.find(d=>d.classId==='Воин');
 if(!deck)throw Error('Approved warrior deck is missing');
 const plain=catalog.get('KNZ-002');
 if(!plain||plain.costValue!==1||plain.attack!==1||plain.health!==2||plain.ability||plain.keywords)
  throw Error('Motion fixture needs review against the current KNZ-002 definition');
 let game,attackerUid,defenderUid,playUid,startCommand;
 const seed=758; // fixed, reviewed canonical fixture; never search/re-roll during playback
 const requireOk=r=>{if(!r?.ok)throw Error(r?.reason||'Fixture command failed');};
 {
  const s=engine.makeGame(deck,deck,catalog,{seed,firstPlayer:0,hour:10,timeMode:'off'});
  requireOk(engine.confirmMulligan(s,[]));
  const first=s.players[0].hand.find(h=>h.cardId==='KNZ-002');if(!first)throw Error('Opening fixture changed; review seed 758');
  requireOk(engine.playCard(s,0,first.uid));requireOk(engine.endTurn(s,0));
  const opposing=s.players[1].hand.find(h=>h.cardId==='KNZ-002');if(!opposing)throw Error('Opponent fixture changed; review seed 758');
  requireOk(engine.playCard(s,1,opposing.uid));
  const before=copy(s);requireOk(engine.endTurn(s,1));
  const next=s.players[0].hand.find(h=>h.cardId==='KNZ-002');if(!next)throw Error('Second turn fixture changed; review seed 758');
  game=s;attackerUid=s.players[0].board[0].uid;defenderUid=s.players[1].board[0].uid;playUid=next.uid;
  startCommand={before,after:copy(s)};
 }
 if(!game)throw Error('No valid deterministic fixture found');
 const view=s=>presentation.publicView(s,0),scenes=[];
 const scene=(id,label,timing,state,extra={})=>scenes.push({id,label,timing,state:view(state),...extra});
 const drawn=startCommand.after.players[0].hand.filter(h=>!startCommand.before.players[0].hand.some(x=>x.uid===h.uid));
 if(drawn.length!==1)throw Error('Fixture must draw exactly one card');
 const drawnCard=game.cards[drawn[0].cardId],playedCard=game.cards['KNZ-002'];
 scene('turn','Ваш ход','turnBanner',startCommand.before,{reference:'R02 · 00:44–00:49'});
 scene('draw-reveal','Добор: показать карту','drawReveal',startCommand.before,{card:drawnCard,reference:'R02 · 00:44–00:49'});
 scene('draw-travel','Добор: в руку','drawTravel',startCommand.before,{card:drawnCard,commit:view(startCommand.after)});
 const beforePlay=copy(game);requireOk(engine.playCard(game,0,playUid));const afterPlay=copy(game);
 const added=game.players[0].board.find(m=>m.uid!==attackerUid);
 scene('lift','Выбор и подъём','playLift',beforePlay,{card:playedCard,handUid:playUid,reference:'R03 · 01:03–01:11'});
 scene('play','Карта к полю','playTravel',beforePlay,{card:playedCard,handUid:playUid,commit:view(afterPlay),reference:'R05 · 01:58–02:00'});
 scene('summon','Появление овала','summon',afterPlay,{unitUid:added.uid});
 const beforeAttack=copy(game),eventStart=game.events.length;
 requireOk(engine.attack(game,0,attackerUid,{kind:'minion',owner:1,uid:defenderUid}));const afterAttack=copy(game);
 const raw=game.events.slice(eventStart).filter(e=>e.kind==='damage');
 // This fixture has exactly two known minions, no auras/armor/shields/overkill.
 // Do not turn this mapping of known targets into a generic damage adapter.
 if(raw.length!==2||raw.some(e=>e.amount!==1)||new Set(raw.map(e=>e.actor)).size!==2)
  throw Error('Damage fixture changed; do not infer visual numbers');
 const damage=raw.map(e=>({owner:e.actor,uid:e.actor===0?attackerUid:defenderUid,amount:e.amount}));
 for(const [id,label,timing,state]of [['prepare','Подготовка атаки','attackPrepare',beforeAttack],['lunge','Рывок','attackLunge',beforeAttack],['impact','Контакт: общий пакет урона','contact',afterAttack],['return','Возврат','attackReturn',afterAttack],['numbers','Прочитать результат','numbers',afterAttack]])
  scene(id,label,timing,state,{attackerUid,defenderUid,damage,reference:'R09 · 03:05–03:06'});
 const beforeEnd=copy(game);requireOk(engine.endTurn(game,0));const afterEnd=copy(game);
 scene('end','Завершение хода','endBanner',beforeEnd);
 scene('hour','Один игровой час','hourStep',beforeEnd,{commit:view(afterEnd),oldHour:beforeEnd.time,newHour:afterEnd.time});
 scene('opponent','Ход соперника','opponentBanner',afterEnd);
 return {version:1,seed,scenes,initial:view(startCommand.before),final:view(afterEnd),
  fixture:{cardId:'KNZ-002',attackerUid,defenderUid,playUid,mode:'off',source:'approved example warrior decks; engine-only setup'},
  outcome:{ownMana:afterEnd.players[0].mana,enemyHealth:afterEnd.players[1].health,ownBoard:afterEnd.players[0].board.map(m=>({uid:m.uid,health:m.health})),hour:afterEnd.time,turn:afterEnd.turn}};
}
return {build};
});
