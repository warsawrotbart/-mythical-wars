#!/usr/bin/env python3
"""Representative v05.9 Chromium art checks with exact local image bytes.
Uses isolated about:blank / Blob URLs, not a real deployed Pages site.
"""
import asyncio
import re
from pathlib import Path
from playwright.async_api import async_playwright
from v05_stage7_browser import ROOT, all_assets, inject_images

OUT=ROOT/'QA_EVIDENCE_v05S9'
OUT.mkdir(exist_ok=True)
ART_IDS=('TKN-001','TKN-007','CHR-003','NEU-024')

async def main():
    images=sorted(set(all_assets())|{f'test-art/{id}.webp' for id in ART_IDS})
    html=(ROOT/'v05-dynamic.html').read_text('utf8')
    scripts=re.findall(r'<script[^>]+src="([^"]+)"',html)
    html=re.sub(r'<script\s+src="[^"]+"[^>]*></script>','',html)
    html=re.sub(r'<link\s+rel="stylesheet"[^>]*>','',html)
    done=[];errors=[]
    async with async_playwright() as p:
      browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,
                        args=['--no-sandbox','--disable-dev-shm-usage'])
      try:
        page=await browser.new_page(viewport={'width':1536,'height':1150})
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.set_content(html,wait_until='domcontentloaded')
        await page.add_style_tag(content=(ROOT/'v05-dynamic.css').read_text('utf8'))
        await inject_images(page,images)
        for script in scripts:await page.add_script_tag(content=(ROOT/script.split('?')[0]).read_text('utf8'))
        await page.wait_for_function('window.MW_V05_EDITOR_API && document.querySelectorAll("#libSelect option").length===169',timeout=45000)
        assert await page.evaluate('window.MW_TEST_ART_CATALOG.count===99')
        done.append('99 exactly mapped card and token assets')
        for id in ART_IDS:
            await page.locator('#libSearch').fill(id)
            await page.locator('#libSelect').select_option(id)
            await page.wait_for_function('document.querySelector("#selectedId").textContent===id',arg=None,timeout=15000) if False else None
            assert await page.locator('#selectedId').inner_text()==id
            assert await page.locator('#builtinArtPreview').is_visible(),id
            assert await page.evaluate('(id)=>window.__requestedImgs.includes("test-art/"+id+".webp")',id),id
            assert await page.evaluate('(id)=>window.MW_TEST_ART_CATALOG.get(id).version',id)==('v02' if id in ('CHR-003','NEU-024') else 'v01')
            im=await page.evaluate('''async (id)=>{
                const img=new Image();const path='test-art/'+id+'.webp';
                const url=window.__stagedArtURLs[path];
                return new Promise(resolve=>{img.onload=()=>resolve({w:img.naturalWidth,h:img.naturalHeight});
                 img.onerror=()=>resolve({w:0,h:0});img.src=url;});
            }''',id)
            assert im['w']>0 and im['h']>0,(id,im)
            done.append(id+' correct version and decoded local WebP')
            if id=='TKN-001': await page.screenshot(path=str(OUT/'TKN-001_editor_v05.9.png'),full_page=True)
            if id=='CHR-003': await page.screenshot(path=str(OUT/'CHR-003_v02_editor_v05.9.png'),full_page=True)
        await page.locator('#libSearch').fill('NEU-001')
        await page.locator('#libSelect').select_option('NEU-001')
        assert await page.locator('#builtinArtPreview').is_hidden()
        done.append('missing NEU-001 is still missing, never uses arbitrary image')
        assert not errors,errors
        done.append('zero uncaught Javascript errors')
      finally:
        await browser.close()
    print('TOTAL',len(done),'PASS')
    for item in done:print('PASS',item)

if __name__=='__main__':asyncio.run(main())
