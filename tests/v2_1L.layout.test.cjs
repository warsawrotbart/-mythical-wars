// v2.1L – board framing and clock presentation tests.
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");

test("3D camera moves closer and anchors aim above the previous viewpoint",()=>{
  const js=read("arena-3d-v2.1H.js");
  assert.match(js,/const zoom=cw>=1400\?\(ch>=630\?\.76:\.84\)/);
  assert.match(js,/M\.lookAt\(\[0,15\.8\*comp\*zoom,15\.0\*comp\*zoom\],\[0,0,1\.0\]\)/);
});
test("3D controls follow projected board midpoint, not viewport midpoint",()=>{
  const js=read("arena-3d-v2.1H.js");
  assert.match(js,/const centerPoint=point\(\[0,\.12,0\]\)/);
  assert.match(js,/clockScale=bound\(\(left-12\)\/clockW/);
  assert.match(js,/turnScale=bound\(\(cw-right-12\)\/turnW/);
});
test("2D clock targets only its own widget, not the earlier 3D clock in DOM",()=>{
  const js=read("arena-art-v2.1D.js");
  assert.match(js,/querySelector\("\.battle-time-dial \.mw-art-clock"\)/);
  assert.doesNotMatch(js,/querySelector\("\.mw-art-clock"\)/);
});
test("2D clock has 12 phase-specific markers that light only when elapsed",()=>{
  const js=read("arena-art-v2.1D.js");
  assert.match(js,/for\(let i=0;i<12;i\+\+\)/);
  assert.match(js,/marker\.classList\.toggle\("day",day\)/);
  assert.match(js,/marker\.classList\.toggle\("night",!day\)/);
  assert.match(js,/marker\.classList\.toggle\("on",i<elapsed\)/);
  assert.match(js,/clockText\.textContent=String\(hour\)\.padStart/);
});
test("2D/3D clock shares dawn/dusk time boundary",()=>{
  const m=read("arena-3d-math-v2.1H.js");
  const sandbox={window:{}};sandbox.window.window=sandbox.window;
  vm.runInNewContext(m,sandbox);
  const ck=sandbox.window.MW_3D_MATH.clock;
  const pairs=[[5,false,11],[6,true,0],[12,true,6],[17,true,11],[18,false,0],[22,false,4]];
  for(const [hour,day,elapsed] of pairs){
    const result=ck(hour);
    assert.equal(result.day,day);
    assert.equal(result.elapsed,elapsed);
  }
});
test("new 2D CSS and offline GitHub Pages assets are linked",()=>{
  const html=read("index.html"),css=read("arena-layout-v2.1L.css");
  assert.match(html,/arena-layout-v2\.1L\.css/);
  assert.match(css,/battle-actions/);
  assert.match(css,/battle-time-dial/);
  assert.match(css,/clock_day_dial\.webp/);
  assert.match(css,/clock_night_dial\.webp/);
  assert.doesNotMatch(css,/@import.*https?:/);
});
