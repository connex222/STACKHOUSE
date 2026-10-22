"""Emulated mobile-browser acceptance: private join, live updates, refresh and group tables.

Run against a locally started Stackhouse server:
  STACKHOUSE_URL=http://127.0.0.1:4173 python scripts/browser-acceptance.py

This script exercises independent mobile browser contexts; it is not a physical-device test.
"""
import json
import os
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('STACKHOUSE_URL', 'http://127.0.0.1:4173').rstrip('/')


def mobile(browser, width, name, errors):
    context = browser.new_context(
        viewport={'width': width, 'height': 844}, device_scale_factor=1,
        is_mobile=True, has_touch=True
    )
    page = context.new_page()
    page.on('pageerror', lambda err: errors.append(f'{name}: {err}'))
    return context, page


def create_room(page, game, seats, name):
    page.goto(BASE, wait_until='domcontentloaded')
    page.locator('[data-action="room-open"]').first.click()
    page.locator('#room-name').fill(name)
    page.locator('#room-game').select_option(game)
    page.locator('#room-capacity').select_option(str(seats))
    page.locator('[data-action="room-host"]').click()
    code = page.locator('.room-code').inner_text(timeout=15000).strip()
    assert len(code) == 6, f'Invalid room code: {code!r}'
    return code


def join_room(page, code, name):
    page.goto(f'{BASE}/?room={code}', wait_until='domcontentloaded')
    page.locator('#room-name').fill(name)
    page.locator('[data-action="room-join"]').click()
    return page


def check_phone(page, expected_game):
    expect(page.locator('.game-heading h1')).to_contain_text(expected_game, timeout=15000)
    expect(page.locator('.game-heading')).to_contain_text('PRIVATE TABLE')
    overflow = page.evaluate('document.documentElement.scrollWidth - window.innerWidth')
    assert overflow <= 5, f'Horizontal overflow of {overflow}px at {page.viewport_size}'


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    errors = []
    contexts = []
    try:
        host_ctx, host = mobile(browser, 390, 'head-to-head host', errors)
        guest_ctx, guest = mobile(browser, 412, 'head-to-head guest', errors)
        contexts.extend([host_ctx, guest_ctx])
        code = create_room(host, 'eight-shift', 2, 'Mobile Host')
        join_room(guest, code, 'Mobile Guest')
        check_phone(host, 'Eight Shift')
        check_phone(guest, 'Eight Shift')
        guest_count = guest.locator('[data-action="eight-draw"] small').inner_text()
        expect(host.locator('[data-action="eight-draw"]')).to_be_enabled()
        host.locator('[data-action="eight-draw"]').click()
        expect(guest.locator('[data-action="eight-draw"] small')).not_to_have_text(guest_count, timeout=15000)
        host.reload(wait_until='domcontentloaded')
        check_phone(host, 'Eight Shift')
        assert code in host.url, 'Host lost their room after reloading'

        group_ctx, group_host = mobile(browser, 375, 'group host', errors)
        contexts.append(group_ctx)
        group_code = create_room(group_host, 'phase-quest', 4, 'Group Host')
        group_pages = [group_host]
        for index, width in enumerate((390, 412, 375), start=1):
            context, page = mobile(browser, width, f'group guest {index}', errors)
            contexts.append(context)
            join_room(page, group_code, f'Group Guest {index}')
            group_pages.append(page)
        for page in group_pages:
            check_phone(page, 'Phase Quest')
            assert '4 players' not in (page.locator('.room-panel').inner_text() if page.locator('.room-panel').count() else ''), 'Room stayed in waiting mode'
        assert not errors, f'Browser JavaScript errors: {errors}'
        print(json.dumps({
            'result': 'PASS', 'type': 'emulated_mobile_browsers',
            'two_player_game': 'Eight Shift', 'live_opponent_update': True,
            'refresh_recovered': True, 'four_player_game': 'Phase Quest',
            'browser_contexts': 6, 'widths': [375, 390, 412], 'js_errors': errors
        }))
    finally:
        for context in contexts:
            context.close()
        browser.close()
