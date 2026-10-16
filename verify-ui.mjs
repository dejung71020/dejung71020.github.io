import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve('dist');
const evidence = path.resolve('../../verification');
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const resolved = path.resolve(root, '.' + pathname);
    if (!resolved.startsWith(root + path.sep) && resolved !== root) { res.writeHead(403).end(); return; }
    const file = path.extname(resolved) ? resolved : path.join(resolved, 'index.html');
    const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp'};
    const body = await readFile(file);
    res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'}).end(body);
  } catch { res.writeHead(404).end('Not found'); }
});
let browser;
const errors = [];
const results = [];
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  await mkdir(evidence, {recursive:true});
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  for (const width of [320,390,768,1265,1440]) {
    await page.setViewportSize({width,height:900});
    await page.goto(base, {waitUntil:'networkidle'});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true, `overflow ${width}`);
    const title = await page.locator('.portfolio-intro h1').boundingBox();
    const card = await page.locator('.intro-note').boundingBox();
    assert(title && card);
    const overlaps = title.x < card.x + card.width && card.x < title.x + title.width && title.y < card.y + card.height && card.y < title.y + title.height;
    assert.equal(overlaps,false, `title covered ${width}`);
    assert.equal(await page.locator('img[src]').evaluateAll(es=>es.every(e=>e.complete && e.naturalWidth > 0)),true,`image missing ${width}`);
    await page.screenshot({path:path.join(evidence,`home-${width}.png`),fullPage:true});
    if(width===1440) await page.screenshot({path:path.join(evidence,'home-first-screen.png')});
    results.push({width,overflow:false,titleCovered:false,imagesLoaded:true});
  }
  await page.goto(base);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').textContent(),'본문으로 이동');
  await page.keyboard.press('Enter');
  assert.equal(new URL(page.url()).hash,'#content');
  assert.equal(await page.locator(':focus').getAttribute('id'),'content');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').getAttribute('href'),'#work');
  for (const slug of ['yamon','pangpangpang','meeting-agent']) {
    await page.goto(base);
    await page.locator(`.project-card[href="/case-studies/${slug}"]`).click();
    await page.waitForURL(`**/case-studies/${slug}`);
    assert.equal(await page.locator('h1').count(),1);
    assert.equal(await page.locator('.case-image').first().evaluate(e=>e.complete&&e.naturalWidth>0),true);
    await page.locator('.image-inspect').first().focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.image-dialog').evaluate(e=>e.open),true);
    assert.equal(await page.locator('.image-dialog img').evaluate(e=>e.complete&&e.naturalWidth>0),true);
    if(slug==='meeting-agent') await page.screenshot({path:path.join(evidence,'meeting-agent-expanded.png')});
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.image-dialog').evaluate(e=>e.open),false);
    assert.equal(await page.locator(':focus').getAttribute('class'),'image-inspect');
    await page.locator('.back-link').click();
    assert.equal(new URL(page.url()).hash,'#work');
  }
  for (const route of ['/about','/contact']) {
    await page.goto(base+route,{waitUntil:'networkidle'});
    assert.equal(await page.locator('h1').count(),1);
  }
  await page.goto(base);
  for (const color of ['coral','blue','lime']) {
    const button = page.locator(`[data-theme-choice="${color}"]`);
    await button.focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('html').getAttribute('data-palette'),color);
    assert.equal(await page.locator('.palette [aria-pressed="true"]').count(),1);
    assert.equal(await button.getAttribute('aria-pressed'),'true');
  }
  const allRoutes = ['/','/about','/contact','/case-studies/yamon','/case-studies/pangpangpang','/case-studies/meeting-agent','/case-studies/allocation','/case-studies/matches','/projects/workb','/projects/pangpangpang','/case-studies/wallet-os','/case-studies/soccer-intelligence','/case-studies/production-refactoring','/vibe-carving'];
  for (const route of allRoutes) {
    await page.setViewportSize({width:320,height:900});
    await page.goto(base+route,{waitUntil:'networkidle'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`route overflow: ${route}`);
    assert.equal(await page.evaluate(()=>/\uC774\uB300\uC911|\uC774\uAE30\uC068|Daejung\sLee|@gmail\.com|01[016789]-?\d{3,4}-?\d{4}|mailto:|tel:/i.test(document.documentElement.outerHTML)),false,`privacy ${route}`);
    await page.setViewportSize({width:720,height:900});
    await page.evaluate(()=>document.documentElement.style.zoom='2');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`zoom overflow: ${route} `+JSON.stringify(await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+1&&getComputedStyle(e).position!=='absolute'}).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right})).slice(0,10)}))));
    await page.evaluate(()=>document.documentElement.style.zoom='');
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(base);
  assert.equal(await page.locator('.project-image img').first().evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
  assert.equal(await page.locator('.sculpture svg').evaluate(e=>getComputedStyle(e).animationName),'none');
  const publicText = await page.locator('body').textContent();
  assert(!/QUAIL|3SforU|CMJOB|WorkB|yageun\.com/i.test(publicText));
  await page.goto(new URL('../../preview/index.html', import.meta.url).href, {waitUntil:'load'});
  assert.equal(await page.locator('img[src]').evaluateAll(es=>es.every(e=>e.complete&&e.naturalWidth>0)),true);
  await page.locator('.project-card').first().click();
  assert(page.url().endsWith('/yamon.html'));
  await page.locator('.back-link').click();
  assert(page.url().endsWith('/index.html#work'));
  assert.deepEqual(errors,[]);
  await writeFile(path.join(evidence,'ui-results.json'),JSON.stringify({results,keyboard:true,projectNavigation:3,otherRoutes:2,reducedMotion:true,paletteKeyboard:true,modalKeyboard:true,smallestWidth:320,zoom:'200% CSS zoom at 720px viewport',routeOverflowChecks:14,consoleErrors:errors,scope:'Local proposal only. External demo links and production deployment are separate.'},null,2));
  console.log('PASS: five widths, fourteen routes, 200% CSS zoom, palette keyboard, modal/escape/focus return, images, project navigation, reduced motion; no page/resource errors.');
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
