/* v05.12.1 editor layout and keyboard regressions (no runtime dependencies). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('v05-dynamic.html'),css=read('v05-template-editor.css'),js=read('v05-template-editor.js');
test('reference is left of live canvas inside the editor stage',()=>{
  const stage=html.indexOf('<div class="editor-stage"');
  const ref=html.indexOf('id="referenceWrap"',stage),canvas=html.indexOf('id="cardCanvas"',stage),tools=html.indexOf('id="templateWorkbench"',stage);
  assert.ok(stage>0&&ref>stage&&canvas>ref&&tools>canvas);
  assert.equal((html.match(/id="referenceWrap"/g)||[]).length,1);
  assert.equal((html.match(/id="cardCanvas"/g)||[]).length,1);
  assert.equal((html.match(/id="templateWorkbench"/g)||[]).length,1);
  assert.ok(html.indexOf('<!-- /.editor-stage -->')>tools);
});
test('stage has side-by-side tools and safe responsive layouts',()=>{
  assert.match(css,/\.editor-stage\{display:grid;grid-template-columns:/);
  assert.match(css,/\.editor-stage \.template-workbench\{margin:0;position:sticky/);
  assert.match(css,/@media\(max-width:1000px\)/);
  assert.match(css,/@media\(max-width:740px\)/);
  assert.match(css,/\.editor-stage \.tpl-status\{position:sticky/);
});
test('undo redo and keyboard shortcuts are preserved',()=>{
  assert.match(js,/key==='z'\|\|key==='y'/);
  assert.match(js,/historyAction\(key==='y'\|\|\(key==='z'&&ev\.shiftKey\)\)/);
  assert.match(js,/templateNumber=tag==='INPUT'/);
  assert.match(js,/target\.blur\(\)/);
  assert.match(js,/ev\.key==='Escape'/);
  assert.match(js,/ev\.key==='Delete'\|\|ev\.key==='Backspace'/);
  assert.match(js,/deleteSelectedCustom\(\)/);
  assert.match(js,/const n=ev\.shiftKey\?10:1/);
  assert.match(html,/Ctrl\+Shift\+Z/);
});
test('saving is local and still supports portable JSON',()=>{
  assert.match(js,/const dbName='mw-v05-template-drafts'/);
  assert.match(js,/dbSet\(type,data\)/);
  assert.match(js,/tplExport/);
  assert.match(js,/tplImport/);
  assert.match(html,/только в этом браузере/);
});
