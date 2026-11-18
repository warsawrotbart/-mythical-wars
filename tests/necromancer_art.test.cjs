const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const registry=JSON.parse(read('NECROMANCER_ART_REGISTRY_2026-11-18.json'));
const ctx=vm.createContext({});
for(const file of ['mw-test-art-catalog.js','mw-ready-art-v05S23.js'])vm.runInContext(read(file),ctx);
const previous=ctx.MW_TEST_ART_CATALOG,previousReady=ctx.MW_READY_ART;
vm.runInContext(read('mw-necromancer-art.js'),ctx);
const catalog=ctx.MW_TEST_ART_CATALOG;

test('Necromancer import adds 23 unique IDs without replacing any existing art or crops',()=>{
 assert.equal(previous.count,151);assert.equal(catalog.count,174);
 assert.equal(new Set(catalog.ids).size,174);
 for(const id of previous.ids)assert.equal(catalog.get(id),previous.get(id),id);
 for(const id of previousReady.ids)assert.deepEqual(ctx.MW_READY_ART.cropFor(id),previousReady.cropFor(id),id);
 assert.equal(catalog.url('unknown'),'');assert.equal(ctx.MW_READY_ART.cropFor('unknown'),null);
});

test('all canonical Necromancer cards and existing summons resolve to actual local assets',()=>{
 ctx.window=ctx;vm.runInContext(read('card-catalog.js'),ctx);
 const cards=ctx.MW_CANONICAL_CARDS.filter(c=>c.cardId.startsWith('NCR-'));
 assert.equal(cards.length,29);
 for(const id of [...cards.map(c=>c.cardId),'TKN-007','TKN-010','TKN-011','HERO-IDOL','HERO-UNDEAD']){
  const url=catalog.url(id);assert.match(url,/^test-art\/[A-Z]{3}-\d{3}\.webp$/);
  assert.ok(fs.existsSync(path.join(root,url)),id);
 }
 assert.equal(catalog.has('NCR-016'),false);
 assert.equal(catalog.url('HERO-IDOL'),catalog.url('TKN-010'));
 assert.equal(catalog.url('HERO-UNDEAD'),catalog.url('TKN-011'));
});

test('all new WebPs match source registry checksums and use provisional crops',()=>{
 assert.equal(registry.entries.length,23);
 for(const entry of registry.entries){
  const data=fs.readFileSync(path.join(root,entry.runtimePath));
  assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WEBP');
  assert.equal(data.length,entry.runtimeBytes);
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'),entry.runtimeSha256,entry.id);
  assert.equal(catalog.url(entry.id),entry.runtimePath);
  assert.equal(entry.crop.verified,false);assert.match(entry.sourceSha256,/^[a-f0-9]{64}$/);
  assert.ok(entry.sourceFileId);assert.equal(entry.width,1024);assert.equal(entry.height,1536);
  assert.equal(ctx.MW_READY_ART.cropFor(entry.id).zoom,1);
 }
});

test('game, editor and motion lab load Necromancer art after their existing catalogs',()=>{
 for(const file of ['index.html','v05-dynamic.html','battle-motion-lab.html']){
  const html=read(file),order=['mw-test-art-catalog.js','mw-ready-art-v05S23.js','mw-necromancer-art.js','battle-v05-card-bridge.js'];
  if(file==='v05-dynamic.html')order[3]='v05-dynamic.js?v=';
  for(let i=0;i<order.length;i++){
   assert.ok(html.indexOf(order[i])>=0,file+': '+order[i]);
   if(i)assert.ok(html.indexOf(order[i-1])<html.indexOf(order[i]),file);
  }
 }
 assert.doesNotMatch(read('mw-necromancer-art.js'),/https?:\/\//);
 assert.match(read('tools/build_pages.py'),/'test-art'/);
});
