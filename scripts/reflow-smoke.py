"""Phase 17 limited Chromium reflow and text-spacing checks.

Simulates a 320 CSS-pixel viewport (equivalent width to a 1280px
viewport at 400% browser zoom under WCAG 1.4.10) and the prescribed
WCAG 1.4.12 text-spacing overrides. This does not replace native browser
zoom or screen-reader testing.
"""
from pathlib import Path
import json
import os
import re
import shutil
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
html=(root/'PLAY-OFFLINE.html').read_text('utf8')
html=re.sub(r'data:image/webp;base64,[A-Za-z0-9+/=]{100,}',
            'data:image/webp;base64,UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAUAAAABAAEAAAA=',html)
spacing='''body *:not(svg):not(path){line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p{margin-bottom:2em!important}'''
with sync_playwright() as p:
    options={'headless':True,'args':['--no-sandbox']}
    executable=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
    if executable:options['executable_path']=executable
    browser=p.chromium.launch(**options)
    page=browser.new_page(viewport={'width':320,'height':760})
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.route('https://fonts.googleapis.com/**',lambda route:route.abort())
    page.route('https://fonts.gstatic.com/**',lambda route:route.abort())
    page.evaluate("""Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});Object.defineProperty(window.crypto,'randomUUID',{configurable:true,value:()=> '36ba6577-eaf1-4a50-a10d-a5b1e733ec08'});""")
    page.set_content(html,wait_until='commit',timeout=20000)
    page.locator('.skip-link').wait_for(timeout=10000)
    page.keyboard.press('Tab')
    assert page.evaluate('document.activeElement?.classList.contains("skip-link")'), 'Skip link must be the first keyboard stop'
    page.keyboard.press('Enter')
    assert page.evaluate('document.activeElement?.id==="main-content"'), 'Skip link did not focus the main landmark'
    checked=0
    families={
        'stack-run':'stack-run','malice-duel':'stack-run',
        'phase-quest':'phase-quest','contract-club':'phase-quest',
        'crown-circuit':'phase-quest','shanghai-nights':'phase-quest',
        'number-ladder':'number-ladder','tile-royale':'tile-royale',
        'low-glow':'low-glow','eight-shift':'eight-shift'
    }
    for width,height in [(360,740),(390,844)]:
        page.set_viewport_size({'width':width,'height':height})
        for mode,family in families.items():
            if page.locator('main.game-page').count():
                page.locator('button.brand[data-action="home"]').click()
            assert page.locator('main#main-content').count()==1
            if mode!=family:
                page.locator(f'#family-{family}').select_option(mode)
            page.locator(f'[data-action="start"][data-family="{family}"]').click()
            assert page.locator('main#main-content').count()==1
            if checked==0:page.add_style_tag(content=spacing)
            dims=page.evaluate('''()=>({doc:document.documentElement.scrollWidth,
                vw:document.documentElement.clientWidth,
                pageHeight:document.scrollingElement.scrollHeight,
                vh:window.innerHeight,
                textClipped:[...document.querySelectorAll('button, a, label, p, h1, h2, h3')]
                    .filter(e=>{const s=getComputedStyle(e);return e.getBoundingClientRect().width>4 && s.overflowX!=='visible' && e.scrollWidth>e.clientWidth+6})
                    .map(e=>e.tagName+':'+(e.className||'')).slice(0,6)})''')
            assert dims['doc']<=dims['vw']+1,(width,mode,dims)
            assert dims['pageHeight']<=dims['vh']+2,(width,mode,'vertical page scrolling',dims)
            assert not dims['textClipped'],(width,mode,dims)
            checked+=1
    assert not errors,errors
    print(json.dumps({'result':'PASS','games':10,'viewports':[[360,740],[390,844]],
                      'screensChecked':checked,'textSpacing':'applied','keyboardSkipLink':'passed',
                      'limitations':['Not true browser zoom','Not an automated contrast or screen-reader audit',
                                     'Images replaced with placeholders for stable testing']}))
    browser.close()
