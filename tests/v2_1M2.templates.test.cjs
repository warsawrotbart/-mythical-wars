/* Regression tests for stage 2. Run via `node --test`. */
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const fs=require("node:fs");
const lab=require("../template-lab-core-v2.1M2.js");

test("Exactly three base types and four canonical class options (12 combinations)",()=>{
  assert.deepEqual(lab.TYPES,["creature","spell","weapon"]);
  assert.deepEqual(lab.CLASSES,["Воин","Чернокнижник","Некромант","Нейтральная"]);
  const d=lab.create(),out=lab.inspect(d);
  assert.equal(out.types,3);assert.equal(out.classOptions,12);
  for(const t of lab.TYPES)for(const cl of lab.CLASSES){
    assert.equal(lab.resolve(d,t,cl).frameVariant,"default");
    assert.equal(lab.inherited(d,t,cl,"nameColor"),true);
    assert.ok(fs.existsSync(path.join(__dirname,"..",lab.assetFor(t,"default"))));
    assert.ok(fs.existsSync(path.join(__dirname,"..",lab.assetFor(t,"alt"))));
  }
});
test("Art windows remain locked to type: oval, rectangle, circle",()=>{
  assert.equal(lab.WINDOWS.creature.shape,"oval");
  assert.equal(lab.WINDOWS.spell.shape,"rectangle");
  assert.equal(lab.WINDOWS.weapon.shape,"circle");
});
test("One class override cannot change another class or another card type",()=>{
  const base=lab.create();
  const next=lab.setClass(base,"creature","Чернокнижник","frameVariant","alt");
  assert.equal(lab.resolve(next,"creature","Чернокнижник").frameVariant,"alt");
  assert.equal(lab.resolve(next,"creature","Воин").frameVariant,"default");
  assert.equal(lab.resolve(next,"weapon","Чернокнижник").frameVariant,"default");
  assert.equal(lab.resolve(base,"creature","Чернокнижник").frameVariant,"default");
});
test("Base changes propagate only where the class inherits the field",()=>{
  let d=lab.create();
  d=lab.setClass(d,"creature","Воин","nameSize",62);
  d=lab.setBase(d,"creature","nameSize",55);
  assert.equal(lab.resolve(d,"creature","Воин").nameSize,62);
  assert.equal(lab.resolve(d,"creature","Некромант").nameSize,55);
  assert.equal(lab.resolve(d,"spell","Воин").nameSize,46);
});
test("Individual field can return to base without losing other overrides",()=>{
  let d=lab.create();
  d=lab.setClass(d,"spell","Некромант","nameColor","#123456");
  d=lab.setClass(d,"spell","Некромант","bodySize",59);
  d=lab.resetClassField(d,"spell","Некромант","nameColor");
  assert.equal(lab.inherited(d,"spell","Некромант","nameColor"),true);
  assert.equal(lab.resolve(d,"spell","Некромант").bodySize,59);
});
test("Clear class only affects one template combination",()=>{
  let d=lab.create();
  d=lab.setClass(d,"weapon","Воин","frameVariant","alt");
  d=lab.setClass(d,"weapon","Воин","titleWidth",600);
  d=lab.setClass(d,"weapon","Чернокнижник","frameVariant","alt");
  d=lab.resetClass(d,"weapon","Воин");
  assert.equal(lab.resolve(d,"weapon","Воин").titleWidth,714);
  assert.equal(lab.resolve(d,"weapon","Воин").frameVariant,"default");
  assert.equal(lab.resolve(d,"weapon","Чернокнижник").frameVariant,"alt");
});
test("Canonical neutral alias resolves to the same class",()=>{
  let d=lab.setClass(lab.create(),"creature","Нейтральная","accentColor","#405060");
  assert.equal(lab.resolve(d,"creature","Нейтральные").accentColor,"#405060");
});
test("JSON export / import is a lossless, versioned style-only round trip",()=>{
  let d=lab.setClass(lab.create(),"creature","Воин","bodyColor","#102030");
  d=lab.setBase(d,"weapon","frameVariant","alt");
  const json=lab.serialize(d),restored=lab.deserialize(json);
  assert.deepEqual(restored,d);
  assert.equal(restored.schema,lab.SCHEMA);
  assert.equal(JSON.stringify(restored).includes("cardDefinition"),false);
  assert.equal(JSON.stringify(restored).includes("customArtData"),false);
});
test("Reject invalid frame assets, XSS text, stats or arbitrary extra properties",()=>{
  let d=lab.create();
  assert.throws(()=>lab.setBase(d,"spell","frameVariant","https://evil.invalid/x.png"));
  assert.throws(()=>lab.setBase(d,"spell","accentColor","javascript:alert(1)"));
  assert.throws(()=>lab.setBase(d,"spell","cardId","CHR-001"));
  assert.throws(()=>lab.setBase(d,"spell","bodySize",200));
  assert.throws(()=>lab.deserialize("{\"schema\":\"bad\"}"));
  assert.throws(()=>lab.deserialize("x".repeat(210000)));
});
test("Malformed imported value throws instead of overwriting saved state",()=>{
  const obj=lab.create();
  obj.overrides.creature={Воин:{bodyColor:"<script>alert(1)</script>"}};
  assert.throws(()=>lab.deserialize(JSON.stringify(obj)));
});
test("Template draft module deliberately provides no apply-to-cards entrypoint",()=>{
  assert.equal(lab.apply,undefined);
  assert.equal(lab.applyToCollection,undefined);
  const src=fs.readFileSync(path.join(__dirname,"../template-lab-ui-v2.1M2.js"),"utf8");
  assert.ok(!src.includes("openCatalogCard("));
  assert.ok(!src.includes("saveLibraryCard("));
});
test("New template navigation is present and the previous Collection screen is preserved",()=>{
  const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
  for(const name of ["mwTemplatesNav","mwTemplatesWorkspace","mwCollectionNav","mwCollectionWorkspace"]){
    assert.ok(html.includes(`id="${name}"`),name);
  }
  assert.ok(html.includes("template-lab-core-v2.1M2.js"));
  assert.ok(html.includes("template-lab-ui-v2.1M2.js"));
  assert.ok(html.includes("collection-ui-v2.1M1.js"));
});
