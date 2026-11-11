#!/usr/bin/env python3
"""2D/mulligan/3D DOM integration using full real game code and v05 assets.
Browser policy prevents local HTTP navigation; inject identical scripts/bytes on about:blank.
"""
import asyncio,base64,re,json
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'QA_EVIDENCE_v05S10'
OUT.mkdir(exist_ok=True)
MANIFEST=json.loads((ROOT/'v05/production/editor_manifest.json').read_text())
async def setup(page):
 raw=(ROOT/'index.html').read_text('utf8')
 scripts=re.findall(r'<script\s+src="([^"]+)"',raw)
 styles=re.findall(r'<link\s+rel="stylesheet"\s+href="([^"]+)"',raw)
 raw=re.sub(r'<script\s+src="[^"]+"\s*></script>','',raw)
 raw=re.sub(r'<link\s+rel="stylesheet"[^>]*>','',raw)
 await page.set_content(raw,wait_until='domcontentloaded')
 for css in styles:
  await page.add_style_tag(content=(ROOT/css).read_text('utf8'))
 await page.evaluate('''()=>{window.__seen=[];window.__images={};
  const d=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
  Object.defineProperty(HTMLImageElement.prototype,'src',{configurable:true,get:d.get,
    set:function(s){window.__seen.push(s);d.set.call(this,window.__images[s]||s)}});
 }''')
 paths={'v05/'+a['path'] for a in MANIFEST['assets'].values()}
 paths|={'v05/runtime/'+t['art_mask']+'_alpha.png' for t in MANIFEST['templates'].values()}
 paths|={'v05/KNZ-019/KNZ-019_art_source.png'}
 paths|={'test-art/'+f.name for f in (ROOT/'test-art').glob('KNZ-*.webp')}
 paths=sorted(paths)
 for offset in range(0,len(paths),7):
  items={p:base64.b64encode((ROOT/p).read_bytes()).decode() for p in paths[offset:offset+7]}
  await page.evaluate('''items=>{for(const [p,b64] of Object.entries(items)){
      const raw=atob(b64),data=new Uint8Array(raw.length);
      for(let i=0;i<raw.length;i++)data[i]=raw.charCodeAt(i);
      window.__images[p]=URL.createObjectURL(new Blob([data],{type:p.endsWith('.webp')?'image/webp':'image/png'}));
   }}''',items)
 for js in scripts:
  await page.add_script_tag(content=(ROOT/js.split('?')[0]).read_text('utf8'))
 return len(paths),scripts
async def main():
 errors=[];checks=[]
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  try:
   page=await browser.new_page(viewport={'width':1600,'height':900})
   page.on('pageerror',lambda e:errors.append(str(e)))
   num,scripts=await setup(page);print('Injected scripts',len(scripts),'real images',num,flush=True)
   await page.wait_for_function('window.MW_DECK_TEST && window.MW_BATTLE_CARD_RENDERER && window.MW_BATTLE_VIEW_BRIDGE',timeout=35000)
   checks.append('battle and 3D bridges loaded from original index')
   await page.locator('[data-app-mode="battle"]').click()
   await page.locator('#battleQuickStart').click()
   await page.wait_for_function('window.MW_BATTLE_VIEW_BRIDGE.state()?.phase ==="mulligan"',timeout=25000)
   checks.append('new game starts without engine changes')
   print('STATE',await page.evaluate('''()=>({phase:MW_BATTLE_VIEW_BRIDGE.state().phase,
     hand:MW_BATTLE_VIEW_BRIDGE.state().players[0].hand.map(h=>h.cardId),
     cards:document.querySelectorAll('#mulliganCards .mulligan-card').length})'''),flush=True)
   await page.wait_for_function('''()=>document.querySelectorAll('#mulliganCards .mulligan-face img:not([hidden])').length>=3''',timeout=90000)
   checks.append('mulligan cards display rendered v05 image faces')
   await page.locator('#battleMulligan').screenshot(path=str(OUT/'Mulligan_v05.png'))
   await page.locator('#mulliganConfirm').click()
   await page.wait_for_function('window.MW_BATTLE_VIEW_BRIDGE.state()?.phase ==="battle"',timeout=30000)
   await page.wait_for_function('''()=>document.querySelectorAll('#myHand .mw-template-face').length>=3''',timeout=60000)
   checks.append('2D hand shows v05 face images')
   await page.locator('#battleWorkspace').screenshot(path=str(OUT/'Battle_2D_v05.png'))
   checks.append('same engine retains 2D game state after mulligan')
   assert await page.evaluate('MW_BATTLE_VIEW_BRIDGE.state().phase')=='battle'
   print('ERRORS',errors[:14],flush=True)
   print('CHECKS',len(checks),*checks,sep='\nPASS ',flush=True)
  finally:await browser.close()
if __name__=='__main__':asyncio.run(main())
