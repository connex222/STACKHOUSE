import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const offline=readFileSync(new URL('../PLAY-OFFLINE.html',import.meta.url),'utf8');
const ci=readFileSync(new URL('../.github/workflows/accessibility-smoke.yml',import.meta.url),'utf8');
test('All screens expose a stable, keyboard-focusable main landmark',()=>{
  const screens=main.match(/<main id="main-content" tabindex="-1" class="/g)||[];
  assert.equal(screens.length,9,'Home, room and all seven game-layout families have a main landmark');
});
test('Skip link is the first keyboard target inside the app',()=>{
  assert.match(main,/app\.innerHTML=`<div class="site-wrap"><a class="skip-link" href="#main-content">Skip to main content<\/a>/);
  assert.match(css,/\.skip-link:focus/);
  assert.match(offline,/class="skip-link" href="#main-content"/);
});
test('Automated accessibility workflow runs reflow checks for every game',()=>{
  assert.match(ci,/python scripts\/reflow-smoke\.py/);
});
