'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
test('BF layout fixes are wired after battlefield v02 and after game re-render',()=>{
  const html=read('index.html'),battle=read('deckgame.js');
  assert.match(html,/href="battlefield-layout-fixes-v01\.css\?v=0522"/);
  assert.match(html,/src="battlefield-layout-fixes-v01\.js\?v=0521"/);
  assert.ok(html.indexOf('battlefield-v02.css')<html.indexOf('battlefield-layout-fixes-v01.css'));
  assert.ok(html.indexOf('battlefield-v02.js')<html.indexOf('battlefield-layout-fixes-v01.js'));
  assert.match(battle,/MW_BATTLEFIELD_V02\?\.render\(game\);\s*window\.MW_BF_LAYOUT_FIXES\?\.render\(game\)/);
});
test('BF-01/11 clip off-canvas hands and scale preview coordinates exactly once',()=>{
  const css=read('battlefield-layout-fixes-v01.css');
  assert.match(css,/\.battle-main\{\s*overflow:hidden!important/);
  const hand=require('../battle-hand-v05S14.js');
  for(const scale of [0.5,768/1080,1,4/3]){
    const main={left:90,top:60,width:1920*scale,height:1080*scale};
    const card={left:main.left+900*scale,top:main.top+958*scale,width:120*scale,height:180*scale};
    const screen=hand.previewBounds(card,main);
    const local=hand.previewLocalBounds(card,main,1920,1080);
    for(const key of ['left','top','width','height'])assert.ok(Math.abs(local[key]*scale-screen[key])<1e-7,key);
    assert.ok(local.left>=0&&local.top>=0);
    assert.ok(local.left+local.width<=1920&&local.top+local.height<=1080);
  }
});
test('BF-10 settings retain all actions without inherited minimum-width overflow',()=>{
  const css=read('battlefield-layout-fixes-v01.css');
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.battle-top-controls>label,[\s\S]*?min-width:0!important/);
  assert.match(css,/width:min\(340px,calc\(100vw - 18px\)\)/);
});
test('BF-02 keeps 1176 width and max seven and removes old seating slots',()=>{
  const js=read('battlefield-v02.js'),css=read('battlefield-layout-fixes-v01.css');
  assert.match(js,/BOARD_WIDTH=1176,MAX_CREATURES=7/);
  assert.match(css,/#botBoard\.board-empty/);
  assert.match(css,/#myBoard\.board-empty/);
  assert.match(css,/background-image:none!important/);
});
test('BF-03..BF-09 bind approved hero HUD, phase art, clock and deck backs',()=>{
  const css=read('battlefield-layout-fixes-v01.css'),js=read('battlefield-layout-fixes-v01.js');
  assert.match(css,/\.hero-identity\{/);
  assert.match(css,/weapon_frame\.png/);
  assert.match(js,/stage\.appendChild\(clock\)/);
  assert.match(js,/heroPowerStatus/);
  assert.match(js,/mw02-deck-card/);
  assert.match(js,/mw02PowerState/);
  for(const n of ['necro_portrait_test_v01.png','necro_power_day_test_v01.png','necro_power_night_test_v01.png'])
    assert.ok(fs.existsSync(path.join(root,'assets/hero-art-v2.1K',n)),n);
  assert.doesNotMatch(js,/\.players\s*\[\s*\d+\s*\]\s*=/);
});
test('BF-10 preserves 3D and game actions inside a collapsible developer menu',()=>{
  const js=read('battlefield-layout-fixes-v01.js');
  assert.match(js,/createElement\('details'\)/);
  assert.match(js,/battle3DToggle/);
  assert.match(js,/myGraveyardBtn/);
  assert.match(js,/botGraveyardBtn/);
  assert.match(read('index.html'),/id="battle3DToggle"/);
});
