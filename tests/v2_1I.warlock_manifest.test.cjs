const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function loadInBrowserScope(file,win){
 vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),{window:win}, {filename:file});
}
const context={};
loadInBrowserScope('warlock-card-art-v2.1I.js',context);
loadInBrowserScope('card-catalog.js',context);
const api=context.MW_WARLOCK_ART;
const cards=[...context.MW_CANONICAL_CARDS].filter(c=>c.cardId.startsWith('CHR-'));
test('45 CHR artworks: unique, all test, complete types and correct IDs',()=>{
  assert.equal(api.count(),45);
  assert.equal(api.ids.length,45);
  assert.equal(new Set(api.ids).size,45);
  assert.equal(cards.length,45);
  assert.deepEqual([...api.ids].sort(),cards.map(c=>c.cardId).sort());
  assert.equal(cards.filter(c=>c.cardType==='creature').length,29);
  assert.equal(cards.filter(c=>c.cardType==='spell').length,12);
  assert.equal(cards.filter(c=>c.cardType==='weapon').length,4);
  assert.equal(api.status,'test');
});
test('All assets decode to valid embedded WebP bytes with individual master SHA-256',()=>{
  const hashes=[];
  for(const id of api.ids){
    const p=api.get(id),preview=api.preview(id),m=api.meta(id);
    assert.ok(p.startsWith('data:image/webp;base64,'));
    assert.ok(preview.startsWith('data:image/webp;base64,'));
    assert.match(m.originalSha256,/^[a-f0-9]{64}$/);
    assert.equal(m.status,'test');
    assert.ok(['original','generated'].includes(m.source));
    assert.ok(['v01','v02'].includes(m.sourceVersion));
    const data=Buffer.from(p.split(',')[1],'base64');
    assert.equal(data.toString('ascii',0,4),'RIFF');
    assert.equal(data.toString('ascii',8,12),'WEBP');
    hashes.push(m.originalSha256);
  }
  assert.equal(new Set(hashes).size,45,'No repeated master art SHA-256');
});
test('Variants only use selected v02 for CHR-015 and CHR-023',()=>{
  const variants=[...api.ids].filter(id=>api.meta(id).hadVariants).sort();
  assert.deepEqual(variants,['CHR-015','CHR-023']);
  for(const id of variants)assert.equal(api.meta(id).sourceVersion,'v02');
});
test('Newly created arts are tracked as generated test assets, not approved',()=>{
  const generated=[...api.ids].filter(id=>api.meta(id).source==='generated');
  assert.deepEqual(generated.sort(),['CHR-002','CHR-004','CHR-007','CHR-012','CHR-013','CHR-016',
     'CHR-017','CHR-020','CHR-027','CHR-028']);
  assert.equal(api.get('KNZ-002'),null);
});
