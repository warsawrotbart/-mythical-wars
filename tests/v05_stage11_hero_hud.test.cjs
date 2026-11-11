'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const digest=n=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,n))).digest('hex');

test('v05.11 installs the same Hero HUD in 2D and 3D without a second editor',()=>{
 const html=read('index.html');
 assert.match(html,/<link rel="stylesheet" href="hero-hud-v05S11\.css\?v=0511">/);
 assert.match(html,/<script src="hero-hud-v05S11\.js\?v=0511"><\/script>/);
 assert.doesNotMatch(html,/<button[^>]+data-app-mode="editor"/);
 const hud=read('hero-hud-v05S11.js');
 for(const mark of ['render2D(game)','render3D(game)','mw11-weapon-slot','mw11-3d-portrait','mw11-ability-cost','MW_HERO_PORTRAIT_BRIDGE','MW_TEST_ART_CATALOG','statusName(info,owner,targeting)'])
  assert.ok(hud.includes(mark),mark);
 const css=read('hero-hud-v05S11.css');
 for(const mark of ['.mw11-weapon-slot','.mw11-hero-core','.mw11-3d-ability','@media(max-height:780px)','@media(max-width:800px)','prefers-reduced-motion'])
  assert.ok(css.includes(mark),mark);
});

test('HUD reads engine state only; original input and targeting remain unchanged',()=>{
 const hud=read('hero-hud-v05S11.js');
 assert.match(hud,/engine\(\)\.heroPowerStatus\(game,owner\)/);
 assert.match(hud,/player\.weapon/);
 assert.match(hud,/player\.health/);
 assert.match(hud,/player\.armor/);
 assert.doesNotMatch(hud,/\.mana\s*[-+]?=/);
 assert.doesNotMatch(hud,/\.health\s*[-+]?=/);
 assert.doesNotMatch(hud,/\.weapon\s*=/);
 assert.match(read('deckgame.js'),/MW_HERO_HUD_V0511\?\.render2D\(game\)/);
 const arena=read('arena-3d-v2.1H.js');
 assert.match(arena,/MW_HERO_HUD_V0511\?\.render3D\(s\)/);
 assert.match(arena,/mw11-stage-hud/);
 assert.match(arena,/MW_BATTLE_VIEW_BRIDGE/);
});

test('equipment illustration respects existing saved custom art, never changes weapon stats',()=>{
 const renderer=read('battle-card-renderer-v2.1C.js');
 assert.match(renderer,/const art=source\?cleanImg\(extractContext\(source,null\)\?\.art\)/);
 assert.match(renderer,/if\(art\)img\.src=art/);
 assert.match(renderer,/weapon\.attack/);
 assert.match(renderer,/weapon\.durability/);
});

test('all protected assets and library coverage survive the HUD-only release',()=>{
 assert.equal(digest('v05/production/editor_manifest.json'),'190371ce21046ba4530b9cb93b374292645218f4fcbe0a0f7e5ff0e529f5529f');
 const inv=JSON.parse(read('test-art/test_art_inventory.json'));
 assert.equal(Object.keys(inv.items).length,99);
 assert.equal(inv.missing.length,70);
 assert.equal(inv.counts.allLibrary,169);
 for(const id of ['TKN-001','TKN-007','CHR-001','KNZ-019'])assert.ok(inv.items[id]);
});
