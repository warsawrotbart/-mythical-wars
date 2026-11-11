'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const file=n=>fs.readFileSync(path.join(root,n));
const text=n=>file(n).toString('utf8');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const catalogue=require('../mw-test-art-catalog.js');
const inventory=JSON.parse(text('test-art/test_art_inventory.json'));

test('v05.7 uses one visible editor and retains game/deck navigation',()=>{
  const index=text('index.html');
  assert.match(index, /<a href="v05-dynamic\.html" class="mw-v05-std-link"/);
  assert.doesNotMatch(index, /<button[^>]*data-app-mode="editor"/);
  assert.doesNotMatch(index, /href="v05-studio\.html"/);
  assert.match(index, /id="editorWorkspace" hidden aria-hidden="true"/);
  assert.match(index, /data-app-mode="decks"/);
  assert.match(index, /data-app-mode="battle"/);
  assert.match(index, /src="mw-test-art-catalog\.js"/);
  const c=text('collection-ui-v2.1M1.js');
  assert.match(c, /v05-dynamic\.html\?card=/);
  const dynamic=text('v05-dynamic.html');
  assert.ok(dynamic.indexOf('mw-test-art-catalog.js') < dynamic.indexOf('v05-dynamic.js'));
  assert.ok(dynamic.indexOf('mw-test-art-catalog.js') !== -1);
  assert.match(text('v05-library-ui.js'), /new URLSearchParams\(window\.location\.search\)/);
});

test('all 169 entries have honest test-art coverage: 99 available, 70 missing',()=>{
  assert.equal(inventory.counts.allLibrary,169);
  assert.equal(inventory.counts.withTestArt,99);
  assert.equal(inventory.counts.withoutArt,70);
  assert.equal(inventory.counts.chrEmbedded,45);
  assert.equal(inventory.counts.otherFromDrive,47);
  assert.equal(catalogue.count,99);
  assert.deepEqual(new Set(catalogue.ids).size,99);
  assert.deepEqual(new Set(inventory.missing).size,70);
  for (const id of inventory.missing) assert.equal(catalogue.has(id),false,id);
  assert.equal(catalogue.has('TKN-001'),true);
  assert.equal(catalogue.has('CHR-001'),true);
  assert.equal(catalogue.has('KNZ-001'),true);
  assert.equal(catalogue.has('NEU-023'),true);
});

test('every test art exists, matches checksum, preserves test state and canonical ID',()=>{
  const ids=Object.keys(inventory.items);
  assert.equal(ids.length,99);
  for(const id of ids){
    assert.match(id,/^[A-Z]{3}-\d{3}$/);
    const rec=inventory.items[id];
    assert.equal(rec.id,id);
    assert.equal(rec.status,'test');
    assert.equal(catalogue.get(id).status,'test');
    assert.equal(catalogue.url(id),rec.default);
    assert.ok(rec.file===`test-art/${id}.webp`,id);
    assert.ok(fs.existsSync(path.join(root,rec.file)),id);
    assert.equal(sha(file(rec.file)),rec.sha256,id);
    assert.equal(file(rec.file).toString('ascii',0,4),'RIFF',id);
    assert.equal(file(rec.file).toString('ascii',8,12),'WEBP',id);
  }
});

test('three control artworks retain original v05 template sources',()=>{
  for(const id of ['KNZ-019','KNZ-006','KNZ-014']){
    assert.equal(catalogue.url(id),`v05/${id}/${id}_art_source.png`);
    assert.ok(fs.existsSync(path.join(root,`test-art/${id}.webp`)),id);
  }
});

test('protected manifest and battle/canonical files have no changes in web update',()=>{
  assert.equal(sha(file('v05/production/editor_manifest.json')),'190371ce21046ba4530b9cb93b374292645218f4fcbe0a0f7e5ff0e529f5529f');
  assert.match(text('v05-dynamic.js'), /builtinTestArt\(card\.id\)/);
  assert.match(text('v05-dynamic.js'), /cached\?\.artSource\|\|bundledArt/);
  assert.match(text('v05-dynamic.js'), /saved\.blob\?URL\.createObjectURL\(saved\.blob\)/);
  assert.match(text('deckgame.js'), /if\(mode==="editor"\)\{window\.location\.assign\("v05-dynamic\.html"\)/);
});

test('collection shows exactly 92 test arts, 70 missing canonical arts, no autoapproval',()=>{
  const vm=require('node:vm');
  const context={window:{}};
  vm.runInNewContext(file('card-catalog.js').toString('utf8'),context);
  const canonical=context.window.MW_CANONICAL_CARDS;
  const core=require('../collection-core-v2.1M1.js');
  assert.equal(canonical.length,162);
  const rows=core.build(canonical,[],catalogue);
  const stats=core.stats(rows);
  assert.equal(stats.canonical,162);
  assert.equal(stats.artTest,92);
  assert.equal(stats.artMissing,70);
  assert.equal(stats.artApproved,0);
  assert.ok(rows.find(x=>x.id==='NEU-023' && x.art==='test'));
  assert.ok(rows.find(x=>x.id==='NCR-027' && x.art==='missing'));
});
