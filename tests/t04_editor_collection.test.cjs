/* T04 — editor/collection acceptance: 167 cards, searching and legacy saved data.
 * No production files are modified or stored by these tests.
 */
"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const lib=require("../v05-library-core.js");
const collection=require("../collection-core-v2.1M1.js");
const manifest=require("../v05/production/editor_manifest.json");
const load=(name)=>fs.readFileSync(path.join(root,name),"utf8");
const ctx={window:{}};vm.runInNewContext(load("card-catalog.js"),ctx);
const catalog=ctx.window.MW_CANONICAL_CARDS;
const seedCtx={window:{}};vm.runInNewContext(load("v05-library-seed.js"),seedCtx);
const seed=seedCtx.window.MW_V05_LIBRARY_SEED;
const baseline=lib.normalizeSeed(seed,manifest);
const clone=v=>JSON.parse(JSON.stringify(v));
const legacyIds=["NEU-045","NEU-046","NEU-047","NEU-048","NEU-049"];
const sourceCards=new Set(catalog.map(c=>c.cardId));

test("T04 editor opens 167 canonical records, distinct from 12 service/token records",()=>{
 assert.equal(baseline.cards.length,167);
 assert.equal(baseline.tokens.length,12);
 assert.equal(new Set(baseline.cards.map(c=>c.id)).size,167);
 assert.equal(new Set(baseline.tokens.map(c=>c.id)).size,12);
 assert.equal(collection.stats(collection.build(catalog)).canonical,167);
 assert.deepEqual(new Set(baseline.cards.map(c=>c.id)),sourceCards);
});
test("T04 legacy 162-card v05 snapshot migrates additively without changing saved text/stats",()=>{
 const old=clone(baseline);
 old.cards=old.cards.filter(c=>!legacyIds.includes(c.id));
 assert.equal(old.cards.length,162);
 const customized=old.cards.find(c=>c.id==="KNZ-002");
 customized.name="МОЯ ПРЕЖНЯЯ КАРТА";
 customized.attack=5;
 customized.notes="Рабочая локальная заметка";
 const before=JSON.stringify(old);
 const upgraded=lib.validateSnapshot(old,baseline);
 assert.equal(JSON.stringify(old),before,"validation must not mutate persisted snapshot");
 assert.equal(upgraded.cards.length,167);
 assert.equal(upgraded.tokens.length,12);
 assert.deepEqual(upgraded.tokens,old.tokens);
 const recovered=upgraded.cards.find(c=>c.id==="KNZ-002");
 assert.equal(recovered.name,customized.name);
 assert.equal(recovered.attack,5);
 assert.equal(recovered.notes,customized.notes);
 for(const id of legacyIds){
  assert.deepEqual(upgraded.cards.find(c=>c.id===id),baseline.cards.find(c=>c.id===id));
 }
 const again=lib.validateSnapshot(upgraded,baseline);
 assert.strictEqual(again,upgraded,"migration must be idempotent");
});
test("T04 refuses damaged, substituted and duplicate old snapshots before migration",()=>{
 const legacy=clone(baseline);legacy.cards=legacy.cards.filter(c=>!legacyIds.includes(c.id));
 const bad=clone(legacy);bad.cards[0].id="UNKNOWN-999";
 assert.throws(()=>lib.validateSnapshot(bad,baseline),/чужие/);
 const dup=clone(legacy);dup.cards[1].id=dup.cards[0].id;
 assert.throws(()=>lib.validateSnapshot(dup,baseline),/повторные/);
 const short=clone(legacy);short.cards.pop();
 assert.throws(()=>lib.validateSnapshot(short,baseline),/неполная/);
 const different=clone(legacy);different.cards.splice(0,1);
 different.cards.push(clone(baseline.cards.find(c=>c.id==="NEU-045")));
 assert.throws(()=>lib.validateSnapshot(different,baseline),/неожиданные пропуски/);
 const noToken=clone(legacy);noToken.tokens.pop();
 assert.throws(()=>lib.validateSnapshot(noToken,baseline),/неполная/);
});
test("T04 collection finds all five militia cards by ID and Belarusian names",()=>{
 const rows=collection.build(catalog);
 for(const id of legacyIds){
  const card=rows.find(x=>x.id===id);
  assert.ok(card);
  assert.equal(collection.filter(rows,{query:id.toLowerCase()}).length,1);
  assert.equal(collection.filter(rows,{query:card.card.name.toLocaleLowerCase()}).length,1);
 }
 assert.equal(collection.filter(rows,{classId:"Нейтральная",scope:"canonical"})
   .some(x=>x.id==="NEU-048"),true);
 assert.equal(collection.filter(rows,{classId:"Нейтральная",type:"creature",query:"NEU-048"}).length,1);
 assert.equal(collection.filter(rows,{classId:"Воин",query:"NEU-048"}).length,0);
});
test("T04 collection filters remain composable with saved custom art and local cards",()=>{
 const saved=[{cardId:"NEU-048",definition:{name:"Локальная правка",health:8,cardId:"IMPOSTOR"},
  project:{assets:{customArtData:"data:image/png;base64,AA=="},metadata:{artStatus:"approved",frameApproved:true}}},
 {cardId:"CUSTOM-010",definition:{cardId:"CUSTOM-010",name:"Созданная карта",cardType:"creature",classId:"Воин"}}];
 const canonicalString=JSON.stringify(catalog);
 const rows=collection.build(catalog,saved);
 assert.equal(collection.stats(rows).canonical,167);
 assert.equal(collection.stats(rows).local,1);
 const changed=collection.filter(rows,{scope:"canonical",art:"approved",frame:"approved",query:"NEU-048"});
 assert.equal(changed.length,1);
 assert.equal(changed[0].card.health,8);
 assert.equal(changed[0].card.name,"Локальная правка");
 assert.equal(changed[0].id,"NEU-048","source ID must never change");
 assert.equal(collection.filter(rows,{scope:"local",query:"CUSTOM-010"}).length,1);
 assert.equal(JSON.stringify(catalog),canonicalString,"display never mutates original catalog");
});
test("T04 UI renders source characteristics, dynamic counts and honest v05 export filename",()=>{
 const ui=load("collection-ui-v2.1M1.js"),css=load("collection-ui-v2.1M1.css"),editor=load("v05-library-ui.js");
 assert.match(ui,/rows\.filter\(x=>x\.canonical\)\.length/);
 assert.match(ui,/Стоимость:/);
 assert.match(ui,/Здоровье:/);
 assert.match(ui,/Прочность:/);
 assert.match(ui,/mw-col-card-ability/);
 assert.match(ui,/v05-dynamic\.html\?card=/);
 assert.match(css,/\.mw-col-card-values/);
 assert.match(css,/\.mw-col-card-ability/);
 assert.match(editor,/core\.REQUIRED\.cards/);
 assert.match(editor,/core\.REQUIRED\.tokens/);
 assert.match(editor,/local_library_\$\{current\.cards\.length\}/);
 assert.doesNotMatch(editor,/Карты: \$\{current\.cards\.length\}\/162/);
});
