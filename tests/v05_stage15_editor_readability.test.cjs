const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
test("legacy template interface disconnected without changing editor or manifest",()=>{
 const html=read("index.html"),editor=read("v05-dynamic.html");
 assert.doesNotMatch(html,/id="mwTemplatesNav"/);
 assert.doesNotMatch(html,/id="mwTemplatesWorkspace"/);
 assert.match(html,/href="v05-dynamic.html"/);
 for(const id of ["templateWorkbench","cardCanvas","tplExport","exportBtn"]){
  assert.ok(editor.includes('id="'+id+'"'),id);
 }
 assert.ok(fs.existsSync(path.join(root,"v05/production/editor_manifest.json")));
});
test("editor has large sticky card and compact on-demand help",()=>{
 const css=read("v05-template-editor.css"),html=read("v05-dynamic.html");
 assert.match(css,/\.editor-stage \.reference\{display:none!important\}/);
 assert.match(css,/\.editor-stage \.canvas-area\{display:flex;justify-content:center;position:sticky/);
 assert.match(css,/\.editor-stage \.template-workbench\{position:sticky/);
 assert.match(html,/class="editor-help"/);
});
test("single masked art paint, with curved name and existing gold trim",()=>{
 const src=read("v05-dynamic.js");
 assert.match(src,/z\.globalCompositeOperation="source-over";ctx\.drawImage\(tmp,0,0\)/);
 assert.doesNotMatch(src,/artCrown/);
 assert.match(src,/polish\.drawCurvedTitle/);
 assert.match(src,/Common_Outer_Gold_Trim/);
});
test("hover preview uses card alone without duplicate explanatory title",()=>{
 const src=read("battle-hand-v05S14.js"),css=read("card-readability-v05S15.css");
 assert.match(src,/portal\.append\(img\);main\.append\(portal\)/);
 assert.doesNotMatch(src,/caption\.textContent/);
 assert.match(css,/\.mw14-hand-preview\{[\s\S]*?border:0!important/);
 assert.match(css,/\.mw14-preview-label\{display:none!important/);
});
test("mulligan preserves card image and selection, no extra bottom text",()=>{
 const deck=read("deckgame.js"),css=read("card-readability-v05S15.css");
 assert.match(deck,/aria-pressed/);
 assert.match(deck,/renderer\.request\(c,"full"/);
 assert.doesNotMatch(deck,/span class="mulligan-choice"/);
 assert.match(css,/button\.mulligan-card\.replace::after/);
});
test("descriptions enlarge adaptively with preserved fit logic",()=>{
 const core=read("v05-dynamic-core.js"),renderer=read("battle-card-renderer-v2.1C.js");
 assert.match(core,/maxPx:52,minPx:32/);
 assert.match(renderer,/node\.binding==="ability"/);
 assert.match(renderer,/best\.fits/);
});
