/* v05.14 Stage 3–6 — presentation + engine-safe drag test contracts. */
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const ui=require("../battle-hand-v05S14.js");
const root=path.resolve(__dirname,".."),read=f=>fs.readFileSync(path.join(root,f),"utf8");
test("hand glow only when engine authorizes playing",()=>{
 const s={phase:"battle",turn:0,players:[{hand:[{uid:"A",cardId:"KNZ-019"}]}]};
 const engine={actionStatus:(_,owner,uid)=>({ok:owner===0&&uid==="A",targetType:null})};
 assert.equal(ui.statusFor(s,"A",engine).ok,true);
 assert.equal(ui.statusFor(s,"Z",engine).ok,false);
 assert.equal(ui.statusFor(s,"A",engine,true).ok,false);
 s.turn=1;assert.equal(ui.statusFor(s,"A",engine).ok,false);
 s.turn=0;s.phase="mulligan";assert.equal(ui.statusFor(s,"A",engine).ok,false);
});
test("targeted and choice cards derive readiness from engine status",()=>{
 const s={phase:"battle",turn:0,players:[{hand:[{uid:7}]}]};
 assert.deepEqual(ui.statusFor(s,7,{actionStatus:()=>({ok:true,targetType:"enemy-minion",choice:{steps:[]}})}),
 {ok:true,reason:"",targetType:"enemy-minion",choice:true});
 assert.equal(ui.statusFor(s,7,{actionStatus:()=>({ok:false,reason:"Недостаточно маны."})}).ok,false);
});
test("hover preview is clamped to main even for far-left and far-right cards",()=>{
 const main={left:100,top:100,width:980,height:550};
 for(const left of [-600,120,950,2700]){
  const v=ui.previewBounds({left,top:510,width:115,height:170},main);
  assert.ok(v.left>=6&&v.left+v.width<=main.width+1);
  assert.ok(v.top>=6&&v.top+v.height<=main.height+1);
  assert.ok(v.width>100&&v.height>150);
 }
});
test("2D hand opacity, hover preview, green, drop and reduced motion are isolated",()=>{
 const css=read("battle-hand-v05S14.css");
 assert.match(css,/\.battle-card\.hand\.disabled/);
 assert.match(css,/opacity:1!important/);
 assert.match(css,/\.mw14-can-play/);
 assert.match(css,/\.mw14-hand-preview/);
 assert.match(css,/\.mw14-legal-drop/);
 assert.match(css,/\.mw14-new-summon/);
 assert.match(css,/prefers-reduced-motion/);
 assert.doesNotMatch(css,/#battleWorkspace\.mw3d-active \.battle-card\.hand\{/);
});
test("deckgame uses engine validation for availability and drop rather than new rules",()=>{
 const deck=read("deckgame.js"),rules=read("battle-drag-rules-v2.1B.js");
 assert.match(deck,/MW14_HAND_UI\?\.live\?\.render\(game/);
 assert.match(deck,/MW_BATTLE_DRAG_RULES\?\.plan/);
 assert.match(deck,/mw14-legal-drop/);
 assert.match(deck,/MW14_HAND_UI\?\.live\?\.dragStarted/);
 assert.match(rules,/eng\.actionStatus/);
 assert.match(rules,/eng\.eligibleAttackTargets/);
 assert.match(rules,/t\.kind==="frozen"/);
});
test("load order: hand module after renderer and before deckgame, 3D remains isolated",()=>{
 const html=read("index.html");
 assert.ok(html.indexOf('battle-hand-v05S14.js')>html.indexOf('battle-card-renderer-v2.1C.js'));
 assert.ok(html.indexOf('battle-hand-v05S14.js')<html.indexOf('deckgame.js'));
 assert.ok(html.indexOf('battle-hand-v05S14.css')>html.indexOf('arena-layout-v05S13.css'));
 assert.match(html,/arena-3d-v2\.1H\.js/);
});
