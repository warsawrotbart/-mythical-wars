'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
test('BF layout fixes are wired after battlefield v02 and after game re-render',()=>{
  const html=read('index.html'),battle=read('deckgame.js');
  assert.match(html,/href="battlefield-layout-fixes-v01\.css\?v=0521"/);
  assert.match(html,/src="battlefield-layout-fixes-v01\.js\?v=0521"/);
  assert.ok(html.indexOf('battlefield-v02.css')<html.indexOf('battlefield-layout-fixes-v01.css'));
  assert.ok(html.indexOf('battlefield-v02.js')<html.indexOf('battlefield-layout-fixes-v01.js'));
  assert.match(battle,/MW_BATTLEFIELD_V02\?\.render\(game\);\s*window\.MW_BF_LAYOUT_FIXES\?\.render\(game\)/);
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
