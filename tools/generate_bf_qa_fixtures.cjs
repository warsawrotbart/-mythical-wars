'use strict';
// Disposable developer-mode matches, imported through the existing save UI.
// Never updates production cards, decks, rules, progress or editor data.
const fs=require('node:fs'),path=require('node:path');
global.window=global;require('../card-catalog.js');
const E=require('../battle-engine.js');
const cards=new Map(global.MW_CANONICAL_CARDS.map(c=>[c.cardId,c]));
const output=process.argv[2];if(!output)throw Error('Pass an explicit output directory');
fs.mkdirSync(output,{recursive:true});
for(const [name,hour,count,handSize] of [['day-full',12,7,10],['night-empty',0,0,1],['interaction',17,6,4]]){
  const decks=global.MW_APPROVED_EXAMPLE_DECKS;
  const g=E.makeGame(decks[0],decks[0],cards,{seed:42,firstPlayer:0,hour,heroProfiles:['demo-unlocked','demo-unlocked']});
  E.confirmMulligan(g,[]);E.setDeveloperMode(g,true);g.cards=Object.fromEntries(cards);
  g.debugged=true;
  for(const [owner,p] of g.players.entries()){
    p.board=[];p.hand=[];p.mana=10;p.maxMana=10;p.health=owner?23:27;p.armor=owner?3:5;
    for(let i=0;i<count;i++)E.debugAction(g,{type:'summon',owner,cardId:'KNZ-002',definition:cards.get('KNZ-002')});
    const ids=owner?['KNZ-002','KNZ-002','KNZ-002']:Array.from({length:handSize},(_,i)=>i===0?'KNZ-006':i===1?'__coin__':'KNZ-002');
    for(const id of ids)p.hand.push({uid:'qa-'+(++g.serial),cardId:id,costAdjustment:0});
    if(name==='night-empty'&&owner===0)p.deck=[];
  }
  const file=path.join(output,name+'.json');fs.writeFileSync(file,JSON.stringify(E.exportBattle(g)));console.log(file);
}
