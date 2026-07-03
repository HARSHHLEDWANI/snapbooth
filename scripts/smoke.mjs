import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.SMOKE_URL || 'http://localhost:3000';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--ignore-gpu-blocklist',
    '--no-sandbox',
    '--window-size=1280,900',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
// headless SwiftShader stalls consuming live video frames — skip preview painting
await page.evaluateOnNewDocument(() => { window.__SB_NO_PREVIEW = true; });

const errors = [];
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); else logs.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => {
  const u = r.url();
  if (!u.includes('mediapipe') && !u.includes('gstatic') && !u.includes('cdn.')) errors.push('reqfail: ' + u + ' ' + r.failure()?.errorText);
});

const step = (s) => console.log('▶ ' + s);

try {
  step('load landing');
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));

  // name prompt -> skip
  step('dismiss name prompt');
  const skip = await page.$$('button');
  for (const b of skip) {
    const t = await page.evaluate((el) => el.textContent, b);
    if (t && t.toLowerCase().includes('skip')) { await b.click(); break; }
  }
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: 'scripts/shot-1-landing.png' });

  // enter booth
  step('click enter the booth');
  const btns = await page.$$('button');
  for (const b of btns) {
    const t = await page.evaluate((el) => el.textContent, b);
    if (t && t.toLowerCase().includes('enter the booth')) { await b.click(); break; }
  }
  // wait for capture view (control deck) — allow for GSAP dolly
  step('wait for capture view + camera');
  await page.waitForSelector('.deck', { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: 'scripts/shot-2-capture.png' });

  // switch to single-snap mode for a fast capture, then SNAP
  step('select single snap via mode dots then SNAP');
  // click the arcade SNAP button
  const snap = await page.$$('button');
  let snapped = false;
  for (const b of snap) {
    const t = await page.evaluate((el) => el.getAttribute('aria-label') || '', b);
    if (t.includes('take photos')) { await b.click(); snapped = true; break; }
  }
  console.log('   snap clicked:', snapped);

  // wait through countdown + capture + print -> edit screen
  step('wait for edit screen (strip canvas)');
  await page.waitForSelector('.strip-canvas', { timeout: 25000 });
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: 'scripts/shot-3-edit.png' });

  // check the strip canvas has non-trivial size
  const strip = await page.$eval('.strip-canvas', (c) => ({ w: c.width, h: c.height }));
  console.log('   strip canvas:', JSON.stringify(strip));

  // add a sticker via the stickers tab
  step('open stickers tab + add one');
  const tabs = await page.$$('button[role="tab"]');
  for (const t of tabs) {
    const label = await page.evaluate((el) => el.textContent, t);
    if (label && label.toLowerCase().includes('stickers')) { await t.click(); break; }
  }
  await new Promise((r) => setTimeout(r, 400));
  const sbtn = await page.$('.sticker-btn');
  if (sbtn) await sbtn.click();
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: 'scripts/shot-4-sticker.png' });
  const stickerCount = await page.$$eval('.sticker', (els) => els.length);
  console.log('   stickers on strip:', stickerCount);

  console.log('\n=== RESULT ===');
  if (errors.length) {
    console.log('ERRORS (' + errors.length + '):');
    errors.slice(0, 20).forEach((e) => console.log('  - ' + e));
  } else {
    console.log('no console/page errors ✔');
  }
} catch (e) {
  console.log('\n✖ SMOKE FAILED: ' + e.message);
  await page.screenshot({ path: 'scripts/shot-fail.png' }).catch(() => {});
  errors.forEach((er) => console.log('  - ' + er));
  process.exitCode = 1;
} finally {
  await browser.close();
}
