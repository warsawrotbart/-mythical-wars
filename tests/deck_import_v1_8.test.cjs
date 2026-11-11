const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
global.window=global;
require("../card-catalog.js");
const deck=require("../deck-model.js"),imp=require("../deck-sheet-import.js");
const catalog=deck.indexCatalog(window.MW_CANONICAL_CARDS);
let n=0;
function check(name,fn){fn();n++;console.log("PASS",name);}
for(const [filename,cls] of [["woin_30.csv","Воин"],["chernoknizhnik_30.csv","Чернокнижник"],["nekromant_30.csv","Некромант"]]){
 check(filename+" recognized with 30 valid cards",()=>{
  const text=fs.readFileSync(path.join(__dirname,"..","examples",filename),"utf8");
  const rows=imp.parseCSV(text),match=imp.detectHeader(rows);
  assert.equal(match.row,0);
  assert.equal(match.columns.qty,0);assert.equal(match.columns.id,1);
  const result=imp.scanDeck({rows},{header:0,idColumn:1,qtyColumn:0,nameColumn:2,classId:cls},catalog,deck);
  assert.equal(result.ok,true,result.errors.join("\n"));
  assert.equal(result.total,30);
 });
}
check("TSV text pasted from Google Sheets",()=>{
 const rows=imp.parseCSV("Кол-во\tID\tНазвание\n2\tKNZ-002\tМАЛАДЫ ДРУЖЫННІК");
 const match=imp.detectHeader(rows);
 assert.equal(match.columns.qty,0);assert.equal(match.columns.id,1);
});
check("XLSX numeric count with .0 is accepted",()=>{
 const r=imp.scanDeck({rows:[["Кол-во","ID","Название"],["2.0","KNZ-002","МАЛАДЫ ДРУЖЫННІК"]]},
  {header:0,idColumn:1,qtyColumn:0,nameColumn:2,classId:"Воин"},catalog,deck);
 assert.equal(r.total,2);
 assert.equal(r.items.length,1);
});
check("Notes and totals below Necromancer deck are ignored",()=>{
 const rows=[["Кол-во","ID"],["1.0","NCR-001"],[],["Всего карт","1"],["Статус: тестовая колода, пояснение после списка"]];
 const r=imp.scanDeck({rows},{header:0,idColumn:1,qtyColumn:0,nameColumn:-1,classId:"Некромант"},catalog,deck);
 assert.equal(r.items.length,1);
 assert.ok(!r.errors.some(x=>x.includes("Строка 5")),r.errors.join("\n"));
});
check("Unknown IDs and incomplete decks block import",()=>{
 const r=imp.scanDeck({rows:[["Кол-во","ID"],["2","XXX-999"]]},
 {header:0,idColumn:1,qtyColumn:0,nameColumn:-1,classId:"Воин"},catalog,deck);
 assert.equal(r.ok,false);
 assert.ok(r.errors.some(x=>x.includes("не найдена")));
});
check("Wrong hero class fails validation",()=>{
 const text=fs.readFileSync(path.join(__dirname,"..","examples","woin_30.csv"),"utf8");
 const rows=imp.parseCSV(text);
 const r=imp.scanDeck({rows},{header:0,idColumn:1,qtyColumn:0,nameColumn:2,classId:"Некромант"},catalog,deck);
 assert.equal(r.ok,false);
});
console.log("IMPORT CHECKS:",n,"passed");
