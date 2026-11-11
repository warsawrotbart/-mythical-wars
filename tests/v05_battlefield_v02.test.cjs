'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
const battlefield=require('../battlefield-v02.js');

test('canonical v02 holds max 7 creatures but 9-card measured width 1176',()=>{
 assert.equal(battlefield.BOARD_WIDTH,1176);
 assert.equal(battlefield.MAX_CREATURES,7);
 assert.equal(9*120+8*12,1176);
 for(const [count,left,right] of [[0,960,960],[1,900,1020],[5,636,1284],[6,570,1350],[7,504,1416]]){
  const p=battlefield.plan(count);
  assert.equal(p.left,left);assert.equal(p.right,right);
  assert.equal(p.x.length,count);
  assert.equal(p.x.every((x,i)=>i===0||x-p.x[i-1]===132),true);
 }
 assert.throws(()=>battlefield.plan(8),RangeError);
});

test('all real 24-hour phases drive 12-position art at 30-degree intervals',()=>{
 for(const [hour,day,index,angle] of [
  [0,false,0,0],[5,false,5,150],[6,true,6,180],[11,true,11,330],
  [12,true,0,0],[17,true,5,150],[18,false,6,180],[23,false,11,330]
 ]){
  const f=battlefield.frame(hour);
  assert.equal(f.day,day);assert.equal(f.index,index);assert.equal(f.angle,angle);
 }
 assert.equal(battlefield.frame(24).hour,0);
});

test('one uniformly scaled 1920x1080 canvas, centered at 4 target resolutions',()=>{
 for(const [w,h,scale] of [[1920,1080,1],[1600,900,5/6],[1366,768,768/1080],[2560,1440,4/3],[2000,900,5/6]]){
  const fit=battlefield.viewportFit(w,h);
  assert.ok(Math.abs(fit.scale-scale)<.00001);
  assert.ok(Math.abs(fit.left*2+1920*fit.scale-w)<.01);
  assert.ok(Math.abs(fit.top*2+1080*fit.scale-h)<.01);
 }
});

test('sole v02 battlefield CSS/JS loaded at the end of the real entrypoint',()=>{
 const html=read('index.html'),css=read('battlefield-v02.css'),js=read('battlefield-v02.js');
 assert.match(html,/href="battlefield-v02\.css\?v=0520"/);
 assert.match(html,/src="battlefield-v02\.js\?v=0520"/);
 assert.ok(html.indexOf('arena-v05S16.css')<html.indexOf('battlefield-v02.css'));
 assert.ok(html.indexOf('arena-layout-v05S13.js')<html.indexOf('battlefield-v02.js'));
 assert.match(css,/left:372px!important;right:auto!important;width:1176px/);
 assert.match(css,/#botBoard\{top:300px!important\}/);
 assert.match(css,/#myBoard\{top:540px!important\}/);
 assert.match(css,/background-image:none!important/);
 assert.match(css,/data-mw02-warrior="true"/);
 assert.match(js,/clock_assets\/ART-16_clock_day_dial_v2.png/);
 assert.match(js,/oldArt\?\.remove\(\)/);
 assert.match(js,/battleLayoutToggle/);
 assert.match(js,/global\.MW_HERO_HUD_V0511\?\.init/);
 assert.doesNotMatch(js,/\.players\s*\[[^\]]+\]\s*=/);
 assert.doesNotMatch(css,/#mw3dStage/);
});

test('game renders new 2D view after old HUD, no duplicate active hero powers',()=>{
 const deck=read('deckgame.js');const html=read('index.html');
 assert.match(deck,/MW_HERO_HUD_V0511\?\.render2D\(game\);\s*window\.MW_BATTLEFIELD_V02\?\.render\(game\)/);
 for(const id of ['botBoard','myBoard','botHeroPortrait','myHeroPortrait','botHeroPower','myHeroPower','battleClock','battleEndTurn','battle3DToggle']){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 }
});

test('approved assets are packaged with integrity checks and rebuilt by Pages',()=>{
 const manifest=JSON.parse(read('battlefield-v02/asset_manifest.json'));
 assert.equal(manifest.version,'v02');
 assert.equal(manifest.entries.length,41);
 assert.equal(manifest.chunks.length,10);
 assert.equal(manifest.compressed_total,4838635);
 assert.ok(manifest.entries.some(e=>e.path==='board_assets/ART-01_arena_day.webp'));
 assert.ok(manifest.entries.some(e=>e.path==='clock_assets/ART-15_clock_frame_v2.png'));
 assert.ok(manifest.entries.some(e=>e.path==='hero/approval.json'));
 for(const chunk of manifest.chunks)assert.ok(fs.existsSync(path.join(ROOT,'battlefield-v02',chunk.path)));
 const builder=read('tools/build_pages.py');
 const unpacker=read('tools/unpack_battlefield.py');
 assert.match(builder,/unpack_battlefield\(ROOT\/'battlefield-v02'/);
 assert.match(unpacker,/zlib\.crc32\(art\)/);
});
