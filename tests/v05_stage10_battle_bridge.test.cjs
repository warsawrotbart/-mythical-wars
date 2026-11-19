const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=p=>fs.readFileSync(path.join(root,p),'utf8');
const manifest=JSON.parse(source('v05/production/editor_manifest.json'));
const lib=require('../v05-library-core.js');
const sandbox={window:{}};
vm.runInNewContext(source('v05-library-seed.js'),sandbox);
globalThis.MW_V05_MANIFEST=manifest;
globalThis.MW_V05_LIBRARY_CORE=lib;
globalThis.MW_V05_LIBRARY_SEED=sandbox.window.MW_V05_LIBRARY_SEED;
const bridge=require('../battle-v05-card-bridge.js');
const cards=lib.normalizeSeed(globalThis.MW_V05_LIBRARY_SEED,manifest);
function fromRecord(id){
 const d=[...cards.cards,...cards.tokens].find(x=>x.id===id);
 assert.ok(d,'Known library ID '+id);
 const type={Creature:'creature',Spell:'spell',Weapon:'weapon'}[d.type];
 return {cardId:id,name:d.name,cardType:type,classId:d.class,
  rarityId:{Common:'common',Green:'standard',Blue:'rare',Purple:'epic',Gold:'legendary'}[d.rarity_key]||'common',
  costValue:d.cost,attack:d.attack,health:d.health,durability:d.durability,ability:d.description};
}
test('all 179 cards have a normalized v05 representation',()=>{
 assert.equal(cards.cards.length+cards.tokens.length,179);
 for(const row of [...cards.cards,...cards.tokens]){
  const mapped=bridge.toV05(fromRecord(row.id));
  assert.equal(mapped.id,row.id);
  assert.equal(mapped.name,row.name);
  assert.equal(mapped.type,row.type);
  assert.equal(mapped.class_key,row.class_key);
 }
});
test('battle layout uses game state numbers instead of changing combat data',()=>{
 const c=fromRecord('KNZ-019');
 c.attack=3;c.health=5;c.ability='TEST: combat copy';
 const data=bridge.toV05(c,7);
 assert.equal(data.cost,7);
 assert.equal(data.attack,3);assert.equal(data.health,5);
 assert.equal(data.description,'TEST: combat copy');
 assert.equal(c.costValue,4,'no engine writes');
});
test('one v05 manifest for editor, 2D, initial replacement and 3D',()=>{
 const html=source('index.html'),renderer=source('battle-card-renderer-v2.1C.js');
 for(const js of ['v05-dynamic-manifest.js','v05-dynamic-core.js','v05-library-core.js','battle-v05-card-bridge.js'])
   assert.ok(html.includes('src="'+js),js);
 assert.match(renderer,/MW_V05_BATTLE_CARD\.request/);
 assert.match(source('deckgame.js'),/renderer\.request\(c,"full"/);
 assert.match(source('arena-3d-v2.1H.js'),/MW_BATTLE_CARD_RENDERER/);
});
test('font-aware digit alignment and contrast present in editor and battle',()=>{
 const battle=source('battle-v05-card-bridge.js'),editor=source('v05-dynamic.js');
 for(const item of [battle,editor]){
  assert.match(item,/finish\.drawNumber/);
  assert.match(item,/#ffdf9c/);
  assert.match(item,/#351920/);
 }
});
test('v05A uses the immutable v05 base and aligns optical centers by card type',()=>{
 const finish=require('../v05-card-finish.js'),core=require('../v05-dynamic-core.js');
 const base=require('../v05/production/editor_manifest.json');
 const oldSlots=JSON.stringify(base.slots),layout=finish.manifest(base);
 assert.equal(JSON.stringify(base.slots),oldSlots);
 for(const [type,second] of [['Creature','health'],['Weapon','durability']]){
  const [a,b]=['attack',second].map(field=>layout.number_bindings.find(item=>item.field===field&&item.types.includes(type)));
  assert.ok(Math.abs(a.center[1]-b.center[1])<.001);
 }
 for(const type of ['Creature','Spell','Weapon']){
  const plan=finish.drawPlan(core,{type,class_key:'Warrior',cost:2},layout);
  const body=plan.findIndex(part=>part.key==='Common_Outer_Body');
  const rim=plan.findIndex(part=>part.key===type+'_Inner_Art_Frame');
  const illustration=plan.findIndex(part=>part.kind==='art');
  const title=plan.findIndex(part=>part.key==='Common_Title_Curl_Left_Color');
  assert.ok(body<illustration&&illustration<rim&&rim<title);
  assert.equal(plan.filter(part=>part.lens).length,2);
 }
});
test('3D can show a readable face while texture is loading',()=>{
 const src=source('arena-3d-v2.1H.js');
 assert.match(src,/genericFace\(/);
 assert.match(src,/if\(gl&&!gl\.isContextLost\(\)&&!textures\.has\(id\)\)addTexture\(id,genericFace/);
 assert.match(src,/addTexture\(id,img\)/);
});
test('mulligan/rendered face fallbacks do not lock pending flags',()=>{
 const src=source('battle-card-renderer-v2.1C.js');
 assert.match(src,/\.finally\(\(\)=>\{\s*\/\/ Failed promises/);
 assert.match(source('battle-v05-card-bridge.js'),/safeCardFallback/);
});
