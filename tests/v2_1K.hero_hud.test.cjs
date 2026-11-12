/* v2.1K: static regression checks. Runtime WebGL and browser layout
 * are verified separately and never claimed by this file. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const m=JSON.parse(read('HERO_ART_MANIFEST_v2.1K.json'));

test('selected warlock concept is third and default art is test status',()=>{
  assert.equal(m.selectedWarlockConcept,'№3 — Хранитель проклятий');
  assert.equal(m.status,'test');
  assert.equal(m.rules.defaultStatus,'test');
  assert.equal(m.rules.customPortraitsTakePrecedence,true);
  assert.equal(m.rules.clockPositionChanged,false);
  assert.equal(m.rules.gameplayRulesChanged,false);
});

test('hero art paths are safe local WebP assets, with no ZIP in art directory',()=>{
  const assets=[...new Set([
    ...Object.values(m.heroArt).flatMap(x=>[x.day,x.night]),
    ...Object.values(m.abilityArt)
  ])];
  assert.equal(assets.length,5);
  for(const p of assets){
    assert.match(p,/^assets\/hero-art-v2\.1K\/[\w.-]+\.webp$/);
    const stat=fs.statSync(path.join(root,p));
    assert.ok(stat.size>1000&&stat.size<1_000_000,p);
  }
  // BF-03 added three approved-for-testing Necromancer PNG sources.
  // They are not part of the older v2.1K WebP manifest and remain test art.
  const necroTestLayers=[
    'necro_portrait_test_v01.png',
    'necro_power_day_test_v01.png',
    'necro_power_night_test_v01.png'
  ];
  const folder=path.join(root,'assets/hero-art-v2.1K');
  for(const name of necroTestLayers){
    const stat=fs.statSync(path.join(folder,name));
    assert.ok(stat.isFile()&&stat.size>1000&&stat.size<4_000_000,name);
  }
  const names=fs.readdirSync(folder);
  // No untracked assets or ZIP files: exactly 5 original WebPs plus 3 test PNGs.
  assert.deepEqual(names.slice().sort(),
    [...assets.map(x=>path.basename(x)),...necroTestLayers].sort());
});

test('both 2D and 3D load shared hero art manifest and distinct ability image',()=>{
  const html=read('index.html'),source=read('deckgame.js'),scene=read('arena-3d-v2.1H.js');
  assert.match(html,/hero-art-v2\.1K\.js/);
  assert.match(html,/hero-hud-v2\.1K\.css/);
  assert.match(source,/MW_HERO_PORTRAIT_BRIDGE/);
  assert.match(source,/userArt\|\|window\.MW_HERO_ART\?\.portraitFor/);
  assert.match(source,/MW_HERO_ART\?\.abilityFor/);
  assert.match(scene,/requestHeroArtTexture/);
  assert.match(scene,/invalidateHeroes/);
  assert.match(scene,/hero:"\+heroRevision/);
  assert.match(scene,/MW_HERO_ART\?\.abilityFor/);
});

test('2D/3D counters have only a number visibly, descriptive text stays accessible',()=>{
  const scene=read('arena-3d-v2.1H.js'),source=read('deckgame.js');
  assert.match(source,/graveBtn\.textContent=String\(grave\.entries\)/);
  assert.match(scene,/corpseNode\.textContent=String\(corpseCount\)/);
  assert.match(scene,/graveNode\.textContent=String\(graveCount\)/);
  assert.match(scene,/graveNode\.setAttribute\("aria-label"/);
  assert.match(source,/graveBtn\.setAttribute\("aria-label"/);
  assert.doesNotMatch(scene,/Grave"\)\.textContent="⚰ Кладбище/);
  assert.doesNotMatch(scene,/Corpses"\)\.textContent="Трупы/);
});

test('graveyard click and corpse update are still wired into gameplay',()=>{
  const arena=read('arena-art-v2.1D.js'),scene=read('arena-3d-v2.1H.js'),source=read('deckgame.js');
  assert.match(scene,/mw3dMyGrave"\)\.onclick=.*graveyard\(0\)/);
  assert.match(scene,/mw3dEnemyGrave"\)\.onclick=.*graveyard\(1\)/);
  assert.match(source,/myGraveyardBtn"\)\.onclick=.*openGraveyard\(0\)/);
  assert.match(source,/botGraveyardBtn"\)\.onclick=.*openGraveyard\(1\)/);
  assert.match(arena,/corpse\.hidden=false;corpse\.textContent=String\(n\)/);
});

test('the clock remains the same original clock system',()=>{
  const scene=read('arena-3d-v2.1H.js'),css=read('ui-refactor-v2.1J.css');
  assert.match(scene,/const clock=\$\("mw3dClock"\),turn=stage\.querySelector/);
  // v2.1L: clock follows projected board edge, retaining original artwork and logic.
  assert.match(scene,/clock\.style\.left=bound\(left-clockW\*clockScale-6/);
  assert.match(scene,/centerPoint=point\(\[0,\.12,0\]\)/);
  assert.match(scene,/ck\.elapsed/);
  assert.match(css,/clock_day_dial\.webp/);
  assert.match(css,/clock_night_dial\.webp/);
});
