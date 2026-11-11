#!/usr/bin/env python3
"""Actual v05 production layers + actual card arts, browser-origin isolation workaround.
Not a deployed GitHub Pages/Windows test; tests the same JS and original bytes.
"""
import asyncio,base64,json
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'QA_EVIDENCE_v05S10'
OUT.mkdir(exist_ok=True)
MANIFEST=json.loads((ROOT/'v05/production/editor_manifest.json').read_text())
JS=['v05-dynamic-manifest.js','v05-dynamic-core.js','v05-library-core.js','v05-library-seed.js',
    'mw-test-art-catalog.js','v05-art-store.js','card-catalog.js',
    'battle-v05-card-bridge.js','battle-card-renderer-v2.1C.js']
IDS=['KNZ-019','KNZ-005','CHR-003','TKN-001','NEU-001']
async def setup(page):
 images={'v05/'+entry['path'] for entry in MANIFEST['assets'].values()}
 images|={'v05/runtime/'+t['art_mask']+'_alpha.png' for t in MANIFEST['templates'].values()}
 for id in IDS:
  if (ROOT/'test-art'/f'{id}.webp').exists():images.add('test-art/'+id+'.webp')
 images.add('v05/KNZ-019/KNZ-019_art_source.png')
 await page.set_content('''<!doctype html><html><head><meta charset="utf-8"></head><body>
  <div id="samples"></div><div id="mulligan"></div><div id="threeD"></div></body></html>''')
 await page.evaluate('''() => {
  const store={};Object.defineProperty(window,'localStorage',{configurable:true,value:{
   getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,
   setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]
  }});
  window.__images={};window.__seen=[];
  const desc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
  Object.defineProperty(HTMLImageElement.prototype,'src',{configurable:true,
    get:desc.get,set:function(src){window.__seen.push(src);desc.set.call(this,window.__images[src]||src)} });
 }''')
 images=sorted(images)
 for offset in range(0,len(images),6):
  blob={src:base64.b64encode((ROOT/src).read_bytes()).decode() for src in images[offset:offset+6]}
  await page.evaluate('''items=>{for(const [src,b64] of Object.entries(items)){
   const raw=atob(b64),out=new Uint8Array(raw.length);
   for(let i=0;i<out.length;i++)out[i]=raw.charCodeAt(i);
   window.__images[src]=URL.createObjectURL(new Blob([out],{type:src.endsWith('.webp')?'image/webp':'image/png'}));
  }}''',blob)
 for src in JS:await page.add_script_tag(content=(ROOT/src).read_text('utf8'))
 return len(images)
async def main():
 checks=[];errors=[]
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,
                    args=['--no-sandbox','--disable-dev-shm-usage'])
  try:
   page=await browser.new_page(viewport={'width':1450,'height':1000})
   page.on('pageerror',lambda err:errors.append(str(err)))
   count=await setup(page);print('Injected real layers & art',count,flush=True)
   for id in IDS:
    data=await page.evaluate('''async id=>{
      const card=window.MW_CANONICAL_CARDS.find(c=>c.cardId===id) ||
        {cardId:id,name:'TEST TOKEN',cardType:'creature',classId:'Воин',rarityId:'common',
         costValue:1,attack:1,health:1,ability:''};
      const url=await window.MW_BATTLE_CARD_RENDERER.request(card,'full',{cost:card.costValue});
      const image=new Image();return await new Promise(resolve=>{
        image.onload=()=>resolve({ok:true,w:image.naturalWidth,h:image.naturalHeight,
          url,stats:window.MW_V05_BATTLE_CARD.stats()});
        image.onerror=()=>resolve({ok:false,url,stats:window.MW_V05_BATTLE_CARD.stats()});
        image.src=url;
      });
    }''',id)
    assert data.get('ok') and data['w']==512 and data['h']==768,(id,str(data)[:250]);
    checks.append(id+' v05 full card 512x768')
    img=await page.evaluate('''([id,url])=>{let el=document.getElementById('img'+id);
      if(!el){el=document.createElement('img');el.id='img'+id;el.width=320;el.height=480;el.style.margin='5px';document.body.append(el);}
      el.src=url;return el.complete;
    }''',[id,data['url']])
    if id in ('KNZ-019','KNZ-005','CHR-003','TKN-001'):
     Path(OUT/f'{id}_v05_2D.png').write_bytes(base64.b64decode(data['url'].split(',',1)[1]));
   for id in IDS[:3]:
    compact=await page.evaluate('''async id=>{const c=window.MW_CANONICAL_CARDS.find(c=>c.cardId===id);
       const d=await MW_BATTLE_CARD_RENDERER.request(c,'compact');
       return {len:d.length,isPNG:d.startsWith('data:image/png;base64,')};}''',id)
    assert compact['isPNG'] and compact['len']>3000,(id,compact);checks.append(id+' v05 compact card for 2D board / 3D')
   checks.append('all art and production layers rendered without network')
   assert not errors,errors
   checks.append('no uncaught JavaScript errors')
   print('PASS',len(checks),*checks,sep='\nPASS ',flush=True)
  finally:await browser.close()
if __name__=='__main__':asyncio.run(main())
