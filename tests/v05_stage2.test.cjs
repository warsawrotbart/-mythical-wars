/* v05 Stage 2: independent dynamic card compositor contract tests. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const root=path.resolve(__dirname,"..");
const m=JSON.parse(fs.readFileSync(path.join(root,"v05/production/editor_manifest.json"),"utf8"));
const core=require("../v05-dynamic-core.js");
const control=JSON.parse(fs.readFileSync(path.join(root,"v05/production/sample_cards.json"),"utf8"));
const sample=Array.isArray(control)?control:(control.cards||m.sample_cards);
const issues=(c,opts={hasArt:true})=>core.validateCard(c,m,opts);
const blockers=c=>issues(c).filter(i=>i.severity==="error");
test("v05 manifest geometry and 3 official template types",()=>{
  assert.equal(m.version,"v05");assert.deepEqual(Object.keys(m.templates).sort(),core.TYPES.slice().sort());
  assert.equal(m.canvas.width,1024);assert.equal(m.canvas.height,1536);
  assert.equal(Object.keys(m.class_palettes).length,8);
  assert.equal(Object.keys(m.assets).length,88);
});
test("each official control card validates with its original art",()=>{
  assert.deepEqual(sample.map(c=>c.id),["KNZ-019","KNZ-006","KNZ-014"]);
  for(const c of sample)assert.deepEqual(blockers(c),[],c.id+" issues");
});
test("draw plan includes base layers in order and art exactly once after declared backing",()=>{
  for(const card of sample){
    const plan=core.drawPlan(card,m);
    const type=m.templates[card.type];
    const ix=plan.findIndex(v=>v.kind==="art");
    assert.equal(plan.filter(v=>v.kind==="art").length,1);
    assert.equal(plan[ix-1].key,type.insert_art_after_layer);
    assert.equal(plan[ix].mask,type.art_mask);
    assert.ok(plan.some(v=>v.kind==="dynamic_text"));
    assert.ok(!plan.some(v=>v.kind==="asset"&&!m.assets[v.key]));
  }
});
test("only approved color layers have tint flag, not gold, art, shadow or icons",()=>{
  for(const card of sample){
    for(const layer of core.drawPlan(card,m)){
      if(layer.tint)assert.match(layer.key,/_Color$/);
      if(/_Shadow$|_Highlight$|Gold|Art|Badge/.test(layer.key||""))
        assert.equal(layer.tint,false,layer.key)
    }
  }
});
test("neutral creature has no class badge",()=>{
  const c={...sample[0],class_key:"Neutral",class:"Нейтральные"};
  const plan=core.drawPlan(c,m);
  assert.equal(plan.some(v=>v.component==="class_badge"),false);
});
test("0 is numeric and visible, null is hidden",()=>{
  const c={...sample[0],cost:0,attack:0,health:0,armor:0};
  assert.equal(blockers(c).length,0);
  const plan=core.drawPlan(c,m);
  assert.ok(plan.some(v=>v.component==="armor"));
  assert.ok(plan.some(v=>v.component==="mana"));
  const d={...c,armor:null};
  assert.equal(core.drawPlan(d,m).some(v=>v.component==="armor"),false);
  assert.equal(core.maybe("—"),null);
});
test("missing illustration blocks final export without deleting card data",()=>{
  const errors=issues(sample[1],{hasArt:false});
  assert.ok(errors.some(x=>x.code==="art-missing"));
});
test("unknown race/time/rarity/class are not guessed",()=>{
  for(const [field,value] of [["race_icon_key","Troll"],["time_key","Dusk"],["rarity_key","Rainbow"],["class_key","Mystery"]]){
    assert.ok(blockers({...sample[0],[field]:value}).length,field)
  }
});
test("weapon/spell nonempty subtype blocks export until slot approved",()=>{
  for(const i of [1,2]){
    assert.ok(blockers({...sample[i],subtype:"Невядомы"}).some(x=>x.code==="subtype-layout-pending"));
    assert.ok(blockers({...sample[i],subtype_icon_key:"Druzhyna"}).some(x=>x.code==="subtype-layout-pending"));
  }
});
test("unknown creature subtype icon must not map randomly",()=>{
  const c={...sample[0],subtype:"Новый",subtype_icon_key:null};
  assert.ok(blockers(c).some(x=>x.code==="missing-subtype-symbol"));
});
test("data validation catches fractional/negative/unsafe numbers",()=>{
  for(const v of [-1,2.5,Number.MAX_SAFE_INTEGER+1]){
    assert.ok(blockers({...sample[0],cost:v}).some(x=>x.code.startsWith("number-")));
  }
});
test("crop cover maintains aspect and viewport at zoom=1",()=>{
  for(const t of core.TYPES){
    const {art_viewport:v,art_crop_center:c}=m.templates[t];
    const p=core.imagePlacement(1254,1254,v,{x:c[0],y:c[1],zoom:1});
    assert.ok(p.dw>=v[2]-v[0]-.1);
    assert.ok(p.dh>=v[3]-v[1]-.1);
    assert.ok(p.dx<=v[0]&&p.dy<=v[1]);
    assert.ok(p.dx+p.dw>=v[2]&&p.dy+p.dh>=v[3]);
  }
});
test("zoom and crop are bounded and reject underscale",()=>{
  const v=m.templates.Creature.art_viewport;
  assert.throws(()=>core.imagePlacement(100,200,v,{zoom:.9}),/Масштаб/);
  const p=core.imagePlacement(100,200,v,{x:2,y:-10,zoom:2});
  assert.equal(p.x,1);assert.equal(p.y,0);assert.equal(p.zoom,2);
});
test("all v05 files in draw plans exist and alpha masks are generated",()=>{
  for(const c of sample){
    for(const p of core.drawPlan(c,m)){
      if(p.kind!=="asset")continue;
      const assetPath=path.join(root,"v05",m.assets[p.key].path);
      assert.ok(fs.existsSync(assetPath),assetPath)
    }
    const mask=m.templates[c.type].art_mask;
    assert.ok(fs.existsSync(path.join(root,"v05/runtime",mask+"_alpha.png")));
  }
});
test("source manifest SHA256 is unchanged from verified stage 1",()=>{
  const digest=crypto.createHash("sha256").update(fs.readFileSync(path.join(root,"v05/production/editor_manifest.json"))).digest("hex");
  assert.equal(digest,"190371ce21046ba4530b9cb93b374292645218f4fcbe0a0f7e5ff0e529f5529f")
});
test("no bulk application is exposed in the dynamic standalone script",()=>{
  const s=fs.readFileSync(path.join(root,"v05-dynamic.js"),"utf8");
  for(const word of ["localStorage.setItem","indexedDB.open","fetch('/api","applyAllTemplates"]){
    assert.equal(s.includes(word),false,word);
  }
});
