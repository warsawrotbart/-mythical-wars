/* T02 — regression gate for the five approved militia cards.
 * Uses the frozen T01 Google Sheets snapshot; never mutates source or game state.
 */
"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const snapshot=JSON.parse(fs.readFileSync(path.join(root,
 "docs/integration-2026-11-19/sources/library-r165.json"),"utf8"));
global.window=global;
require("../card-catalog.js");
require("../v05-library-seed.js");
const model=require("../deck-model.js");
const engine=require("../battle-engine.js");
const cards=global.MW_CANONICAL_CARDS;
const ids=["NEU-045","NEU-046","NEU-047","NEU-048","NEU-049"];
const byId=new Map(cards.map(c=>[c.cardId,c]));
const sourceRows=snapshot.tabs["Карты"].values.slice(1);
const fromSource=new Map(sourceRows.map(r=>[String(r[0]),r]));
const seedRows=global.MW_V05_LIBRARY_SEED.cards.slice(1);
const seedById=new Map(seedRows.map(r=>[String(r[0]),r]));
const rarity={"Обычная (серая)":"common","Стандартная (зелёная)":"standard",
 "Редкая (синяя)":"rare","Эпическая (фиолетовая)":"epic",
 "Легендарная (золотая)":"legendary"};
const normalized=x=>x===null||x===undefined||x==="—"?"":String(x);
test("T02: exactly 167 canonical cards with 167 unique IDs and no missing library IDs",()=>{
 assert.equal(snapshot.source.driveRevisionId,"165");
 assert.equal(sourceRows.length,167);
 assert.equal(cards.length,167);
 assert.equal(byId.size,167);
 assert.deepEqual([...byId.keys()].sort(),[...fromSource.keys()].sort());
});
test("T02: NEU-045..049 preserve all approved printed fields and source Unicode",()=>{
 for(const id of ids){
  const row=fromSource.get(id),c=byId.get(id);
  assert.ok(row&&c,id+" is missing");
  assert.equal(c.cardId,id);
  assert.equal(c.name,row[1]);
  assert.equal(c.cardType,"creature");
  assert.equal(c.classId,"Нейтральная");
  assert.equal(c.rarityId,rarity[row[3]]);
  assert.equal(c.costType,"mana");
  assert.equal(c.costValue,Number(row[16]));
  assert.equal(c.attack,Number(row[5]));
  assert.equal(c.health,Number(row[6]));
  assert.equal(c.durability,null);
  assert.equal(c.timeAffinityId,row[8]);
  assert.equal(c.creatureTypeId,"Чалавек");
  assert.equal(c.subtype,"");
  assert.equal(c.ability,normalized(row[11]),"BY text mismatch: "+id);
  assert.equal(c.keywords,normalized(row[12]));
  assert.equal(c.status,row[15]);
  assert.equal(c.maxCopies,2);
  assert.equal(c.origin,"sheet");
 }
});
test("T02: no silent rarity/time/subtype normalization of the militia set",()=>{
 assert.deepEqual(ids.map(id=>byId.get(id).rarityId),
   ["common","standard","standard","standard","rare"]);
 assert.deepEqual(ids.map(id=>byId.get(id).timeAffinityId),
   ["Ноч","Дзень","Ноч","Ноч","Дзень"]);
 assert.ok(ids.every(id=>byId.get(id).subtype===""));
 assert.ok(ids.every(id=>byId.get(id).creatureTypeId==="Чалавек"));
 assert.equal(byId.get("NEU-045").ability,"");
 assert.equal(byId.get("NEU-046").ability,"Правакацыя");
 assert.equal(byId.get("NEU-047").ability,"Правакацыя");
 assert.ok(byId.get("NEU-048").ability.includes("\u2009"));
 assert.ok(byId.get("NEU-048").ability.includes("\u202f"));
});
test("T02: all five cards are in editor seed by ID without duplicate copies",()=>{
 assert.equal(seedRows.length,167);
 assert.equal(seedById.size,167);
 assert.deepEqual([...seedById.keys()].sort(),[...fromSource.keys()].sort());
 for(const id of ids){
  const expected=fromSource.get(id),seed=seedById.get(id);
  assert.ok(seed,id+" missing from editor seed");
  for(let col=0;col<18;col++){
   assert.equal(normalized(seed[col]),normalized(expected[col]),id+": editor source column "+col);
  }
 }
});
test("T02: all five are playable neutral creature definitions with two-copy limit",()=>{
 const index=model.indexCatalog(cards);
 for(const id of ids){
  const c=index.get(id);
  assert.equal(engine.abilitySupport(c),"complete",id);
  assert.equal(model.cardCopyLimit(c),2,id);
  for(const heroClass of model.CLASSES)assert.equal(model.allowedForClass(c,heroClass),true,id+" in "+heroClass);
 }
});
