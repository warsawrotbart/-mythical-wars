'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
global.window=global;
require('../card-catalog.js');
const E=require('../battle-engine.js');
const cards=new Map(global.MW_CANONICAL_CARDS.map(c=>[c.cardId,c]));
function fixture(hour=12){
  const decks=global.MW_APPROVED_EXAMPLE_DECKS;
  const g=E.makeGame(decks[0],decks[0],cards,{seed:42,firstPlayer:0,hour,heroProfiles:['demo-unlocked','demo-unlocked']});
  E.confirmMulligan(g,[]);E.setDeveloperMode(g,true);
  g.cards=Object.fromEntries(cards);
  for(const p of g.players){p.board=[];p.hand=[];p.mana=10;p.maxMana=10;}
  return g;
}
function give(g,id,owner=0){
  const h={uid:'qa-'+(++g.serial),cardId:id,costAdjustment:0};g.players[owner].hand.push(h);return h;
}
function summon(g,owner,n){
  for(let i=0;i<n;i++)assert.equal(E.debugAction(g,{type:'summon',owner,cardId:'KNZ-002',definition:cards.get('KNZ-002')}).ok,true);
}
test('BF-02: both full sides reject the eighth before spending a card or mana',()=>{
  for(const owner of [0,1]){
    const g=fixture();g.turn=owner;summon(g,owner,7);
    const h=give(g,'KNZ-002',owner),before=JSON.stringify(E.exportBattle(g).game);
    assert.equal(E.playCard(g,owner,h.uid).ok,false);
    assert.equal(JSON.stringify(E.exportBattle(g).game),before);
    assert.equal(E.heroPowerStatus(g,owner).ok,false);
  }
});
test('BF-02: multi-token summon only fills remaining places to seven',()=>{
  const g=fixture();summon(g,0,6);const h=give(g,'KNZ-019');
  assert.equal(E.playCard(g,0,h.uid).ok,true);assert.equal(g.players[0].board.length,7);
});
test('BF-05: actual weapon play, attacks and breaking update live weapon state',()=>{
  const g=fixture(),h=give(g,'KNZ-006');
  assert.equal(E.playCard(g,0,h.uid).ok,true);
  const p=g.players[0],durability=p.weapon.durability;
  assert.ok(durability>0);
  assert.equal(E.attack(g,0,null,{kind:'hero',owner:1},true).ok,true);
  assert.equal(p.weapon?.durability??0,durability-1);
  while(p.weapon){E.endTurn(g,0);E.endTurn(g,1);assert.equal(E.attack(g,0,null,{kind:'hero',owner:1},true).ok,true);}
  assert.equal(p.weapon,null);
});
test('BF-06/07: power phase switches without resetting use, clock advances once',()=>{
  for(const hour of [5,17,23]){
    const g=fixture(hour);g.players[0].heroPowerUsed=true;
    assert.equal(E.endTurn(g,0).ok,true);assert.equal(g.time,(hour+1)%24);
    assert.equal(g.players[0].heroPowerUsed,true);
    assert.equal(E.heroPowerStatus(g,0).used,true);
  }
});
test('BF-08: coin gives the eleventh mana only temporarily',()=>{
  const g=fixture(),p=g.players[0],h=give(g,'__coin__');
  assert.equal(E.playCard(g,0,h.uid).ok,true);assert.equal(p.mana,11);assert.equal(p.maxMana,10);
  E.endTurn(g,0);E.endTurn(g,1);assert.equal(p.mana,10);assert.equal(p.maxMana,10);
});
test('BF-09/11: ten-card hand rejects an additional developer give; empty deck draws fatigue',()=>{
  const g=fixture();for(let i=0;i<10;i++)give(g,'KNZ-002');
  assert.equal(E.debugAction(g,{type:'give',owner:0,cardId:'KNZ-002',definition:cards.get('KNZ-002')}).ok,false);
  g.players[0].deck=[];const health=g.players[0].health;E.draw(g,0);
  assert.equal(g.players[0].deck.length,0);assert.equal(g.players[0].health,health-1);
});
