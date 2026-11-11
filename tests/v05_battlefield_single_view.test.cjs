'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
test('only canonical battlefield v02 can be selected in 2D',()=>{
  const html=read('index.html'),art=read('arena-art-v2.1D.js'),v02=read('battlefield-v02.js');
  assert.doesNotMatch(html,/id="battleArtToggle"/);
  assert.doesNotMatch(html,/id="battleLayoutToggle"/);
  assert.match(html,/battlefield-v02\.css\?v=0520/);
  assert.match(html,/battlefield-v02\.js\?v=0520/);
  assert.match(v02,/workspace\.classList\.add\('mw02-field'\)/);
  assert.match(art,/workspace\.classList\.remove\("mw-art-off"\)/);
  assert.doesNotMatch(art,/toggle\.addEventListener|localStorage\.getItem\(STASH\)/);
  assert.match(html,/id="battle3DToggle"/);
});
