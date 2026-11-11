const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.resolve(__dirname,'..');
const read=x=>fs.readFileSync(path.join(dir,x),'utf8');
test('3D uses shared 2D clock art assets for its clock face and twelve markers',()=>{
  const html=read('arena-3d-v2.1H.js'),css=read('ui-refactor-v2.1J.css');
  assert.match(html,/id="mw3dMarks"/);
  assert.match(html,/class="mw-art-clock-pointer"/);
  for(const name of ['clock_frame.webp','clock_day_dial.webp','clock_night_dial.webp','clock_day_on.webp','clock_day_off.webp','clock_night_on.webp','clock_night_off.webp','clock_pointer.webp']){
    assert.ok(fs.existsSync(path.join(dir,'arena-art',name)),name);
    assert.ok(css.includes(name),name);
  }
});
test('3D uses board-anchored hero/deck information and compact turn button',()=>{
 const src=read('arena-3d-v2.1H.js');
 assert.match(src,/function positionHUD\(\)/);
 assert.match(src,/id="mw3dMyDeckCount"/);
 assert.match(src,/id="mw3dEnemyDeckCount"/);
 assert.match(src,/id="mw3dMyMana"/);
 assert.match(src,/id="mw3dEnemyCorpses"/);
 assert.match(src,/id="mw3dMyGrave"/);
 assert.match(src,/id="mw3dPower"/);
 assert.match(src,/Завершить<br>ход/);
 assert.doesNotMatch(src,/Завершить ход\s*→/);
});
test('inspector only holds complete rendered card, not enlarged standalone illustration',()=>{
 const html=read('index.html'),renderer=read('battle-card-renderer-v2.1C.js');
 assert.match(html,/id="battleInspectTemplate"/);
 assert.doesNotMatch(html,/id="battleInspectArt"/);
 assert.match(renderer,/function hydrateInspect/);
 assert.match(renderer,/item\.cardId==="__coin__"\?global\.MW_SYS001_COIN\?\.definition\(\)/);
});
test('mulligan renders actual card images and keeps coin unreplaceable',()=>{
 const src=read('deckgame.js');
 assert.match(src,/class="mulligan-card/);
 assert.match(src,/renderer\.request\(c,"full"/);
 assert.match(src,/coin\?"disabled":""/);
});
test('new typography and title banner match description panel width',()=>{
 const src=read('editor-layout-v2.1F.js');
 assert.match(src,/x:155,y:925,w:714,h:215/);
 assert.match(src,/x:155,y:1156,w:714,h:232/);
 assert.match(src,/size:51,color:"#35271d"/);
 const html=read('index.html');
 assert.match(html,/ui-refactor-v2\.1J\.css/);
});
