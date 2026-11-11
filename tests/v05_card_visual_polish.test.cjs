const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const polish=require("../v05-card-visual-polish.js"),root=path.join(__dirname,"..");
test("curved heading preserves every character and follows arch",()=>{
  const ctx={measureText:s=>({width:s===" "?12:24})},name="ФАКЕЛЬШЧЫК ДРУЖЫНЫ";
  const p=polish.titlePositions(ctx,name,[512,799],676);
  assert.equal(p.map(x=>x.text).join(""),name);
  assert.ok(p.every(x=>x.x>=174&&x.x<=850));
  assert.ok(p[0].y>p[Math.floor(p.length/2)].y);
  assert.ok(p.at(-1).y>p[Math.floor(p.length/2)].y);
  assert.ok(p[0].angle<0&&p.at(-1).angle>0);
});
test("stroke/fill of title both performed for all glyphs",()=>{
  const calls=[],ctx={measureText:()=>24,save(){},restore(){},translate(){},rotate(){},scale(){},
    strokeText(s){calls.push("s"+s)},fillText(s){calls.push("f"+s)}};
  polish.drawCurvedTitle(ctx,"ДЗЕНЬ",[512,799],676);
  assert.equal(calls.filter(x=>x[0]==="s").length,5);
  assert.equal(calls.filter(x=>x[0]==="f").length,5);
});
test("side lines only removed for creatures, frame preserved",()=>{
  for(const key of ["Common_Gold_Side_Left","Common_Gold_Side_Right"]){
    assert.equal(polish.skipLayer({kind:"asset",key},"Creature"),true);
    assert.equal(polish.skipLayer({kind:"asset",key},"Weapon"),false);
  }
  assert.equal(polish.skipLayer({kind:"asset",key:"Common_Outer_Gold_Trim"},"Creature"),false);
});
test("top decor rises only for creatures",()=>{
  assert.equal(polish.liftTop({kind:"asset",key:"Creature_Weapon_Gold_Flourish_Top"},"Creature"),-24);
  assert.equal(polish.liftTop({kind:"asset",key:"Creature_Weapon_Inset_Top_Color"},"Creature"),-24);
  assert.equal(polish.liftTop({kind:"asset",key:"Common_Outer_Gold_Trim"},"Creature"),0);
  assert.equal(polish.liftTop({kind:"asset",key:"Creature_Weapon_Gold_Flourish_Top"},"Spell"),0);
});
test("editor integration keeps original editable layout and valid scripts",()=>{
  const js=fs.readFileSync(path.join(root,"v05-dynamic.js"),"utf8");
  const html=fs.readFileSync(path.join(root,"v05-dynamic.html"),"utf8");
  assert.match(js,/polish\.drawCurvedTitle/);assert.match(js,/polish\.skipLayer/);
  assert.match(js,/polish\.makeArtCrown/);assert.match(js,/Common_Outer_Gold_Trim/);
  assert.ok(html.indexOf("v05-card-visual-polish.js")<html.indexOf("v05-dynamic.js"));
  assert.match(js,/templateEditor\.compose/);
});
