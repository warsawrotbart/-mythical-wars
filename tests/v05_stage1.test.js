// The v05 integration must not infer geometry or colors from legacy v01/v04R.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'v05/production/editor_manifest.json'),'utf8'));
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'v05-meta.js'),'utf8'),sandbox);
const meta=sandbox.window.MW_V05_META;
const digest = b=>crypto.createHash('sha256').update(b).digest('hex');
test('v05 manifest identity and geometry',()=>{
  assert.equal(manifest.version,'v05');
  assert.equal(manifest.canvas.width,1024);
  assert.equal(manifest.canvas.height,1536);
  assert.deepEqual(Object.keys(manifest.templates).sort(),['Creature','Spell','Weapon']);
  assert.equal(Object.keys(manifest.class_palettes).length,8);
  assert.equal(manifest.component_draw_order.length,15);
});
test('v05 88 original assets match official SHA-256',()=>{
  assert.equal(Object.keys(manifest.assets).length,88);
  for(const [name,entry] of Object.entries(manifest.assets)){
    const file=path.join(root,'v05',entry.path);
    assert.ok(fs.existsSync(file),`missing ${name}: ${file}`);
    assert.equal(digest(fs.readFileSync(file)),entry.sha256,name);
  }
  assert.equal(digest(fs.readFileSync(path.join(root,'v05/production/editor_manifest.json'))),meta.manifest_sha256);
});
test('v05 control images are canonical and layer paths are valid',()=>{
  assert.deepEqual(Array.from(meta.control_cards,c=>c.id),['KNZ-019','KNZ-006','KNZ-014']);
  for(const card of meta.control_cards){
    const ref=path.join(root,card.reference);
    assert.equal(digest(fs.readFileSync(ref)),card.sha256);
    assert.equal(card.verified_equal_pixels,true);
    assert.ok(card.layers.length>10);
    for(const layer of card.layers){
      const file=path.join(root,layer.path);
      assert.ok(fs.existsSync(file),`missing ${card.id} ${layer.path}`);
      assert.ok(layer.path.startsWith(`v05/${card.id}/layers/`));
    }
  }
});
test('manifest samples correspond to control types without data overwrites',()=>{
  const originals=JSON.parse(fs.readFileSync(path.join(root,'v05/production/sample_cards.json'),'utf8'));
  assert.equal(originals.length,3);
  for(const card of originals){
    const control=meta.control_cards.find(c=>c.id===card.id);
    assert.ok(control);
    assert.equal(control.name,card.name);
    assert.equal(control.type,card.type);
    assert.equal(control.cost,card.cost);
    assert.equal(control.description,card.description);
  }
});
test('v05 fonts and archives are not delivered as assets',()=>{
  const stack=[path.join(root,'v05')];
  while(stack.length){
    const directory=stack.pop();
    for(const ent of fs.readdirSync(directory,{withFileTypes:true})){
      if(ent.isDirectory())stack.push(path.join(directory,ent.name));
      else assert.ok(!/\.(ttf|otf|woff2?|zip|7z|rar)$/i.test(ent.name), ent.name);
    }
  }
});
test('single v05 editor entry; legacy editor hidden; studio retained only for QA',()=>{
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const html=fs.readFileSync(path.join(root,'v05-studio.html'),'utf8');
  assert.match(index,/href="v05-dynamic\.html"/);
  assert.doesNotMatch(index,/<button data-app-mode="editor"/);
  assert.match(index,/id="editorWorkspace" hidden aria-hidden="true"/);
  assert.doesNotMatch(index,/href="v05-studio\.html"/);
  assert.match(html,/v05-meta\.js/);
  assert.match(html,/v05-studio\.js/);
  const viewer=fs.readFileSync(path.join(root,'v05-studio.js'),'utf8');
  assert.doesNotMatch(viewer,/\blocalStorage\b|\bfetch\(|\bXMLHttpRequest\b/);
});
