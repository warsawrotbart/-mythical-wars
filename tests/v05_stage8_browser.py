#!/usr/bin/env python3
"""v05.8 built-in art picker + persistent reset QA with real image bytes.

Uses an about:blank origin and an in-memory storage fake because this execution
sandbox blocks local HTTP/file navigation. Browser QA is not a production URL
or Windows IndexedDB integration claim.
"""
import asyncio
import re
from pathlib import Path
from playwright.async_api import async_playwright
from v05_stage7_browser import ROOT, all_assets, inject_images

OUT=ROOT/'QA_EVIDENCE_v05S8'
OUT.mkdir(exist_ok=True)

async def main():
    passed=[]; errors=[]
    def check(cond,label):
        if not cond: raise AssertionError(label)
        passed.append(label);print('PASS',label,flush=True)
    html=(ROOT/'v05-dynamic.html').read_text('utf8')
    scripts=re.findall(r'<script[^>]+src="([^"]+)"',html)
    html=re.sub(r'<script\s+src="[^"]+"[^>]*></script>','',html)
    html=re.sub(r'<link\s+rel="stylesheet"[^>]*>','',html)
    images=all_assets()
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        try:
            page=await browser.new_page(viewport={'width':1536,'height':1150})
            page.on('pageerror',lambda e:errors.append(str(e)))
            await page.set_content(html,wait_until='domcontentloaded')
            await page.add_style_tag(content=(ROOT/'v05-dynamic.css').read_text('utf8'))
            await inject_images(page,images)
            for script in scripts:
                if script.split('?')[0]=='v05-dynamic.js':
                    await page.evaluate('''() => {
                     window.__stage8Profiles = {};
                     window.MW_V05_ART_STORE={
                       read:async id=>window.__stage8Profiles[id]||null,
                       write:async profile=>{window.__stage8Profiles[profile.id]=profile;return true}
                     };
                    }''')
                await page.add_script_tag(content=(ROOT/script.split('?')[0]).read_text('utf8'))
            await page.wait_for_function('window.MW_V05_EDITOR_API && document.querySelectorAll("#libSelect option").length===169',timeout=45000)
            check(await page.locator('#libSelect option').count()==169,'all 169 entries available by default')
            check('99 из 169' in await page.locator('#builtinCoverage').inner_text(),'embedded coverage shown')
            await page.locator('#libOnlyWithArt').check()
            check(await page.locator('#libSelect option').count()==99,'with-art filter includes exactly 99 IDs')
            await page.locator('#libSearch').fill('CHR-001')
            check(await page.locator('#libSelect option').count()==1,'filter and ID search compose')
            await page.locator('#libSelect').select_option('CHR-001')
            await page.wait_for_function('document.getElementById("selectedId").textContent==="CHR-001" && document.getElementById("status").textContent.includes("Предпросмотр готов")',timeout=45000)
            check(await page.locator('#builtinArtPreview').is_visible(),'embedded image preview visible')
            check(await page.evaluate('window.__requestedImgs.includes("test-art/CHR-001.webp")'),'preview requests the exact shipped image')
            check(await page.locator('#restoreBuiltinArt').is_disabled(),'restore disabled when already using shipped art')
            check('встроен в сборку' in await page.locator('#sampleStatus').inner_text(),'default art is explicitly labeled as embedded')
            await page.locator('#cropX').evaluate('''e=>{e.value='72';e.dispatchEvent(new Event('input',{bubbles:true}))}''')
            await page.locator('#artUpload').set_input_files(str(ROOT/'v05/KNZ-019/KNZ-019_art_source.png'))
            await page.wait_for_function('document.getElementById("sampleStatus").textContent.includes("Пользовательский арт")',timeout=30000)
            check(await page.locator('#restoreBuiltinArt').is_enabled(),'restore enabled for uploaded override')
            check(await page.evaluate('window.__stage8Profiles["CHR-001"]?.blob?.size>0'),'uploaded art persisted in per-ID store')
            await page.locator('#restoreBuiltinArt').click()
            check('встроен в сборку' in await page.locator('#sampleStatus').inner_text(),'restored bundled art is selected')
            check(await page.locator('#restoreBuiltinArt').is_disabled(),'restore disabled after reset')
            check(await page.evaluate('window.__stage8Profiles["CHR-001"]?.blob===null'),'persisted override was cleared')
            check(await page.evaluate('window.__stage8Profiles["CHR-001"]?.crop?.x===0.72'),'crop setting survives restoring the built-in art')
            await page.locator('#libSearch').fill('NEU-023')
            await page.locator('#libSelect').select_option('NEU-023')
            await page.locator('#libSearch').fill('CHR-001')
            await page.locator('#libSelect').select_option('CHR-001')
            check('встроен в сборку' in await page.locator('#sampleStatus').inner_text(),'art stays default after switching cards')
            check(await page.evaluate('document.getElementById("cropX").value')=='72','crop per-ID survives switching cards')
            check(await page.locator('#restoreBuiltinArt').is_disabled(),'no custom override after re-opening card')
            await page.locator('.workspace').screenshot(path=str(OUT/'MW_v05.8_Builtin_Art_CHR-001.png'))
            await page.locator('#libOnlyWithArt').uncheck()
            await page.locator('#libSearch').fill('TKN-001')
            await page.locator('#libSelect').select_option('TKN-001')
            check(await page.locator('#builtinArtPreview').is_visible(),'token now has a matching built-in thumbnail')
            check('v05.9' not in (await page.locator('#sampleStatus').inner_text()),'token status is not a version marker')
            check(await page.locator('#exportBtn').is_disabled(),'unapproved token PNG remains blocked')
            await page.locator('#libSearch').fill('NEU-001')
            await page.locator('#libSelect').select_option('NEU-001')
            check(await page.locator('#builtinArtPreview').is_hidden(),'truly missing art displays no wrong thumbnail')
            check(await page.locator('#restoreBuiltinArt').is_disabled(),'truly missing art cannot be reset')
            check('нет тестового арта' in (await page.locator('#sampleStatus').inner_text()).lower(),'truly missing art is disclosed')
            await page.screenshot(path=str(OUT/'MW_v05.8_Without_Art_Token.png'),full_page=True)
            check(not errors,'zero uncaught JavaScript errors')
            print('TOTAL',len(passed),'PASS',flush=True)
        finally:
            await browser.close()

if __name__=='__main__':
    asyncio.run(main())
