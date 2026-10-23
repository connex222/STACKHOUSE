"""Phase 24: real UI + HTTP/SSE simulated four-phone / TV test.
Not a substitute for tests on physical devices or screen readers.
Launches an isolated local Node server by default. Requires Playwright and Chromium.
"""
from __future__ import annotations
import json
import os
import shutil
import socket
import subprocess
import time
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]

def unused_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]

port = unused_port()
base = f'http://127.0.0.1:{port}'
env = {**os.environ, 'PORT': str(port), 'DATABASE_URL': '', 'ROOM_DATA_FILE': ''}
server = subprocess.Popen(['node', 'server.js'], cwd=ROOT, env=env,
                          stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
try:
    for attempt in range(90):
        if server.poll() is not None:
            raise RuntimeError('Local server exited before browser testing')
        try:
            with urlopen(base+'/health', timeout=0.5) as result:
                if result.status == 200:
                    break
        except Exception:
            time.sleep(0.08)
    else:
        raise RuntimeError('Local server did not start')
    with sync_playwright() as playwright:
        executable = os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
        settings={'headless': True, 'args':['--no-sandbox','--disable-dev-shm-usage']}
        if executable: settings['executable_path'] = executable
        browser = playwright.chromium.launch(**settings)
        contexts=[]
        errors=[]
        try:
            for size in [(390,844),(412,915),(320,760),(375,812)]:
                ctx=browser.new_context(viewport={'width':size[0],'height':size[1]},
                                        is_mobile=True,has_touch=True,device_scale_factor=1)
                contexts.append(ctx)
            pages=[ctx.new_page() for ctx in contexts]
            for i,page in enumerate(pages):
                page.on('pageerror',lambda error,n=i:errors.append(f'phone {n+1}: {error}'))
            host=pages[0]
            host.goto(base,wait_until='domcontentloaded')
            host.locator('[data-action="room-open"]').first.click()
            host.locator('#room-name').fill('Host')
            host.locator('#room-game').select_option('eight-shift')
            host.locator('#room-capacity').select_option('4')
            host.locator('[data-action="room-host"]').click()
            host.locator('.room-code').wait_for(timeout=12000)
            code=host.locator('.room-code').inner_text().strip()
            assert len(code)==6,code
            for i,guest in enumerate(pages[1:],start=2):
                guest.goto(f'{base}/?room={code}',wait_until='domcontentloaded')
                guest.locator('#room-name').fill(f'Guest {i}')
                guest.locator('[data-action="room-join"]').click()
            for page in pages:
                expect(page.locator('.game-heading')).to_be_visible(timeout=10000)
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 5')
            host_token=host.evaluate('code=>localStorage.getItem(`stackhouse.room.${code}`)',code)
            assert host_token and len(host_token)>30
            # Create TV credentials using the same authenticated route as the host button.
            created=host.evaluate('''async([code,token])=>{
                let state=await fetch(`/api/rooms/${code}/state`,{headers:{authorization:`Bearer ${token}`}}).then(r=>r.json());
                let response=await fetch(`/api/rooms/${code}/host`,{method:'POST',
                  headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
                  body:JSON.stringify({type:'tv-create',revision:state.revision})});
                return {status:response.status,...await response.json()};
             }''',[code,host_token])
            assert created['status']==200,created
            tv_context=browser.new_context(viewport={'width':1920,'height':1080})
            contexts.append(tv_context)
            tv=tv_context.new_page()
            tv.on('pageerror',lambda error:errors.append(f'tv: {error}'))
            watch_key=created['watchKey']
            tv.goto(f'{base}/tv.html#room={code}&key={watch_key}',wait_until='domcontentloaded')
            expect(tv.locator('.tv-player')).to_have_count(4,timeout=10000)
            # Mobile CSS hides the eyebrow visually; text_content still checks its DOM text.
            assert 'PRIVATE TABLE' in host.locator('.game-heading').text_content()
            assert 'Host' in tv.locator('.tv-grid').inner_text()
            assert tv.locator('.hand-piece').count()==0
            assert tv.locator('.tv-footer').inner_text().count('Read-only screen')==1
            assert tv.evaluate('document.documentElement.scrollWidth <= innerWidth + 5')
            # Host pause and resume, as experienced live in independent page contexts.
            # Mobile host controls are intentionally kept in the Details drawer.
            host.locator('.mobile-details-button').click()
            host.locator('.game-page.drawer-open [data-action="host-pause"]:visible').click()
            expect(tv.locator('.tv-paused')).to_be_visible(timeout=10000)
            expect(pages[1].locator('.table-paused')).to_be_visible(timeout=10000)
            host.locator('.game-page.drawer-open [data-action="host-resume"]:visible').click()
            expect(tv.locator('.tv-paused')).to_have_count(0,timeout=10000)
            # Simulate a transient server failure exactly during saved-seat recovery.
            guest=pages[1]
            stored=guest.evaluate('code=>localStorage.getItem(`stackhouse.room.${code}`)',code)
            assert stored
            def temporary_outage(route):
                route.fulfill(status=503,content_type='application/json',body=json.dumps({'error':'Server warming up. Try again.'}))
            guest.route(f'**/api/rooms/{code}/state',temporary_outage)
            guest.reload(wait_until='domcontentloaded')
            expect(guest.locator('[data-action="room-retry-seat"]')).to_be_visible(timeout=10000)
            assert guest.evaluate('code=>localStorage.getItem(`stackhouse.room.${code}`)',code)==stored,'Temporary 503 erased valid player credential'
            guest.unroute(f'**/api/rooms/{code}/state',temporary_outage)
            guest.locator('[data-action="room-retry-seat"]').click()
            expect(guest.locator('.game-heading')).to_be_visible(timeout=10000)
            assert guest.evaluate('code=>localStorage.getItem(`stackhouse.room.${code}`)',code)==stored
            # Revoke the link. The still-open TV stream must cease and show an error.
            host.locator('.game-page.drawer-open [data-action="host-tv-disable"]:visible').click()
            expect(tv.locator('.tv-error')).to_be_visible(timeout=10000)
            assert not errors,errors
            print(json.dumps({'result':'PASS','independentMobileBrowserSessions':4,
                  'mobileViewports':[390,412,320,375],'tvViewport':'1920x1080',
                  'checks':['join and play screen','public TV view','host pause/resume','spectator revocation',
                            'transient server outage retains guest seat','manual recovery retry','no horizontal overflow',
                            'no browser script errors'], 'pageErrors':errors,
                  'notTested':['physical devices','native screen readers','durable cloud storage']}))
        finally:
            for context in contexts:context.close()
            browser.close()
finally:
    server.terminate()
    try:server.wait(timeout=5)
    except subprocess.TimeoutExpired:server.kill()
