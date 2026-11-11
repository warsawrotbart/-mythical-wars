const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const cat=require('../mw-test-art-catalog.js');
const inv=JSON.parse(fs.readFileSync(path.join(root,'test-art/test_art_inventory.json'),'utf8'));
const tokens=Array.from({length:7},(_,i)=>`TKN-${String(i+1).padStart(3,'0')}`);
const revised=['CHR-001','CHR-003','CHR-008','CHR-010','NEU-024','NEU-026','NEU-027'];
test('v05.9 contains exactly 99 known-ID art mappings, 70 honest gaps',()=>{
  assert.equal(cat.count,99);assert.equal(inv.counts.allLibrary,169);
  assert.equal(inv.counts.withTestArt,99);assert.equal(inv.missing.length,70);
  assert.equal(new Set([...cat.ids,...inv.missing]).size,169);
  for(const id of inv.missing) assert.equal(cat.url(id),'');
});
test('all seven token image files and reference versions are bundled',()=>{
  for(const id of tokens){
    const r=inv.items[id];assert.equal(r.status,'test');assert.equal(r.sourceVersion,'v01');
    assert.equal(cat.url(id),`test-art/${id}.webp`);
    assert.ok(r.originalWidth>=200&&r.originalHeight>=200);
    assert.equal(sha(r.file),r.sha256);
    assert.match(fs.readFileSync(path.join(root,r.file)).toString('ascii',8,12),/^WEBP$/);
  }
});
test('corrected v02 files are preferred; previous v01/test variants retained intact',()=>{
  for(const id of revised){
    const r=inv.items[id];assert.equal(r.sourceVersion,'v02');
    assert.equal(cat.url(id),r.file);assert.equal(sha(r.file),r.sha256);
    assert.equal(r.alternates.length,1);
    assert.equal(sha(r.alternates[0].file),r.alternates[0].sha256);
    assert.notEqual(r.alternates[0].sha256,r.sha256);
  }
});
test('all remaining files match their manifest hashes and remain test assets',()=>{
  for(const [id,r] of Object.entries(inv.items)){
    assert.match(id,/^[A-Z]{3}-\d{3}$/);assert.equal(r.status,'test');
    assert.equal(sha(r.file),r.sha256,id);assert.equal(cat.get(id).status,'test');
  }
  for(const id of ['KNZ-019','KNZ-006','KNZ-014'])
    assert.equal(cat.url(id),`v05/${id}/${id}_art_source.png`);
  assert.equal(sha('v05/production/editor_manifest.json'),
   '190371ce21046ba4530b9cb93b374292645218f4fcbe0a0f7e5ff0e529f5529f');
});
test('only one user-visible editor and no remote art sources in client',()=>{
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const script=fs.readFileSync(path.join(root,'mw-test-art-catalog.js'),'utf8');
  assert.match(index,/href="v05-dynamic\.html"/);
  assert.doesNotMatch(index,/<button[^>]*data-app-mode="editor"/);
  assert.doesNotMatch(script,/https:\/\/drive\.google\.com/);
});
