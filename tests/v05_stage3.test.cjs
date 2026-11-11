/* v05 stage 3: safe off-line library import from the supplied 21-field sheet schema. */
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'v05/production/editor_manifest.json'),'utf8'));
global.window=global;require('../v05-library-seed.js');
const lib=require('../v05-library-core.js'),renderer=require('../v05-dynamic-core.js');
const seed=window.MW_V05_LIBRARY_SEED;
const base=lib.normalizeSeed(seed,manifest);
const clone=x=>JSON.parse(JSON.stringify(x));
const makeSheets=(cards=seed.cards,tokens=seed.tokens)=>[{kind:'cards',name:'Карты',rows:cards},{kind:'tokens',name:'Токены',rows:tokens}];
const cell=(rows,id,index)=>rows.find(row=>row[0]===id)[index];
const errors=p=>p.issues.filter(x=>x.severity==='error');
test('read-only baseline exactly 162 cards and 7 disjoint tokens',()=>{
 assert.equal(base.cards.length,162);assert.equal(base.tokens.length,7);
 assert.equal(new Set(base.cards.map(x=>x.id)).size,162);
 assert.equal(new Set(base.tokens.map(x=>x.id)).size,7);
 assert.ok(base.cards.every(x=>!x.id.startsWith('TKN-')));
 assert.ok(base.tokens.every(x=>x.id.startsWith('TKN-')));
});
test('unchanged workbook has no field-level diffs',()=>{
 const p=lib.prepare(base,makeSheets(),manifest);
 assert.equal(p.errors.length,0);assert.equal(p.changed,0);
 assert.equal(p.diff.length,169);assert.equal(p.ready,true);
});
test('changing numeric attack and notes shows two exact old/new fields, not artwork',()=>{
 const rows=clone(seed.cards),rec=rows.find(x=>x[0]==='KNZ-019');
 rec[5]='7.0';rec[20]='Новая заметка';
 const p=lib.prepare(base,[{kind:'cards',rows}],manifest);
 assert.equal(p.errors.length,0);assert.equal(p.changed,1);
 const entry=p.diff.find(x=>x.id==='KNZ-019');
 assert.deepEqual(entry.diff.map(x=>x.field).sort(),['attack','notes']);
 assert.equal(entry.diff.find(x=>x.field==='attack').before,3);
 assert.equal(entry.diff.find(x=>x.field==='attack').after,7);
 assert.equal(lib.toV05Card(p.next.cards.find(x=>x.id==='KNZ-019')).art_status,'тестовый вариант');
 assert.deepEqual(p.next.tokens,base.tokens);
});
test('decimal 2.0, 2,0 accepted as integers; 2,5 and negatives blocked',()=>{
 for(const valid of [2,2.0,'2.0','2,0']){
  const rows=clone(seed.cards);rows.find(x=>x[0]==='KNZ-019')[5]=valid;
  const p=lib.prepare(base,[{kind:'cards',rows}],manifest);assert.equal(p.errors.length,0,String(valid));
 }
 for(const invalid of ['2,5','-1','3.5','Infinity']){
  const rows=clone(seed.cards);rows.find(x=>x[0]==='KNZ-019')[5]=invalid;
  const p=lib.prepare(base,[{kind:'cards',rows}],manifest);
  assert.ok(errors(p).some(x=>x.code==='integer'),invalid);
 }
});
test('duplicate ID, unknown ID and missing ID all block commit',()=>{
 const dup=clone(seed.cards);dup.find(x=>x[0]==='KNZ-002')[0]='KNZ-001';
 const p=lib.prepare(base,[{kind:'cards',rows:dup}],manifest);
 assert.equal(p.ready,false);
 assert.ok(errors(p).some(x=>x.code==='duplicate'));
 assert.ok(errors(p).some(x=>x.code==='missing-id'));
 const unfamiliar=clone(seed.cards);unfamiliar.find(x=>x[0]==='KNZ-002')[0]='KNZ-999';
 assert.ok(errors(lib.prepare(base,[{kind:'cards',rows:unfamiliar}],manifest)).some(x=>x.code==='unknown-id'));
});
test('partial library and missing 21-column schema cannot be silently applied',()=>{
 const part=clone(seed.cards).slice(0,10);
 assert.ok(errors(lib.prepare(base,[{kind:'cards',rows:part}],manifest)).some(x=>x.code==='count'));
 const missingColumn=clone(seed.cards).map(row=>row.slice(0,20));
 assert.throws(()=>lib.prepare(base,[{kind:'cards',rows:missingColumn}],manifest),/21 столбец/);
});
test('unknown classes, rarities and resources are errors without default substitutions',()=>{
 for(const [ix,value,code] of [[13,'Тамплиер','class'],[3,'Фиолетово-золотая','rarity'],[17,'Энергия','resource']]){
  const rows=clone(seed.cards);rows.find(x=>x[0]==='KNZ-019')[ix]=value;
  const p=lib.prepare(base,[{kind:'cards',rows}],manifest);
  assert.ok(errors(p).some(x=>x.code===code),code);
 }
});
test('special cases retained: corpus cost, Day+Night, unknown species, token rarity',()=>{
 const corpse=base.cards.find(x=>x.id==='NCR-021');
 assert.equal(corpse.mana,null);assert.equal(corpse.cost,4);
 assert.equal(corpse.cost_resource,'Трупы');
 assert.ok(renderer.validateCard(lib.toV05Card(corpse),manifest,{hasArt:true}).some(x=>x.code==='resource-icon-pending'));
 const both=base.cards.find(x=>x.id==='NEU-001');assert.equal(both.time,'Дзень і Ноч');assert.equal(both.time_key,null);
 assert.ok(renderer.validateCard(lib.toV05Card(both),manifest,{hasArt:true}).some(x=>x.code==='time-icon-pending'));
 const needle=base.tokens.find(x=>x.id==='TKN-007');
 assert.equal(needle.rarity,'Не утверждена');assert.equal(needle.rarity_key,null);
 assert.ok(renderer.validateCard(lib.toV05Card(needle),manifest,{hasArt:true}).some(x=>x.code==='token-template-pending'));
});
test('tokens never modify cards and vice versa',()=>{
 const rows=clone(seed.tokens);rows.find(x=>x[0]==='TKN-001')[20]='Тест';
 const p=lib.prepare(base,[{kind:'tokens',rows}],manifest);
 assert.equal(p.errors.length,0);assert.equal(p.changed,1);
 assert.deepEqual(p.next.cards,base.cards);
 assert.equal(p.diff.length,7);
});
test('supported class palette, rarity and subtype are derived from explicit dictionaries',()=>{
 const card=base.cards.find(x=>x.id==='KNZ-019');
 assert.equal(card.class_key,'Warrior');assert.equal(card.rarity_key,'Blue');
 assert.equal(card.subtype_icon_key,'Druzhyna');assert.equal(card.race_icon_key,'Human');
 assert.equal(card.time_key,'Night');
});
test('stored snapshot has stable IDs; injected replacement is rejected',()=>{
 assert.equal(lib.validateSnapshot(clone(base),base).cards.length,162);
 const corrupted=clone(base);corrupted.cards[0].id='HACK-999';
 assert.throws(()=>lib.validateSnapshot(corrupted,base),/чужие/);
});
test('file routing accepts correct XLSX tabs, does not import class/deck tabs',()=>{
 const xlsx={kind:'xlsx',sheets:[{name:'Карты',rows:seed.cards},{name:'Колода — Воин',rows:[]},{name:'Токены',rows:seed.tokens},{name:'Чародей',rows:[]}]};
 const result=lib.classifyInput(xlsx,'anything.xlsx');assert.deepEqual(result.map(x=>x.kind),['cards','tokens']);
 const csv=lib.classifyInput({kind:'csv',sheets:[{name:'custom.csv',rows:seed.tokens}]},'custom.csv');
 assert.equal(csv[0].kind,'tokens');
});
test('stage 3 does not modify source manifest, game catalogue or sample controls',()=>{
 const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
 assert.equal(digest('v05/production/editor_manifest.json'),'190371ce21046ba4530b9cb93b374292645218f4fcbe0a0f7e5ff0e529f5529f');
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'v05/production/sample_cards.json'))).length,3);
 assert.equal(base.cards.length,162);
});
