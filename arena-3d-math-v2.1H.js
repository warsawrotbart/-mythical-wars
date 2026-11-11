/* MW v2.1H — small, dependency-free WebGL math and layout helpers.
 * Presentation only. No game state mutations or rules.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.MW_3D_MATH=api;
})(typeof window!=="undefined"?window:globalThis, function(){
 "use strict";
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const I=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
 function mul(a,b){
  const out=new Float32Array(16);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++)
   out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
  return out;
 }
 function transform(m,v){
  return [0,1,2,3].map(r=>m[r]*v[0]+m[4+r]*v[1]+m[8+r]*v[2]+m[12+r]*(v[3]??1));
 }
 function translation(x,y,z){const m=I();m[12]=x;m[13]=y;m[14]=z;return m;}
 function scaling(x,y,z){const m=I();m[0]=x;m[5]=y;m[10]=z;return m;}
 function rotY(r){const m=I(),c=Math.cos(r),s=Math.sin(r);m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m;}
 function rotX(r){const m=I(),c=Math.cos(r),s=Math.sin(r);m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m;}
 function model(p,size=[1,1,1],ry=0,rx=0){
  return mul(translation(...p),mul(rotY(ry),mul(rotX(rx),scaling(...size))));
 }
 function perspective(fov,aspect,near=.1,far=100){
  const f=1/Math.tan(fov/2),d=1/(near-far),m=new Float32Array(16);
  m[0]=f/aspect;m[5]=f;m[10]=(far+near)*d;m[11]=-1;m[14]=2*far*near*d;return m;
 }
 const sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const norm=a=>{const d=Math.hypot(...a)||1;return a.map(v=>v/d);};
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 function lookAt(eye,target,up=[0,1,0]){
  const z=norm(sub(eye,target)),x=norm(cross(up,z)),y=cross(z,x);
  return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
 }
 function inverse(a){
  // Gauss-Jordan, explicit singular detection; only used when camera changes.
  const rows=Array.from({length:4},(_,r)=>[a[r],a[4+r],a[8+r],a[12+r],...Array.from({length:4},(_,c)=>r===c?1:0)]);
  for(let c=0;c<4;c++){
   let piv=c;for(let r=c+1;r<4;r++)if(Math.abs(rows[r][c])>Math.abs(rows[piv][c]))piv=r;
   if(Math.abs(rows[piv][c])<1e-10)return null;
   [rows[c],rows[piv]]=[rows[piv],rows[c]];
   const d=rows[c][c];rows[c]=rows[c].map(v=>v/d);
   for(let r=0;r<4;r++)if(r!==c){const k=rows[r][c];rows[r]=rows[r].map((v,j)=>v-k*rows[c][j]);}
  }
  const out=new Float32Array(16);
  for(let r=0;r<4;r++)for(let c=0;c<4;c++)out[c*4+r]=rows[r][c+4];
  return out;
 }
 function project(v,vp,w,h){
  const a=transform(vp,[...v,1]);if(a[3]<=0)return null;
  return {x:(a[0]/a[3]+1)*w/2,y:(1-a[1]/a[3])*h/2,depth:a[2]/a[3]};
 }
 function rayPlane(x,y,w,h,inv,yPlane=0){
  if(!inv||!w||!h)return null;
  const a=transform(inv,[2*x/w-1,1-2*y/h,-1,1]),b=transform(inv,[2*x/w-1,1-2*y/h,1,1]);
  const p=a.slice(0,3).map(v=>v/a[3]),q=b.slice(0,3).map(v=>v/b[3]);
  const d=q[1]-p[1];if(Math.abs(d)<1e-8)return null;
  const t=(yPlane-p[1])/d;if(t<0)return null;
  return p.map((v,i)=>v+(q[i]-v)*t);
 }
 function inside(x,y,poly){
  if(!poly||poly.length<3)return false;
  let yes=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
   const a=poly[i],b=poly[j];if(!a||!b)return false;
   if(((a.y>y)!==(b.y>y))&&(x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x))yes=!yes;
  }
  return yes;
 }
 function layout(count,zone,owner=0){
  const n=clamp(Math.floor(Number(count)||0),0,zone==="hand"?10:7);
  return Array.from({length:n},(_,i)=>{
   const k=i-(n-1)/2;
   if(zone==="hand"&&owner===1)return {p:[k*.52,.19,-5.45],ry:0,w:.68,d:1.02};
   if(zone==="hand"){
    const spread=n<=1?0:Math.min(1.70,11.5/(n-1)),a=n<=1?0:k/(n-1);
    return {p:[k*spread,.36+i*.012,5.1+Math.abs(a)*.40],ry:-a*.38,w:1.65,d:2.475};
   }
   return {p:[k*1.73,.20,owner===0?1.25:-1.15],ry:0,w:1.44,d:1.92};
  });
 }
 function clock(hour){
  const h=((Math.floor(Number(hour)||0)%24)+24)%24,day=h>=6&&h<18;
  return {hour:h,day,phase:day?"День":"Ночь",elapsed:(h-(day?6:18)+24)%24,
    angle:(h%12)*Math.PI/6,label:String(h).padStart(2,"0")+":00"};
 }
 const key=(kind,owner,uid="")=>kind+"|"+owner+(uid?"|"+uid:"");
 return {clamp,I,mul,transform,translation,scaling,rotY,rotX,model,perspective,lookAt,inverse,project,rayPlane,inside,layout,clock,key,norm};
});
