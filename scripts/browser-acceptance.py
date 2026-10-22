"""Opt-in simulated two-phone browser acceptance test. Run against a locally started server."""
import os, sys, time, json
from playwright.sync_api import sync_playwright

base = os.environ.get('STACKHOUSE_URL', 'http://127.0.0.1:4173')
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
    host_context = browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1, is_mobile=True, has_touch=True)
    guest_context = browser.new_context(viewport={'width':412,'height':915},device_scale_factor=1, is_mobile=True, has_touch=True)
    host=host_context.new_page(); guest=guest_context.new_page()
    errors=[]
    host.on('pageerror', lambda e:errors.append('host: '+str(e)))
    guest.on('pageerror', lambda e:errors.append('guest: '+str(e)))
    try:
        host.goto(base,wait_until='domcontentloaded');host.locator('[data-action="room-open"]').first.click()
        host.locator('#room-name').fill('Mobile Host')
        host.locator('[data-action="room-host"]').click()
        host.locator('.room-code').wait_for(timeout=9000)
        code=host.locator('.room-code').inner_text().strip()
        assert len(code)==6,code
        guest.goto(f'{base}/?room={code}',wait_until='domcontentloaded')
        guest.locator('#room-name').fill('Mobile Guest')
        guest.locator('[data-action="room-join"]').click()
        host.locator('.game-heading').wait_for(timeout=9000)
        guest.locator('.game-heading').wait_for(timeout=9000)
        assert host.locator('.game-heading').inner_text() == guest.locator('.game-heading').inner_text(), 'Different game headings'
        for page in [host,guest]:
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 5'), 'Horizontal mobile overflow'
            assert 'PRIVATE TABLE' in page.locator('.game-heading').inner_text()
        assert not errors, str(errors)
        print(json.dumps({'result':'PASS','code':code,'mobile_widths':[390,412],'host_title':host.locator('.game-heading h1').inner_text(),'guest_title':guest.locator('.game-heading h1').inner_text(),'page_errors':errors}))
    finally:
        host_context.close();guest_context.close();browser.close()
