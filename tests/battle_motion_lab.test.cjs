'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
global.window=global;require('../card-catalog.js');
const E=require('../battle-engine.js'),P=require('../battle-presentation.js'),M=require('../battle-motion-config.js'),S=require('../battle-motion-scenario.js');
const build=()=>S.build(E,MW_CANONICAL_CARDS,MW_APPROVED_EXAMPLE_DECKS,P);
test('complete turn fixture uses legal engine commands and approved decks without mutating catalog',()=>{
 const before=JSON.stringify([MW_CANONICAL_CARDS,MW_APPROVED_EXAMPLE_DECKS]),s=build();
 assert.equal(s.seed,758);assert.equal(s.scenes.length,14);assert.equal(s.outcome.turn,1);assert.equal(s.outcome.hour,13);
 assert.deepEqual(s.outcome.ownBoard.map(x=>x.health),[1,2]);assert.equal(s.final.players[1].board[0].health,1);
 assert.equal(JSON.stringify([MW_CANONICAL_CARDS,MW_APPROVED_EXAMPLE_DECKS]),before);
 assert.deepEqual(build(),s);
});
test('fixture shows one ordinary draw, a played instance, and one simultaneous damage packet',()=>{
 const s=build(),draw=s.scenes.find(x=>x.id==='draw-travel'),impact=s.scenes.find(x=>x.id==='impact');
 assert.equal(draw.commit.players[0].handCount,draw.state.players[0].handCount+1);
 assert.equal(draw.commit.players[0].deckCount,draw.state.players[0].deckCount-1);
 assert.deepEqual(impact.damage.map(x=>x.amount),[1,1]);assert.equal(new Set(impact.damage.map(x=>x.uid)).size,2);
 assert.equal(s.scenes.find(x=>x.id==='hour').newHour,s.scenes.find(x=>x.id==='hour').oldHour+1);
});
test('seeking and speed/reduced motion only sample snapshots, never execute the engine again',()=>{
 const s=build(),before=JSON.stringify(s);
 for(const speed of [.25,.75,1,1.5,4])for(const reduced of [false,true]){
  const track=M.timeline(s.scenes,M.DEFAULTS,{speed,reduced}),total=track.at(-1).end;
  for(const time of [0,total*.5,total,0,total*.8]){
   const sample=M.sample(track,time);assert.ok(sample.index>=0);assert.ok(sample.progress>=0&&sample.progress<=1);
  }
  assert.deepEqual(M.sample(track,total).scene.state,s.final);
 }
 assert.equal(JSON.stringify(s),before);
});
test('timeline has continuous ordered intervals and stable phase addressing at boundaries',()=>{
 const s=build(),track=M.timeline(s.scenes);let end=0;
 for(let i=0;i<track.length;i++){
  assert.equal(track[i].start,end);end=track[i].end;assert.equal(M.sample(track,track[i].start).index,i);
 }
 assert.equal(M.sample(track,-100).time,0);assert.equal(M.sample(track,end+999).time,end);
 assert.equal(M.sample(track,end).finished,true);
});
test('parameter normalization handles invalid and zero durations without infinite playback',()=>{
 assert.equal(M.config({drawTravel:-10}).drawTravel,M.DEFAULTS.drawTravel);
 assert.equal(M.config({drawTravel:9000}).drawTravel,3000);
 assert.equal(M.config({drawTravel:'invalid'}).drawTravel,M.DEFAULTS.drawTravel);
 const s=build(),zero=Object.fromEntries(Object.keys(M.DEFAULTS).map(k=>[k,0])),track=M.timeline(s.scenes,zero);
 assert.equal(M.sample(track,0).finished,true);assert.deepEqual(M.sample(track,0).scene.state,s.final);
 assert.equal(M.duration('attackLunge',M.DEFAULTS,{reduced:true}),0);
 assert.throws(()=>M.duration('unknown'),/Unknown/);
});
test('public motion snapshots contain no opponent hand/deck contents, RNG, or replay',()=>{
 const s=build();for(const scene of s.scenes){
  assert.equal(scene.state.players[1].hand,null);assert.equal(scene.state.players[1].deck,undefined);
  assert.equal(scene.state.randomState,undefined);assert.equal(scene.state.battleReplay,undefined);
 }
});
test('changed card definition stops the fixture instead of silently inventing numbers',()=>{
 const cards=MW_CANONICAL_CARDS.map(c=>c.cardId==='KNZ-002'?{...c,attack:9}:c);
 assert.throws(()=>S.build(E,cards,MW_APPROVED_EXAMPLE_DECKS,P),/needs review/);
});
