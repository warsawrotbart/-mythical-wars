/* T03 — source-locked regression of the 162 pre-existing cards.
 * Baseline: T01 Google Sheets "Библиотека карт", Drive revision 165.
 * Pure verification: no gameplay or source mutation.
 */
"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const snap=JSON.parse(fs.readFileSync(
  path.join(root,"docs/integration-2026-11-19/sources/library-r165.json"),"utf8"));
global.window=global;
require("../card-catalog.js");
require("../v05-library-seed.js");
const canonical=global.MW_CANONICAL_CARDS;
const seed=global.MW_V05_LIBRARY_SEED;
const newlyAdded=new Set(["NEU-045","NEU-046","NEU-047","NEU-048","NEU-049"]);
const source=snap.tabs["Карты"].values.slice(1).filter(r=>r[0]);
const oldRows=source.filter(r=>!newlyAdded.has(r[0]));
const byId=new Map(canonical.map(c=>[c.cardId,c]));
const editorById=new Map(seed.cards.slice(1).map(r=>[String(r[0]),r]));
const cardType={"Существо":"creature","Заклинание":"spell","Оружие":"weapon"};
const rarity={"Обычная":"common","Стандартная":"standard",
 "Редкая":"rare","Эпическая":"epic","Легендарная":"legendary"};
function rarityId(label){
 for(const [s,id] of Object.entries(rarity))if(String(label).startsWith(s))return id;
 throw Error("Неизвестная редкость: "+label);
}
const blank=v=>v===undefined||v===null||v===""||v==="—";
const str=v=>blank(v)?"":String(v);
const number=v=>blank(v)?null:Number(v);
function expected(r){
 const res=str(r[17]);
 if(!["Мана","Трупы"].includes(res))throw Error(r[0]+": неизвестный ресурс "+res);
 return {
  cardId:String(r[0]),name:String(r[1]),cardType:cardType[r[4]],classId:str(r[13]),
  rarityId:rarityId(r[3]),costType:res==="Трупы"?"corpses":"mana",
  costValue:number(r[16]),attack:number(r[5]),health:number(r[6]),
  durability:number(r[7]),timeAffinityId:str(r[8]),creatureTypeId:str(r[9]),
  subtype:str(r[10]),ability:str(r[11]),keywords:str(r[12]),
  maxCopies:number(r[14]),status:str(r[15]),origin:"sheet"
 };
}

test("T03: exactly 162 pre-existing source IDs and no missing or duplicate catalog entries",()=>{
 assert.equal(snap.source.driveRevisionId,"165");
 assert.equal(source.length,167);
 assert.equal(oldRows.length,162);
 assert.equal(new Set(oldRows.map(r=>r[0])).size,162);
 assert.equal(canonical.length,167);
 assert.equal(byId.size,167);
 for(const row of oldRows){
  assert.ok(byId.has(row[0]),"Missing catalog: "+row[0]);
  assert.ok(editorById.has(row[0]),"Missing editor: "+row[0]);
 }
});

test("T03: all 162 original cards match EVERY field within A:R covered by source snapshot",()=>{
 let checked=0;
 for(const row of oldRows){
  const id=String(row[0]),actual=byId.get(id),wanted=expected(row);
  assert.ok(actual,id);
  for(const [key,value] of Object.entries(wanted))
   assert.equal(actual[key],value,id+" — "+key);
  checked++;
 }
 assert.equal(checked,162);
});

test("T03: original mana/corpse price and printed mana column are consistent",()=>{
 for(const r of oldRows){
  const c=byId.get(r[0]);
  assert.equal(c.costValue,number(r[16]),r[0]+" effective cost");
  assert.equal(c.costType,r[17]==="Трупы"?"corpses":"mana",r[0]+" effective resource");
  if(c.costType==="mana")
   assert.equal(c.costValue,number(r[2]),r[0]+" printed mana differs from source price");
 }
});

test("T03: Belarusian ability, mechanic labels and card names are character-exact",()=>{
 for(const r of oldRows){
  const c=byId.get(r[0]);
  assert.equal(c.name,r[1],r[0]+" name");
  assert.equal(c.ability,str(r[11]),r[0]+" BY text and thin spaces");
  assert.equal(c.keywords,str(r[12]),r[0]+" mechanic labels");
 }
 assert.ok(oldRows.some(r=>String(r[11]).includes("\u2009")),"Expected U+2009 in authoritative text");
 assert.ok(oldRows.some(r=>String(r[11]).includes("\u202f")),"Expected U+202F in authoritative text");
});

test("T03: original editor data A:R matches snapshot cell-by-cell, without value coercion",()=>{
 assert.equal(editorById.size,167);
 for(const r of oldRows){
  const editor=editorById.get(r[0]);
  assert.ok(editor,r[0]);
  for(let col=0;col<18;col++)
   assert.equal(str(editor[col]),str(r[col]),r[0]+" editor source column "+col);
 }
});

test("T03: class, subtype, rarity and copy limits remain source-driven",()=>{
 for(const r of oldRows){
  const c=byId.get(r[0]);
  assert.equal(c.classId,str(r[13]),r[0]+" class");
  assert.equal(c.subtype,str(r[10]),r[0]+" subtype");
  assert.equal(c.rarityId,rarityId(r[3]),r[0]+" rarity");
  assert.equal(c.maxCopies,number(r[14]),r[0]+" copies");
 }
});
