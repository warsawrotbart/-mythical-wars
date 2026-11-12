'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const old=require('../mw-test-art-catalog.js');
global.MW_TEST_ART_CATALOG=old;require('../mw-ready-art-v05S23.js');
const catalog=global.MW_TEST_ART_CATALOG,ready=global.MW_READY_ART;
const registry=JSON.parse(read('ART_ASSET_REGISTRY_v05S23.json'));
test('ready import retains all 100 existing mappings and adds exactly 51 unique IDs',()=>{
 assert.equal(old.count,100);assert.equal(catalog.count,151);assert.equal(ready.ids.length,51);
 assert.equal(new Set(catalog.ids).size,151);
 for(const id of old.ids)assert.deepEqual(catalog.get(id),old.get(id));
});
test('all 51 original PNGs and runtime WebPs match the recorded SHA256',()=>{
 assert.equal(registry.entries.length,51);
 for(const e of registry.entries){
  const png=fs.readFileSync(path.join(root,e.originalPath)),webp=fs.readFileSync(path.join(root,e.runtimePath));
  const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
  assert.equal(hash(png),e.sha256,e.cardId);assert.equal(hash(webp),e.runtimeSha256,e.cardId);
  assert.equal(png.readUInt32BE(16),e.width);assert.equal(png.readUInt32BE(20),e.height);
  assert.equal(webp.toString('ascii',0,4),'RIFF');assert.equal(webp.toString('ascii',8,12),'WEBP');
  assert.equal(catalog.url(e.cardId),e.runtimePath);
 }
});
test('test-art approval is separate from crop review and game admission',()=>{
 for(const e of registry.entries){assert.equal(e.artApproval,'approved-test');assert.equal(e.crop.verified,false);assert.equal(e.maskCheck,'pending-visual-review');assert.ok(e.sourceFileId);}
 for(const e of registry.entries.filter(e=>e.cardId.startsWith('NCR-')))assert.match(e.cardAdmission,/не допущено/);
});
test('hero summons reuse token illustration aliases without adding engine cards',()=>{
 assert.equal(catalog.url('HERO-IDOL'),catalog.url('TKN-010'));
 assert.equal(catalog.url('HERO-UNDEAD'),catalog.url('TKN-011'));
 assert.equal(catalog.has('unknown'),false);assert.equal(catalog.url('unknown'),'');
 global.window=global;require('../card-catalog.js');
 assert.ok(!global.MW_CANONICAL_CARDS.some(c=>['TKN-008','TKN-009'].includes(c.cardId)));
});
test('game and editor load the ready registry after the existing catalog',()=>{
 for(const file of ['index.html','v05-dynamic.html']){
  const html=read(file);assert.ok(html.indexOf('mw-test-art-catalog.js')<html.indexOf('mw-ready-art-v05S23.js'));assert.match(html,/mw-ready-art-v05S23.js\?v=0523/);
 }
 assert.doesNotMatch(read('mw-ready-art-v05S23.js'),/https?:\/\//);
});
test('saved crop remains first priority over imported crop in both renderers',()=>{
 assert.match(read('battle-v05-card-bridge.js'),/saved\?\.crop\|\|\(!override \? root\.MW_READY_ART\?\.cropFor/);
 assert.match(read('v05-dynamic.js'),/cached\?\{\.\.\.cached\.crop\}:\(window\.MW_READY_ART\?\.cropFor/);
 assert.equal(ready.cropFor('KNZ-002'),null);
 for(const id of ready.ids){const c=ready.cropFor(id);assert.ok(c.x>=0&&c.x<=1&&c.y>=0&&c.y<=1&&c.zoom===1);}
});
