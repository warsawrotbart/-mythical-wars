
const assert=require("node:assert/strict"),M=require("../arena-3d-math-v2.1H.js");let tests=0;
function test(n,fn){fn();tests++;console.log("PASS",n);}
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-4,`${a} ≈ ${b}`);
test("matrix identity",()=>assert.deepEqual([...M.mul(M.I(),M.I())],[...M.I()]));
test("model translation",()=>assert.deepEqual(M.transform(M.model([2,3,4]),[0,0,0,1]),[2,3,4,1]));
test("matrix inverse",()=>{const a=M.model([2,3,4],[2,4,1],.7,.2),b=M.mul(a,M.inverse(a));[...b].forEach((v,i)=>approx(v,M.I()[i]));});
test("singular inverse",()=>assert.equal(M.inverse(new Float32Array(16)),null));
test("project-ray round trip",()=>{const vp=M.mul(M.perspective(.8,1.6),M.lookAt([0,14,15],[0,0,0]));
const p=M.project([2,0,-1],vp,1280,800),w=M.rayPlane(p.x,p.y,1280,800,M.inverse(vp));w.forEach((v,i)=>approx(v,[2,0,-1][i]));});
test("point inside polygon",()=>{assert.ok(M.inside(1,1,[{x:0,y:0},{x:2,y:0},{x:2,y:2},{x:0,y:2}]));assert.ok(!M.inside(3,3,[{x:0,y:0},{x:2,y:0},{x:2,y:2}]));});
test("seven board pieces centred",()=>{const v=M.layout(7,"board");assert.equal(v.length,7);approx(v[0].p[0],-v[6].p[0]);approx(v[3].p[0],0);});
test("ten hand cards stay inside tabletop",()=>{const v=M.layout(10,"hand");assert.equal(v.length,10);assert.ok(v.every(p=>Math.abs(p.p[0])+p.w/2<8.3));});
test("opponent hidden hand has no card IDs",()=>assert.ok(M.layout(10,"hand",1).every(p=>!p.cardId)));
test("clock dawn resets",()=>{assert.equal(M.clock(6).elapsed,0);assert.equal(M.clock(6).day,true)});
test("clock 13:00 counts seven daylight hours",()=>assert.equal(M.clock(13).elapsed,7));
test("clock dusk resets",()=>{assert.equal(M.clock(18).elapsed,0);assert.equal(M.clock(18).day,false)});
test("clock after midnight",()=>assert.equal(M.clock(1).elapsed,7));
test("clock exactly twelve markers limit",()=>{for(let h=0;h<24;h++)assert.ok(M.clock(h).elapsed>=0&&M.clock(h).elapsed<12)});
test("layout clamps invalid size",()=>{assert.equal(M.layout(99,"board").length,7);assert.equal(M.layout(-1,"hand").length,0)});
console.log(`3D math/layout: ${tests}/${tests} passed`);
