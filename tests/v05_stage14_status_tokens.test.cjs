/* MW v05.14 Stage 2: token portrait hydration and verified status UI. */
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const ui=require("../battle-minion-status-v05S14.js"),root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
test("engine and UI have exactly the same implemented deathrattle IDs",()=>{
 const engine=read("battle-engine.js");
 const source=engine.slice(engine.indexOf("function deathrattle(s,o,m){"),engine.indexOf("function friendlyDeath(s,o,m){"));
 const implemented=[...source.matchAll(/case\s+"([A-Z]{3}-\d{3})":/g)].map(m=>m[1]);
 assert.ok(implemented.length>=10);
 assert.deepEqual([...ui.DEATHRATTLE_IDS].sort(),implemented.sort());
});
test("known summoned tokens are resolved from engine TOKEN_DATA without adding them to game.cards",()=>{
 const eng=require("../battle-engine.js");
 const game={cards:{},players:[{board:[{uid:"t1",cardId:"TKN-001",token:true,name:"ДРУЖЫННІК",health:1,attack:1,affinity:"Дзень"}]},{board:[]}]};
 const u=ui.boardUnit(game,"0|t1");
 assert.equal(u.cardId,"TKN-001");
 const original=JSON.stringify(game);
 const c=ui.cardDefinition(game,u,eng.TOKEN_DATA);
 assert.equal(c.name,"ДРУЖЫННІК");
 assert.equal(c.cardType,"creature");assert.equal(c.timeAffinityId,"Дзень");
 assert.equal(JSON.stringify(game),original);
});
test("all seven library token IDs and unique hero-power summons get visual source without invented effects",()=>{
 const sample={cards:{},players:[]};
 for(let n=1;n<=7;n++){
  const id="TKN-"+String(n).padStart(3,"0");
  const c=ui.cardDefinition(sample,{cardId:id,token:true,name:id,attack:1,health:1},null);
  assert.equal(c.cardType,"creature");assert.equal(c.ability,"");
 }
 const special=ui.cardDefinition(sample,{cardId:"necro:idol",token:true,name:"ИДОЛ",attack:0,health:2,affinity:"Ноч"},null);
 assert.equal(special.name,"ИДОЛ");assert.equal(special.timeAffinityId,"Ноч");
 assert.equal(ui.cardDefinition(sample,{cardId:"UNKNOWN",token:false},null),null);
});
test("visible badges use only real combat flags and known implemented deathrattles",()=>{
 const active=ui.statusIcons({cardId:"CHR-002",charge:true,stealth:true,reborn:true,timed:[{kind:"frozen"}]});
 assert.deepEqual(active.map(s=>s.id),["deathrattle","charge","stealth","reborn","frozen"]);
 assert.deepEqual(ui.statusIcons({cardId:"KNZ-019",timed:[]}),[]);
 assert.deepEqual(ui.statusIcons({cardId:"TKN-001",token:true,timed:[]}),[]);
 assert.equal(ui.guardActive({taunt:true}),true);
 assert.equal(ui.guardActive({taunt:false}),false);
});
test("legacy, 3D and hand renderers preserved; 2D token sources included",()=>{
 const renderer=read("battle-card-renderer-v2.1C.js");
 const deck=read("deckgame.js");
 const css=read("battle-minion-v05S14.css");
 const html=read("index.html");
 assert.match(renderer,/MW14_BOARD_STATUS\?\.cardDefinition/);
 assert.match(renderer,/MW14_BOARD_STATUS\?\.boardUnit/);
 assert.match(renderer,/boardPortrait2d=kind==="compact"/);
 assert.match(deck,/MW14_BOARD_STATUS\?\.cardDefinition/);
 assert.match(deck,/mw14-deathrattle/);
 assert.match(deck,/mw14-guard-emblem/);
 assert.match(css,/mw14-guard-emblem/);
 assert.match(css,/mw14-deathrattle/);
 assert.doesNotMatch(css,/\.battle-card\.hand/);
 assert.ok(html.indexOf("battle-minion-status-v05S14.js")<html.indexOf("battle-card-renderer-v2.1C.js"));
 assert.ok(html.indexOf("battle-minion-status-v05S14.js")<html.indexOf("deckgame.js"));
});
