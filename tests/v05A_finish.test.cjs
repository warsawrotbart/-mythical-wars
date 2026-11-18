const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const finish=require('../v05-card-finish.js');
const root=path.join(__dirname,'..');

test('v05A loads before its consumers on every supported page',()=>{
 for(const [page,consumer] of [['index.html','battle-v05-card-bridge.js'],['battle-motion-lab.html','battle-v05-card-bridge.js'],['v05-dynamic.html','v05-dynamic.js']]){
  const html=fs.readFileSync(path.join(root,page),'utf8');
  assert.ok(html.indexOf('v05-card-finish.js')>=0);
  assert.ok(html.indexOf('v05-card-finish.js')<html.indexOf(consumer));
 }
});

test('v05A multiline effects are left aligned and single lines remain centered',()=>{
 for(const lines of [['Одна строка'],['Первая строка','Вторая строка']]){
  const calls=[];
  const ctx={save(){},restore(){},fillText(...args){calls.push(args);}};
  finish.drawDescription(ctx,{px:40,lines},[512,1100],'serif');
  assert.equal(ctx.textAlign,lines.length>1?'left':'center');
  assert.equal(calls.length,lines.length);
  assert.equal(calls[0][1],lines.length>1?172:512);
  if(lines.length>1)assert.ok(Math.abs(calls[1][2]-calls[0][2]-48.8)<.001);
 }
});

test('v05A number drawing preserves values and centers their actual ink',()=>{
 const calls=[];
 const ctx={save(){},restore(){},measureText(){return {width:80,actualBoundingBoxLeft:30,actualBoundingBoxRight:50,actualBoundingBoxAscent:70,actualBoundingBoxDescent:10};},strokeText(...args){calls.push(args);},fillText(...args){calls.push(args);}};
 finish.drawNumber(ctx,'12',{center:[100,200],font_px:102,two_digit_font_px:88},{text_rules:{numbers:{fill:'#fff',outline:'#000',outline_px:2}}},'serif');
 assert.equal(ctx.font,'700 88px serif');
 assert.deepEqual(calls,[['12',90,230],['12',90,230]]);
});

test('v05A missing illustration does not attempt crown painting',()=>{
 finish.extendCrown({},null,null,{curve:[]});
 finish.extendCrown({},null,null,null);
});
