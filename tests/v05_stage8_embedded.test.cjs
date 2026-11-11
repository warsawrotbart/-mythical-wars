'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const file=n=>fs.readFileSync(path.join(root,n),'utf8');
const catalog=require('../mw-test-art-catalog.js');
const inventory=JSON.parse(file('test-art/test_art_inventory.json'));

test('editor exposes built-in picture, reset and no-art state',()=>{
 const html=file('v05-dynamic.html');
 for(const id of ['builtinArtPreview','builtinArtPanel','builtinArtMeta','restoreBuiltinArt','builtinCoverage','libOnlyWithArt'])
   assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/<img id="builtinArtPreview"[^>]+hidden>/);
 assert.match(html,/<button id="restoreBuiltinArt"[^>]+disabled>/);
 assert.match(html,/Только карты со встроенным артом/);
 assert.match(html,/v05\.(?:9|10|11) RC/);
});

test('reset cancels the custom art override and explicitly commits a new profile',()=>{
 const js=file('v05-dynamic.js');
 assert.match(js,/\$\("restoreBuiltinArt"\)\.addEventListener\("click"/);
 assert.match(js,/const builtin=selectedBuiltinArt\(\)/);
 assert.match(js,/if\(!state\.card\|\|!builtin\)return/);
 assert.match(js,/state\.artSource=builtin;state\.artBlob=null;state\.artLabel=""/);
 assert.match(js,/storeProfile\(true,true\)/);
 assert.match(js,/state\.profiles\.set\(id,/);
 assert.match(js,/saved\.blob\?URL\.createObjectURL\(saved\.blob\):state\.artSource/);
});

test('picker filters by checked built-in ID and counts coverage',()=>{
 const js=file('v05-library-ui.js');
 assert.match(js,/\$\("libOnlyWithArt"\)\.checked/);
 assert.match(js,/!!catalog\?\.has\(record\.id\)/);
 assert.match(js,/\$\("libOnlyWithArt"\)\.addEventListener\("change",updatePicker\)/);
 assert.match(js,/\$\("builtinCoverage"\)\.textContent/);
});

test('all built-in art URLs point only to shipped files, never remote data',()=>{
 assert.equal(catalog.count,99);
 const missing=inventory.missing;
 assert.equal(missing.length,70);
 for(const id of catalog.ids){
  const src=catalog.url(id);
  assert.ok(src.startsWith('test-art/')||src.startsWith('v05/'),src);
  assert.ok(!src.includes('..')&&!src.startsWith('/'),src);
  assert.ok(fs.statSync(path.join(root,src)).isFile(),id);
 }
 for(const id of missing)assert.equal(catalog.url(id),'',id);
 for(const id of ['KNZ-019','KNZ-006','KNZ-014'])
  assert.equal(catalog.url(id),`v05/${id}/${id}_art_source.png`);
});

test('embedded status does not claim art approval or change canonical rules',()=>{
 assert.match(file('v05-dynamic.js'),/встроен в сборку/);
 assert.match(file('v05-dynamic.js'),/тестовый, не утверждён/);
 assert.match(file('v05-dynamic.js'),/нет тестового арта во встроенной библиотеке/);
 assert.doesNotMatch(file('v05-dynamic.js'),/https?:\/\/drive\.google\.com/);
 assert.match(file('index.html'),/href="v05-dynamic\.html"/);
});
