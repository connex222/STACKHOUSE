"""Browser-based audio controls check. Checks media play promise; not physical speaker output."""
from pathlib import Path
import json, os, re, shutil
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
html=(root/'PLAY-OFFLINE.html').read_text(encoding='utf8')
html=re.sub(r'data:image/webp;base64,[A-Za-z0-9+/=]{100,}',
            'data:image/webp;base64,UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAUAAAABAAEAAAA=',html)
with sync_playwright() as p:
    kwargs={'headless':True,'args':['--no-sandbox','--autoplay-policy=user-gesture-required']}
    exe=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
    if exe: kwargs['executable_path']=exe
    browser=p.chromium.launch(**kwargs)
    page=browser.new_page(viewport={'width':390,'height':844})
    errors=[]
    page.on('pageerror',lambda err: errors.append(str(err)))
    page.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    page.route('https://fonts.gstatic.com/**',lambda r:r.abort())
    page.evaluate("""Object.defineProperty(window,'localStorage',{configurable:true,value:{
      getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
      Object.defineProperty(window.crypto,'randomUUID',{configurable:true,
        value:()=> '36ba6577-eaf1-4a50-a10d-a5b1e733ec08'});""")
    page.set_content(html,wait_until='commit',timeout=25000)
    page.locator('button[data-action="test-sound"]').wait_for(timeout=12000)
    assert page.get_by_role('button',name='Play test sound').count()==1
    assert page.get_by_role('slider',name='Game sound volume').count()==1
    page.get_by_role('slider',name='Game sound volume').fill('0')
    assert 'Volume is zero' in page.locator('#sound-status').inner_text()
    page.get_by_role('button',name='Play test sound').click()
    assert 'Volume is zero' in page.locator('#sound-status').inner_text()
    page.get_by_role('slider',name='Game sound volume').fill('90')
    page.get_by_role('button',name='Play test sound').click()
    page.wait_for_function('document.getElementById("sound-status").textContent!=="Testing sound…"',timeout=9000)
    state=page.locator('#sound-status').inner_text()
    assert 'Test sound played' in state or 'Playing backup tone' in state, f'Sound not confirmed: {state}'
    page.get_by_role('button',name='Turn off game sounds').click()
    assert page.locator('#sound-status').inner_text()=='Sound muted.'
    page.get_by_role('button',name='Turn on game sounds').click()
    assert page.locator('#sound-status').inner_text().startswith('Sound enabled.')
    assert not errors,errors
    browser.close()
    print(json.dumps({'result':'PASS','checks':['test control','sound volume at zero','audible playback promise or fallback','mute','unmute','no JavaScript exceptions'],'finalStatus':state,'limitations':['Browser success does not confirm physical speaker volume','Not a real mobile device']}))
