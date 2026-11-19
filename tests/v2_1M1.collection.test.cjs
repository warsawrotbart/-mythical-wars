const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../collection-core-v2.1M1.js');
const folder=path.resolve(__dirname,'..');
const ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(folder,'card-catalog.js'),'utf8'),ctx);
const canonical=ctx.window.MW_CANONICAL_CARDS;
const artCtx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(folder,'warlock-card-art-v2.1I.js'),'utf8'),artCtx);
const builtins=artCtx.window.MW_WARLOCK_ART;
test('full canonical library is preserved, 162 unique IDs',()=>{
 assert.equal(canonical.length,162);
 assert.equal(new Set(Array.from(canonical,c=>c.cardId)).size,162);
 for(const c of canonical)assert.ok(core.TYPES[c.cardType],c.cardId);
});
test('45 embedded CHR artworks are test versions; missing art distinct',()=>{
 assert.equal(builtins.count(),45);
 const list=core.build(canonical,[],builtins),s=core.stats(list);
 assert.equal(list.length,162);
 assert.equal(s.artTest,45);
 assert.equal(s.artMissing,117);
 assert.equal(s.artApproved,0);
 assert.equal(s.frameNeeds,162);
 assert.ok(list.every(c=>c.frame==='base'));
});
test('class, type, art, frame, query and scope filters are composable',()=>{
 const rows=core.build(canonical,[],builtins);
 assert.equal(core.filter(rows,{art:'test'}).length,45);
 assert.equal(core.filter(rows,{art:'missing'}).length,117);
 assert.equal(core.filter(rows,{frame:'needs'}).length,162);
 assert.equal(core.filter(rows,{scope:'local'}).length,0);
 const example=rows.find(x=>x.id==='CHR-013');
 assert.ok(example);
 assert.equal(core.filter(rows,{query:'chr-013'}).length,1);
 assert.equal(core.filter(rows,{query:example.card.name.toLocaleLowerCase()}).some(x=>x.id==='CHR-013'),true);
 assert.ok(core.filter(rows,{classId:'Чернокнижник',type:'creature'}).length>0);
 assert.ok(core.filter(rows,{classId:'Воин',art:'test'}).length===0);
});
test('saved custom art is prioritised; approval and custom text are respected',()=>{
 const original=canonical.find(c=>c.cardId==='CHR-013');
 const saved={
   cardId:original.cardId,
   definition:{name:'Изменённая подпись',classId:original.classId,cardId:'HACKED'},
   project:{cardDefinition:{},assets:{customArtData:'data:image/png;base64,AA=='},
     metadata:{artStatus:'approved',frameApproved:true}}
 };
 const rows=core.build(canonical,[saved],builtins),card=rows.find(x=>x.id==='CHR-013');
 assert.equal(card.id,'CHR-013');
 assert.equal(card.card.name,'Изменённая подпись');
 assert.equal(card.art,'approved');
 assert.equal(card.artSource,'custom');
 assert.equal(card.frame,'approved');
 assert.equal(core.stats(rows).frameNeeds,161);
 assert.equal(original.name!=='Изменённая подпись',true);
});
test('thumbnail or default frame alone must NOT be reported as custom art',()=>{
 const rows=core.build(canonical,[{
   cardId:'KNZ-002',thumbnail:'data:image/png;base64,AAA',
   project:{metadata:{workflowStage:'approved'},cardPresentation:{layers:[{id:'frame'}]}}
 }],builtins);
 const card=rows.find(x=>x.id==='KNZ-002');
 assert.equal(card.art,'missing');
 assert.equal(card.frame,'base');
});
test('user-created local cards display separately without changing canonical count',()=>{
 const saved=[{cardId:'LOCAL-XYZ',definition:{
   cardId:'LOCAL-XYZ',name:'Мой новый воин',cardType:'creature',classId:'Воин'},
   project:{metadata:{artStatus:'test',frameStatus:'review'},
     assets:{customArtData:'data:image/webp;base64,AA=='}}}];
 const rows=core.build(canonical,saved,builtins),s=core.stats(rows);
 assert.equal(rows.length,163);
 assert.equal(s.canonical,162);
 assert.equal(s.local,1);
 assert.equal(core.filter(rows,{scope:'local'}).length,1);
 assert.equal(core.filter(rows,{frame:'test',scope:'local'}).length,1);
});
test('duplicate canonical and saved IDs never duplicate displayed records',()=>{
 const rows=core.build([...canonical,canonical[0]],[{
   cardId:canonical[0].cardId,definition:{name:'Local override',cardType:canonical[0].cardType}
 }],builtins);
 assert.equal(rows.length,162);
 assert.equal(rows[0].card.name,'Local override');
});
test('all collection functions are deterministic and do not mutate source',()=>{
 const input=canonical.slice(0,5).map(x=>JSON.parse(JSON.stringify(x)));
 const copy=JSON.stringify(input);
 const once=core.build(input,[],null);
 const twice=core.build(input,[],null);
 assert.deepEqual(once,twice);
 assert.equal(JSON.stringify(input),copy);
});
