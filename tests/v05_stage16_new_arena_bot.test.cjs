/* MW v05.16 integration: fresh 2D, accessible 3D, slow bot and unchanged AI decisions. */
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8"),eng=require("../battle-engine.js");
test("3D action remains visible and old 2D layout control is not created",()=>{
 const html=read("index.html"),layout=read("arena-layout-v05S13.js"),three=read("arena-3d-v2.1H.js");
 assert.equal((html.match(/id="battle3DToggle"/g)||[]).length,1);
 assert.match(three,/const toggle=\$\("battle3DToggle"\)/);
 assert.match(html,/arena-3d-v2\.1H\.js\?v=0516/);
 assert.match(layout,/classList\.add\('mw13-2d-layout'\)/);
 assert.doesNotMatch(layout,/Поле: классика/);
 assert.doesNotMatch(layout,/setItem\(/);
});
test("2D refinements do not target WebGL 3D",()=>{
 const css=read("arena-v05S16.css");
 assert.match(css,/#battleWorkspace\.mw13-2d-layout:not\(\.mw3d-active\)/);
 assert.doesNotMatch(css,/#mw3dStage/);
 assert.match(css,/hand_player\.webp/);
 assert.match(read("arena-layout-v05S13.css"),/@media \(min-width:900px\)/);
});
test("opening hand and coin share one centered row without a panel frame",()=>{
 const css=read("arena-v05S16.css");
 for(const re of [/\.battle-mulligan-panel\{/,/flex-wrap:nowrap!important/,/justify-content:center!important/,/mulligan-card\[data-mulligan-card="__coin__"\]/,/\.battle-player \.battle-hand/])
   assert.match(css,re);
});
test("game card uses same curved heading as editor and a common number baseline",()=>{
 const html=read("index.html"),bridge=read("battle-v05-card-bridge.js");
 assert.ok(html.indexOf("v05-card-visual-polish.js")<html.indexOf("battle-v05-card-bridge.js"));
 assert.match(bridge,/arc\.drawCurvedTitle/);
 assert.match(bridge,/\["attack","health","durability"\]/);
 assert.match(bridge,/bottom\?1400:baseY/);
 assert.match(bridge,/actualBoundingBoxLeft/);
});
test("hero mana counter uses live game data and the 2D layer can move it",()=>{
 const html=read("index.html"),deck=read("deckgame.js");
 assert.match(html,/id="battleManaValue"/);
 assert.match(html,/id="battleManaCounter"/);
 assert.match(deck,/battleManaValue"\)\.textContent=me\.mana\+"\/"\+me\.maxMana/);
 assert.match(read("arena-v05S16.css"),/\.mw16-mana-counter/);
});
test("stepwise bot and synchronous bot produce identical deterministic state",()=>{
 const definition={cardId:"KNZ-019",name:"ФАКЕЛЬШЧЫК ДРУЖЫНЫ",cardType:"creature",costValue:2,attack:2,health:3,classId:"Воин",rarityId:"common",timeAffinityId:"Дзень",creatureTypeId:"Чалавек",subtype:"Дружыннік",ability:""};
 const deck={classId:"Воин",name:"Проверка",counts:{"KNZ-019":10}};
 const source=eng.makeGame(deck,deck,{"KNZ-019":definition},{firstPlayer:1,seed:12345,hour:12,timeMode:"off"});
 source.phase="battle";source.turn=1;source.players[1].mana=7;source.players[1].maxMana=7;
 const regular=JSON.parse(JSON.stringify(source)),paced=JSON.parse(JSON.stringify(source));
 const result=eng.runBotTurn(regular,1);
 const steps=eng.botTurnFrames(paced,1);
 let next=steps.next(),actions=[];
 while(!next.done){actions.push(next.value);next=steps.next();}
 assert.deepEqual(next.value,result);
 assert.deepEqual(actions,result.actions);
 assert.deepEqual(paced,regular);
 assert.ok(actions.some(x=>x.type==="play"));
});
test("bot animation is paced without autosaving on each frame",()=>{
 const deck=read("deckgame.js"),css=read("arena-v05S16.css");
 assert.match(deck,/eng\.botTurnFrames\?\.\(snapshot,1\)/);
 assert.match(deck,/await pause\(1350\)/);
 assert.match(deck,/renderGame\(\{save:false\}\)/);
 assert.match(deck,/snapshot===game/);
 assert.match(css,/mw16-bot-action/);
});
