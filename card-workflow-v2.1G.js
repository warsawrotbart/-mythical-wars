/* MW v2.1G — tested, offline card workflow: CSV round-trip, art checks and ZIP export.
   No network calls, no changes to the gameplay engine. */
(function(root,factory){
 "use strict";
 const api=factory();
 root.MW_CARD_WORKFLOW=api;
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis,function(){
 "use strict";
 const FIELDS=["cardId","name","cardType","classId","rarityId","costType","costValue",
   "attack","health","durability","timeAffinityId","creatureTypeId","subtype",
   "ability","flavor","keywords","schoolId","updatedAt","stage"];
 const NUMERIC=new Set(["costValue","attack","health","durability"]);
 const TYPES=new Set(["creature","spell","weapon"]);
 const STAGES=new Set(["draft","review","approved"]);
 const ID=/^[\p{L}\p{N}_-][\p{L}\p{N}_.-]{1,79}$/u;
 const clean=x=>String(x??"").trim();
 const data=(entry)=>entry?.project?.cardDefinition || entry?.definition || {};
 function csvCell(v){
   let s=String(v===null||v===undefined?"":v);
   // Prevent formula execution when CSV is opened in spreadsheet software.
   if(/^[\s]*[=+@]/.test(s)||(/^[\s]*-/.test(s)&&!/^\s*-\d+(?:[.,]\d+)?\s*$/.test(s)))s="'"+s;
   return '"'+s.replaceAll('"','""')+'"';
 }
 function encodeCSV(rows){return "\uFEFF"+rows.map(row=>row.map(csvCell).join(",")).join("\r\n")+"\r\n";}
 function delimiterOf(raw){
   const first=String(raw).split(/\r?\n/).slice(0,5);
   const score=d=>first.reduce((sum,line)=>{
     let quote=false,n=0;
     for(let i=0;i<line.length;i++){
       if(line[i]==='"'){if(quote&&line[i+1]==='"')i++;else quote=!quote;}
       else if(!quote&&line[i]===d)n++;
     } return sum+n;
   },0);
   return [",","\t",";"].sort((a,b)=>score(b)-score(a))[0];
 }
 function parseCSV(input,limit=5000){
   const raw=String(input??"").replace(/^\uFEFF/,"");
   if(raw.length>10*1024*1024)throw Error("CSV превышает 10 МБ.");
   const delim=delimiterOf(raw),out=[];let row=[],part="",quoted=false;
   for(let i=0;i<raw.length;i++){
     const c=raw[i];
     if(c==='"'){if(quoted&&raw[i+1]==='"'){part+='"';i++;}else quoted=!quoted;}
     else if(c===delim&&!quoted){row.push(part);part="";}
     else if((c==="\r"||c==="\n")&&!quoted){
       if(c==="\r"&&raw[i+1]==="\n")i++;
       row.push(part);part="";
       if(row.some(x=>clean(x)))out.push(row);
       row=[];if(out.length>limit)throw Error("Превышен лимит 5000 строк.");
     }else part+=c;
   }
   if(quoted)throw Error("В CSV не закрыты кавычки.");
   row.push(part);if(row.some(x=>clean(x)))out.push(row);
   return out;
 }
 function toCardsCSV(entries){
   const rows=[FIELDS];
   for(const e of entries||[]){
     const d=data(e);
     rows.push(FIELDS.map(f=>{
       if(f==="updatedAt")return e.updatedAt||"";
       if(f==="stage")return e.stage||"draft";
       const v=d[f];return Array.isArray(v)?v.join("; "):v??"";
     }));
   }
   return encodeCSV(rows);
 }
 function getCardRows(input){
   const rows=Array.isArray(input)?input:parseCSV(input);
   if(rows.length<1)throw Error("Таблица пуста.");
   const headers=rows[0].map(x=>clean(x).replace(/^\uFEFF/,""));
   if(!headers.includes("cardId")||!headers.includes("cardType")||!headers.includes("name"))
     throw Error("Нужны столбцы cardId, cardType, name (как в экспорте редактора).");
   if(new Set(headers).size!==headers.length)throw Error("Повторяющиеся заголовки CSV.");
   return rows.slice(1).filter(r=>r.some(x=>clean(x))).map((r,i)=>{
     const d={};for(let j=0;j<headers.length;j++)if(FIELDS.includes(headers[j]))
       d[headers[j]]=String(r[j]??"");
     d.__line=i+2;return d;
   });
 }
 function normalizeValue(key,value){
   if(NUMERIC.has(key)){
     if(clean(value)==="")return null;
     const s=clean(value).replace(",",".");
     const n=Number(s);
     if(!Number.isFinite(n)||n<0||n>1000||!Number.isInteger(n))throw Error(key+": должно быть целое число от 0 до 1000");
     return n;
   }
   if(key==="keywords")return clean(value).split(/[;,]/).map(clean).filter(Boolean);
   return String(value??"").trim();
 }
 function compareValue(v){
   return JSON.stringify(v===undefined?null:v);
 }
 function planCardsImport(input,existing=[],canonicalIds=[]){
   const rows=getCardRows(input),existingMap=new Map([...existing].map(e=>[e.cardId,e]));
   const canonical=new Set(canonicalIds),ids=new Set(),plan=[];
   for(const row of rows){
     const id=clean(row.cardId),ex=existingMap.get(id),report={id,line:row.__line,kind:"",changes:[],values:{},row};
     if(!ID.test(id)){report.kind="error";report.reason="Некорректный ID";plan.push(report);continue;}
     if(ids.has(id)){report.kind="error";report.reason="ID повторяется в CSV";plan.push(report);continue;}
     ids.add(id);
     if(canonical.has(id)){report.kind="protected";report.reason="Каноническая карта: игровые данные защищены";plan.push(report);continue;}
     if(!TYPES.has(clean(row.cardType))){report.kind="error";report.reason="Неверный тип карты";plan.push(report);continue;}
     if(!clean(row.name)){report.kind="error";report.reason="Не заполнено название";plan.push(report);continue;}
     if(clean(row.name).length>180){report.kind="error";report.reason="Название длиннее 180 символов";plan.push(report);continue;}
     if(ex&&clean(data(ex).cardType)!==clean(row.cardType)){
       report.kind="conflict";report.reason="Тип существующей карты нельзя менять";plan.push(report);continue;
     }
     // Exported updatedAt acts as an optimistic concurrency token.
     if(ex && (!clean(row.updatedAt)||clean(row.updatedAt)!==clean(ex.updatedAt))){
       report.kind="conflict";report.reason="Версия устарела или отсутствует updatedAt. Экспортируйте новый CSV.";plan.push(report);continue;
     }
     try{
       for(const key of FIELDS){
         if(key==="cardId"||key==="updatedAt"||key==="stage"||!Object.hasOwn(row,key))continue;
         report.values[key]=normalizeValue(key,row[key]);
         const before=data(ex)[key];
         if(!ex||compareValue(before)!==compareValue(report.values[key]))report.changes.push(key);
       }
       if(Object.hasOwn(row,"stage")){
         const stage=clean(row.stage)||"draft";
         if(!STAGES.has(stage))throw Error("Неверный этап готовности карты: "+stage);
         report.stage=stage;
         if(ex&&(ex.stage||"draft")!==stage)report.changes.push("stage");
       }else report.stage=ex?.stage||"draft";
       report.kind=!ex?"new":report.changes.length?"update":"unchanged";
     }catch(e){report.kind="error";report.reason=e.message;}
     plan.push(report);
   }
   return plan;
 }
 function inspectArt(w,h,kind,holes){
   const hole=holes?.[kind],width=Number(w)||0,height=Number(h)||0;
   if(!hole)return{ok:false,warning:"Неизвестный тип карты"};
   const targetW=hole.w,targetH=hole.h;
   const factor=Math.max(targetW/Math.max(width,1),targetH/Math.max(height,1));
   const recommended={width:targetW*2,height:targetH*2};
   const warning=width<targetW||height<targetH?
     "Арт меньше рабочей области. При увеличении возможна потеря чёткости.":
     width<recommended.width||height<recommended.height?
     "Размер допустим, но для чёткой печати рекомендован исходник крупнее.":"";
   return {ok:width>=targetW&&height>=targetH,warning,
     image:{width,height},mask:{width:targetW,height:targetH,shape:hole.shape},
     recommended,coverScale:Math.round(factor*100)/100};
 }
 const crcTable=(()=>{const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;
   for(let j=0;j<8;j++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[i]=c>>>0;}return t;})();
 function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
 function makeHeader(length){
   const a=new Uint8Array(length);return{data:a,view:new DataView(a.buffer)};
 }
 // ZIP "store" (no compression) is valid offline and avoids an external ZIP library.
 async function makeZip(files){
   if(!Array.isArray(files)||files.length>150)throw Error("В одной выгрузке допускается до 150 файлов.");
   let offset=0,total=0;const parts=[],central=[],enc=new TextEncoder();
   const names=new Set();
   for(const f of files){
     const name=String(f.name||"").replaceAll("\\","/");
     if(!name||name.startsWith("/")||name.includes("..")||names.has(name)||name.length>240)
       throw Error("Неверное или повторяющееся имя файла: "+name);
     names.add(name);
     let bytes;
     if(f.data instanceof Uint8Array)bytes=f.data;
     else if(f.data instanceof ArrayBuffer)bytes=new Uint8Array(f.data);
     else if(typeof Blob!=="undefined" && f.data instanceof Blob)bytes=new Uint8Array(await f.data.arrayBuffer());
     else bytes=enc.encode(String(f.data??""));
     total+=bytes.length;
     if(total>500*1024*1024)throw Error("Архив превышает 500 МБ. Экспортируйте меньше карт.");
     const filename=enc.encode(name),size=bytes.length,crc=crc32(bytes);
     const flag=0x0800,method=0,dosTime=0,dosDate=(46<<9)|(1<<5)|1; // 2026-01-01
     const local=makeHeader(30+filename.length),v=local.view;
     v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,flag,true);
     v.setUint16(8,method,true);v.setUint16(10,dosTime,true);v.setUint16(12,dosDate,true);
     v.setUint32(14,crc,true);v.setUint32(18,size,true);v.setUint32(22,size,true);
     v.setUint16(26,filename.length,true);local.data.set(filename,30);
     parts.push(local.data,bytes);
     const center=makeHeader(46+filename.length),w=center.view;
     w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);
     w.setUint16(8,flag,true);w.setUint16(10,method,true);w.setUint16(12,dosTime,true);
     w.setUint16(14,dosDate,true);w.setUint32(16,crc,true);w.setUint32(20,size,true);
     w.setUint32(24,size,true);w.setUint16(28,filename.length,true);
     w.setUint32(42,offset,true);center.data.set(filename,46);central.push(center.data);
     offset+=local.data.length+size;
   }
   const centralLen=central.reduce((n,b)=>n+b.length,0),end=makeHeader(22),v=end.view;
   v.setUint32(0,0x06054b50,true);v.setUint16(8,central.length,true);
   v.setUint16(10,central.length,true);v.setUint32(12,centralLen,true);v.setUint32(16,offset,true);
   return new Blob([...parts,...central,end.data],{type:"application/zip"});
 }

 function tableObjects(csv,required){
   const rows=Array.isArray(csv)?csv:parseCSV(csv);
   if(!rows.length)throw Error("Пустая таблица.");
   const names=rows[0].map(clean);
   for(const field of required)if(!names.includes(field))throw Error("Нет столбца "+field+".");
   if(new Set(names).size!==names.length)throw Error("Дубли заголовков.");
   return rows.slice(1).filter(r=>r.some(x=>clean(x))).map((r,i)=>{
     const d={};names.forEach((k,j)=>d[k]=clean(r[j]));d.__line=i+2;return d;
   });
 }
 function planDecksImport(decksCSV,countsCSV,existing=[],classes=[]){
   const rows=tableObjects(decksCSV,["deckId","name","classId","updatedAt"]);
   const counts=tableObjects(countsCSV,["deckId","cardId","quantity"]);
   if(rows.length>1000||counts.length>5000)throw Error("Слишком много строк колод.");
   const byDeck=new Map(),invalidCounts=new Map();
   const keys=new Set();
   for(const r of counts){
     if(!r.deckId||!r.cardId){invalidCounts.set(r.deckId||"?", "В составе отсутствует ID колоды/карты");continue;}
     const key=r.deckId+"\0"+r.cardId;
     if(keys.has(key)){invalidCounts.set(r.deckId,"Повторяющаяся карта "+r.cardId);continue;}
     keys.add(key);
     const qty=Number(r.quantity);
     if(!/^\d+$/.test(r.quantity)||!Number.isInteger(qty)||qty<0||qty>30){
       invalidCounts.set(r.deckId,"Неверное количество у "+r.cardId);continue;
     }
     if(!byDeck.has(r.deckId))byDeck.set(r.deckId,{});
     if(qty>0)byDeck.get(r.deckId)[r.cardId]=qty;
   }
   const existingMap=new Map(existing.map(x=>[x.deckId,x])),ids=new Set(),out=[];
   for(const r of rows){
     const e=existingMap.get(r.deckId),p={id:r.deckId,row:r,kind:"",reason:""};
     const current=byDeck.get(r.deckId)||{};
     p.deck={deckId:r.deckId,name:r.name,classId:r.classId,counts:current,
       source:"Google Sheets · CSV",updatedAt:r.updatedAt||""};
     if(!r.deckId||r.deckId.length>120||!r.name||r.name.length>150){
       p.kind="error";p.reason="Неверный ID или название колоды";
     }else if(ids.has(r.deckId)){
       p.kind="error";p.reason="Повтор ID колоды";
     }else if(classes.length&&!classes.includes(r.classId)){
       p.kind="error";p.reason="Неизвестный класс героя";
     }else if(invalidCounts.has(r.deckId)){
       p.kind="error";p.reason=invalidCounts.get(r.deckId);
     }else if(e && r.deckId.startsWith("sample-")){
       p.kind="protected";p.reason="Исходная колода защищена от перезаписи";
     }else if(e&&(!r.updatedAt||r.updatedAt!==e.updatedAt)){
       p.kind="conflict";p.reason="Колода изменена после экспорта (updatedAt)";
     }else if(!e){
       p.kind="new";
     }else if(e.name!==r.name||e.classId!==r.classId||
       JSON.stringify(Object.entries(e.counts||{}).sort())!==JSON.stringify(Object.entries(current).sort())){
       p.kind="update";
     }else p.kind="unchanged";
     ids.add(r.deckId);out.push(p);
   }
   for(const [id,reason] of invalidCounts)if(!ids.has(id))out.push({id,kind:"error",reason});
   return out;
 }

 return {FIELDS,TYPES,STAGES,parseCSV,encodeCSV,toCardsCSV,getCardRows,planCardsImport,
   planDecksImport,inspectArt,makeZip};
});
