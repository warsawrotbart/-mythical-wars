/* Node regression tests for MW v2.1G offline workflow. */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const wf=require("../card-workflow-v2.1G.js");
let count=0;const yes=(x,label)=>{assert.ok(x,label);count++;console.log("PASS",label);};
(async()=>{
 const input=[["cardId","name","cardType","ability"],["LOCAL-01",'Иван, "Меч"',"creature","Строка\nещё строка"]];
 const csv=wf.encodeCSV(input),rows=wf.parseCSV(csv);
 yes(rows[1][1]==='Иван, "Меч"'&&rows[1][3].includes("\n"),"multiline quoted CSV roundtrip");
 yes(wf.parseCSV("cardId\tname\tcardType\nA-01\tТест\tspell")[1][1]==="Тест","TSV paste");
 yes(wf.encodeCSV([["name"],["=1+2"]]).includes("'=1+2"),"spreadsheet formula escaping");
 const d={cardId:"LOCAL-01",name:"Карта",cardType:"creature",classId:"Воин",rarityId:"common",
   costType:"mana",costValue:1,attack:2,health:3,durability:null,ability:"",keywords:[]};
 const existing=[{cardId:"LOCAL-01",updatedAt:"2026-11-08T00:00:00Z",project:{cardDefinition:d},stage:"draft"}];
 const cardCSV=wf.toCardsCSV(existing),parsed=wf.getCardRows(cardCSV);
 yes(parsed.length===1&&parsed[0].updatedAt===existing[0].updatedAt,"card CSV column headers and revision");
 const idx=wf.FIELDS.indexOf("attack"),csvRows=wf.parseCSV(cardCSV);
 csvRows[1][idx]="5";
 const plan=wf.planCardsImport(wf.encodeCSV(csvRows),existing,[]);
 yes(plan.length===1&&plan[0].kind==="update"&&plan[0].values.attack===5,"existing local attack update planned");
 const old=wf.parseCSV(cardCSV);old[1][wf.FIELDS.indexOf("updatedAt")]="2025-01-01";
 yes(wf.planCardsImport(wf.encodeCSV(old),existing,[])[0].kind==="conflict","revision conflict blocked");
 yes(wf.planCardsImport(cardCSV,existing,["LOCAL-01"])[0].kind==="protected","canonical card blocked");
 const added=wf.planCardsImport(wf.encodeCSV([wf.FIELDS,
    ["LOCAL-02","Новая","spell","Воин","common","mana","2","","","","","","","Выберите цель","","","", "", "draft"]]),existing,[]);
 yes(added[0].kind==="new","new card staged");
 const sizes={creature:{w:752,h:964,shape:"oval"},spell:{w:784,h:672,shape:"rectangle"}};
 yes(wf.inspectArt(320,480,"creature",sizes).warning.includes("меньше"),"undersize art warning");
 yes(wf.inspectArt(1600,2000,"creature",sizes).ok,"large art accepted");
 const decks=[{deckId:"d01",name:"Колода",classId:"Воин",counts:{'LOCAL-01':2},updatedAt:"abc"}];
 const dc=wf.encodeCSV([["deckId","name","classId","updatedAt"],["d01","Колода","Воин","abc"],["d02","Тест","Воин",""]]);
 const cc=wf.encodeCSV([["deckId","cardId","quantity"],["d01","LOCAL-01","2"],["d02","LOCAL-01","2"]]);
 const dp=wf.planDecksImport(dc,cc,decks,["Воин"]);
 yes(dp.length===2&&dp[0].kind==="unchanged"&&dp[1].kind==="new","new deck import");
 const dconf=wf.planDecksImport(dc.replace('"abc"','"other"'),cc,decks,["Воин"]);
 yes(dconf[0].kind==="conflict","deck version mismatch");
 const zp=await wf.makeZip([{name:"cards/тест.png",data:new Uint8Array([137,80,78,71])},
   {name:"Карты.csv",data:cardCSV}]);
 yes(zp.type==="application/zip"&&zp.size>50,"offline ZIP created");
 fs.writeFileSync(path.join(__dirname,"v2_1G_workflow_test.zip"),Buffer.from(await zp.arrayBuffer()));
 console.log(`RESULT ${count}/${count} workflow assertions`);
})().catch(e=>{console.error(e);process.exitCode=1;});
