#!/usr/bin/env python3
"""v05.7 single-editor / default-test-art Chromium QA.

Uses about:blank with local image assets mapped to real Blob URLs because this
sandbox denies navigation to localhost and file:// URLs. Does not claim that
this substitutes Windows, actual published GitHub Pages or persistent IDB QA.
"""
import asyncio
import base64
import json
import re
from pathlib import Path
from PIL import Image
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'QA_EVIDENCE_v05S7'
OUT.mkdir(exist_ok=True)
manifest = json.loads((ROOT/'v05/production/editor_manifest.json').read_text('utf-8'))


def all_assets():
    assets = {'v05/' + entry['path'] for entry in manifest['assets'].values()}
    for card in manifest['sample_cards']:
        id=card['id']
        for ext in ('art_source.png','card_v05.png','card_256px.png'):
            assets.add(f'v05/{id}/{id}_{ext}')
    for template in manifest['templates'].values():
        assets.add(f'v05/runtime/{template["art_mask"]}_alpha.png')
    for id in ('CHR-001', 'KNZ-001', 'NEU-023', 'TKN-001', 'TKN-007'):
        assets.add(f'test-art/{id}.webp')
    for f in assets:
        assert (ROOT/f).is_file(),f
    return sorted(assets)

async def inject_images(page,images):
    await page.evaluate('''() => {
       const data={};window.__stagedArtURLs={};window.__requestedImgs=[];
       Object.defineProperty(window,'localStorage',{configurable:true,value:{
         getItem:k=>Object.prototype.hasOwnProperty.call(data,k)?data[k]:null,
         setItem:(k,v)=>{data[k]=String(v)},removeItem:k=>{delete data[k]}
       }});
       const original=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
       Object.defineProperty(HTMLImageElement.prototype,'src',{configurable:true,
         get:original.get,
         set:function(v){window.__requestedImgs.push(v);original.set.call(this,window.__stagedArtURLs[v]||v)}
       });
    }''')
    for offset in range(0,len(images),7):
        bundle={p:base64.b64encode((ROOT/p).read_bytes()).decode('ascii') for p in images[offset:offset+7]}
        await page.evaluate('''data => {
           for(const [path,b64] of Object.entries(data)){
             const binary=atob(b64),bytes=new Uint8Array(binary.length);
             for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
             window.__stagedArtURLs[path]=URL.createObjectURL(new Blob([bytes],{
               type:path.endsWith('.webp')?'image/webp':'image/png'
             }));
           }
        }''',bundle)

async def main():
    checks=[]; errors=[]
    def check(ok,txt):
        if not ok:raise AssertionError(txt)
        print('PASS',txt,flush=True); checks.append(txt)
    html=(ROOT/'v05-dynamic.html').read_text('utf-8')
    scripts=re.findall(r'<script[^>]+src="([^"]+)"',html)
    html=re.sub(r'<script\s+src="[^"]+"[^>]*></script>','',html)
    html=re.sub(r'<link\s+rel="stylesheet"[^>]*>','',html)
    images=all_assets()
    print('Testing',len(images),'real image layers and 3 test arts',flush=True)
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        try:
            page=await browser.new_page(viewport={'width':1536,'height':1150},accept_downloads=True)
            page.on('pageerror',lambda err:errors.append(str(err)))
            await page.set_content(html,wait_until='domcontentloaded')
            await page.add_style_tag(content=(ROOT/'v05-dynamic.css').read_text('utf-8'))
            await inject_images(page,images)
            for script in scripts:
                await page.add_script_tag(content=(ROOT/script.split('?')[0]).read_text('utf-8'))
            await page.wait_for_function('window.MW_V05_EDITOR_API && document.querySelectorAll("#libSelect option").length===169',timeout=40000)
            check(await page.locator('#libSelect option').count()==169,'all 162 cards plus 7 tokens selectable')
            check(await page.evaluate('window.MW_TEST_ART_CATALOG.count===99'),'test-art catalogue is visible to the editor')
            check(await page.evaluate('window.MW_TEST_ART_CATALOG.ids.every(id=>window.MW_TEST_ART_CATALOG.has(id))'),'99 ID mappings valid')
            check(await page.evaluate('Object.keys(window.__stagedArtURLs).length')==len(images),'all original layer bytes injected')
            for id in ('CHR-001','KNZ-001','NEU-023'):
                await page.locator('#libSearch').fill(id)
                await page.locator('#libSelect').select_option(id)
                await page.wait_for_function('''id => {
                    const s=document.getElementById('status').textContent;
                    return document.getElementById('selectedId').textContent===id &&
                      (s.includes('Предпросмотр готов') || s.includes('Сборка остановлена'));
                }''',arg=id,timeout=45000)
                s=await page.locator('#status').inner_text()
                check('Предпросмотр готов' in s, f'{id}: renders from actual test artwork and original layers: {s}')
                label=await page.locator('#sampleStatus').inner_text()
                check(f'Тестовый арт по ID · {id}' in label,f'{id}: correct test-art default label')
                check(await page.evaluate('''id => window.__requestedImgs.includes('test-art/'+id+'.webp')''',id), f'{id}: browser loads correct ID-matched WebP')
                # Browser-side canvas is full resolution and not a blank tile.
                val=await page.evaluate('''() => {
                  const c=document.getElementById('cardCanvas');
                  const d=c.getContext('2d').getImageData(512,500,1,1).data;
                  return {w:c.width,h:c.height,alpha:d[3],rgb:[d[0],d[1],d[2]]}
                }''')
                check(val['w']==1024 and val['h']==1536 and val['alpha']>0,f'{id}: nonempty 1024x1536 canvas')
                if id=='KNZ-001':
                    await page.locator('.workspace').screenshot(path=str(OUT/'MW_v05.7_New_Editor_KNZ-001.png'))
            # Control art uses trusted original source, not a swapped Drive-derived image.
            await page.locator('#libSearch').fill('KNZ-019')
            await page.locator('#libSelect').select_option('KNZ-019')
            await page.wait_for_function('document.getElementById("selectedId").textContent==="KNZ-019" && document.getElementById("status").textContent.includes("Предпросмотр готов")',timeout=45000)
            check(await page.evaluate('window.__requestedImgs.includes("v05/KNZ-019/KNZ-019_art_source.png")'),'control KNZ-019 retains approved reference source')
            check(await page.locator('#exportBtn').is_enabled(),'control PNG export remains possible')
            async with page.expect_download(timeout=30000) as d:
                await page.locator('#exportBtn').click()
            download=await d.value
            target=OUT/'KNZ-019_v05.7_Control.png'
            await download.save_as(target)
            with Image.open(target) as im:
                check(im.size==(1024,1536) and im.format=='PNG','real control PNG exported at 1024x1536')
            # Test override and per-card crop consistency.
            await page.locator('#artUpload').set_input_files(str(ROOT/'v05/KNZ-019/KNZ-019_art_source.png'))
            await page.wait_for_function('document.getElementById("sampleStatus").textContent.includes("Пользовательский арт")',timeout=30000)
            await page.locator('#cropX').evaluate('''n=>{n.value='72';n.dispatchEvent(new Event('input',{bubbles:true}))}''')
            await page.locator('#libSearch').fill('CHR-001')
            await page.locator('#libSelect').select_option('CHR-001')
            await page.locator('#libSearch').fill('KNZ-019')
            await page.locator('#libSelect').select_option('KNZ-019')
            check('Пользовательский арт' in await page.locator('#sampleStatus').inner_text(),'custom art retains priority over builtin art after card switch')
            check(await page.locator('#cropX').input_value()=='72','custom crop retained after card switch')
            # No nonexistent token illustration created.
            await page.locator('#libSearch').fill('TKN-007')
            await page.locator('#libSelect').select_option('TKN-007')
            await page.wait_for_function('document.getElementById("selectedId").textContent==="TKN-007"',timeout=15000)
            check('\u0432\u0441\u0442\u0440\u043e\u0435\u043d \u0432 \u0441\u0431\u043e\u0440\u043a\u0443' in (await page.locator('#sampleStatus').inner_text()).lower(),'token uses its own built-in image')
            check(await page.locator('#exportBtn').is_disabled(),'unapproved token PNG still blocked')
            check(not errors,'zero uncaught script errors')
        finally:
            await browser.close()
    report={'release':'v05.7 RC','passed':len(checks),'checks':checks,'errors':errors,'assets':len(images),'limitations':'about:blank with localStorage shim, real PNG/WebP via Blob URLs. No live HTTP/Windows/IndexedDB persistence/Google API tests.'}
    (OUT/'BROWSER_QA_v05S7.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('TOTAL',len(checks),'PASS',flush=True)

if __name__=='__main__':
    asyncio.run(main())
