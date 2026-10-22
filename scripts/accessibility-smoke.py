"""Phase 16 keyboard/screen-reader semantics smoke checks in Chromium.
Run `npm run build` first, then `python scripts/accessibility-smoke.py`.
This is NOT a WCAG conformance assessment or real assistive-technology test.
"""
from pathlib import Path
import json
import os
import re
import shutil
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
html = (root / 'PLAY-OFFLINE.html').read_text(encoding='utf-8')
# Large embedded pictures are not part of these interaction and semantics tests.
html = re.sub(r'data:image/webp;base64,[A-Za-z0-9+/=]{100,}',
              'data:image/webp;base64,UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAUAAAABAAEAAAA=', html)
with sync_playwright() as p:
    opts = {'headless': True, 'args': ['--no-sandbox']}
    browser_path = os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
    if browser_path:
        opts['executable_path'] = browser_path
    browser = p.chromium.launch(**opts)
    page = browser.new_page(viewport={'width':390,'height':844})
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
    page.evaluate("""Object.defineProperty(window,'localStorage',{configurable:true,value:{
      getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
      Object.defineProperty(window.crypto,'randomUUID',{configurable:true,
        value:()=> '36ba6577-eaf1-4a50-a10d-a5b1e733ec08'});""")
    page.set_content(html,wait_until='commit',timeout=20000)
    assert page.locator('#app').get_attribute('aria-live') is None
    assert page.locator('#stackhouse-status[aria-live=polite]').count() == 1
    opener = page.get_by_role('button',name='Explore the avatars')
    opener.focus();opener.click()
    assert page.get_by_role('dialog').count()==1
    assert page.locator('.site-wrap').evaluate('(e)=>e.inert')
    assert page.evaluate('!!document.activeElement.closest("[role=dialog]")'), 'Modal failed to capture focus'
    for key in ['Shift+Tab','Tab','Tab']:
        page.keyboard.press(key)
        assert page.evaluate('!!document.activeElement.closest("[role=dialog]")'), f'Focus escaped on {key}'
    page.keyboard.press('Escape')
    assert page.get_by_role('dialog').count()==0
    assert page.evaluate('document.activeElement.textContent.includes("Explore the avatars")'), 'Opener focus was not restored'
    page.get_by_role('button',name='Play the bot').first.click()
    card = page.locator('.hand-piece[data-order-key] .play-card').first
    card.focus();card.click()
    assert page.evaluate('document.activeElement?.getAttribute("data-action")==="seq-source"'), 'Card focus lost after rerender'
    assert page.locator('.hand-piece .play-card[aria-pressed="true"]').count()==1
    page.get_by_role('button',name='How to play').click()
    assert page.evaluate('!!document.activeElement.closest("[role=dialog]")')
    page.keyboard.press('Escape')
    assert page.evaluate('document.activeElement?.getAttribute("data-action")==="rules"')
    for width in [320,390]:
        page.set_viewport_size({'width':width,'height':844})
        assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'), f'{width}px horizontal overflow'
    assert errors==[],errors
    print(json.dumps({'result':'PASS','checks':['dialog focus','background inert','Tab trapping','Escape return','selected card focus','aria-pressed','rules dialog','320/390px reflow','no JavaScript exceptions'],'limitations':['Not native zoom','Not screen reader verified','Placeholder images so contrast is not tested']}))
    browser.close()
