const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const portrait=require("../battle-minion-portrait-v05S14.js"),root=path.join(__dirname,"..");
const read=x=>fs.readFileSync(path.join(root,x),"utf8");
test("focal crop always covers the picture window",()=>{
 const p=portrait.coverPlacement(1200,800,{x:.48,y:.4,zoom:1});
 assert.ok(p.dx<=14&&p.dy<=12&&p.dx+p.dw>=242&&p.dy+p.dh>=277);
 assert.ok(p.dw>=228&&p.dh>=265);
 assert.equal(portrait.coverPlacement(0,0,null),null);
});
test("invalid and oversized crops are clamped",()=>{
 const p=portrait.coverPlacement(500,500,{x:99,y:-5,zoom:Infinity});
 assert.ok([p.dx,p.dy,p.dw,p.dh].every(Number.isFinite));
});
test("portrait renders real art without baked card text or stats",()=>{
 const calls=[],grad={addColorStop(){}};
 const g={save(){},restore(){},beginPath(){},ellipse(){},fill(){},stroke(){},clip(){},
  fillRect(){},createLinearGradient(){return grad;},drawImage(...args){calls.push(args);}};
 const cv={width:0,height:0,getContext(){return g;}};
 const doc={createElement(t){assert.equal(t,"canvas");return cv;}};
 const art={naturalWidth:960,naturalHeight:720};
 const result=portrait.render(doc,art,{x:.5,y:.5,zoom:1},null);
 assert.equal(result.width,256);assert.equal(result.height,304);
 assert.ok(calls.some(x=>x[0]===art));
 assert.equal(typeof g.fillText,"undefined");
});
test("only 2D battlefield uses new face; existing 3D and full cards retained",()=>{
 const renderer=read("battle-card-renderer-v2.1C.js"),bridge=read("battle-v05-card-bridge.js");
 assert.match(renderer,/mw3d-active/);assert.match(renderer,/boardPortrait2d/);
 assert.match(bridge,/view==="boardPortrait"/);
 assert.match(bridge,/MW14_BOARD_PORTRAIT/);
 assert.match(bridge,/drawLabels\(ctx,c,manifest,core\)/);
});
test("live battle values and taunt affinity come from engine model",()=>{
 const deck=read("deckgame.js"),css=read("battle-minion-v05S14.css");
 assert.match(deck,/eng\.effectiveAttack\(game,h\)/);
 assert.match(deck,/kind==="minion"\?h\.health/);
 assert.match(deck,/mw14-taunt/);assert.match(deck,/h\.affinity/);
 assert.match(css,/\.mw14-board-portrait \.bc-stats/);
 assert.match(css,/\.mw14-affinity/);
 assert.match(css,/#battleWorkspace:not\(\.mw3d-active\)/);
 assert.doesNotMatch(css,/\.battle-card\.hand/);
});
test("dependencies loaded before board and 3D untouched",()=>{
 const html=read("index.html");
 assert.ok(html.indexOf("battle-minion-v05S14.css")>html.indexOf("arena-layout-v05S13.css"));
 assert.ok(html.indexOf("battle-minion-portrait-v05S14.js")<html.indexOf("battle-v05-card-bridge.js"));
 assert.ok(html.indexOf("battle-minion-portrait-v05S14.js")<html.indexOf("deckgame.js"));
});
