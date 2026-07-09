/**
 * duo-smoke.mjs — end-to-end test of the "booth for two":
 * two SEPARATE browser instances (host + guest) with fake webcams connect
 * through a room, take a synced shot, land in the shared edit screen, and
 * mirror an edit. Two instances (not tabs) so neither is background-throttled.
 *
 *   HEADED=1 node scripts/duo-smoke.mjs   # real GPU, real pixels
 *   node scripts/duo-smoke.mjs            # headless CI-ish flow check
 */
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.SMOKE_URL || 'http://localhost:3000';
const HEADED = process.env.HEADED === '1';

async function makeBrowser(tag, x) {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: HEADED ? false : 'new',
    protocolTimeout: 240000,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--enable-unsafe-swiftshader',
      '--no-sandbox',
      '--window-size=980,760',
      `--window-position=${x},30`,
      '--mute-audio',
      `--user-data-dir=${process.env.TEMP}\\sb-duo-${tag}-${Date.now()}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
}

const errs = [];
async function preparePage(browser, tag) {
  const page = (await browser.pages())[0] || (await browser.newPage());
  await page.setViewport({ width: 960, height: 700 });
  if (!HEADED) await page.evaluateOnNewDocument(() => { window.__SB_NO_PREVIEW = true; });
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`[${tag}] console: ` + m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errs.push(`[${tag}] pageerror: ` + e.message.slice(0, 200)));
  return page;
}

const clickByText = async (page, text) => {
  const btns = await page.$$('button');
  for (const b of btns) {
    const t = (await page.evaluate((el) => el.textContent, b)) || '';
    if (t.toLowerCase().includes(text.toLowerCase())) { await b.click(); return true; }
  }
  return false;
};

const waitHydrated = async (page) => {
  await page.waitForFunction(() => {
    const el = document.querySelector('.landing');
    return el && getComputedStyle(el).position === 'absolute';
  }, { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 700));
};

const step = (s) => console.log('▶ ' + s);
let browserA, browserB;

try {
  browserA = await makeBrowser('host', 10);
  const A = await preparePage(browserA, 'host');

  step('host: load hub street');
  await A.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await waitHydrated(A);

  step('host: open the lobby, pick a color, open a room');
  if (!(await clickByText(A, '💞 open a room'))) throw new Error('no duo button');
  await new Promise((r) => setTimeout(r, 500));
  if (!(await clickByText(A, '✨ open a room'))) throw new Error('no host button');
  await A.waitForSelector('.link-text', { timeout: 25000 });
  const link = await A.$eval('.link-text', (el) => el.textContent);
  const code = await A.$eval('.code-big', (el) => el.textContent);
  console.log('   room link:', link, '· code:', code);

  step('guest: open the shared link in a second browser');
  browserB = await makeBrowser('guest', 1000);
  const B = await preparePage(browserB, 'guest');
  await B.goto(link, { waitUntil: 'networkidle2', timeout: 60000 });
  await waitHydrated(B);

  step('both connected on the street — host walks into the booth, guest should follow');
  await A.waitForFunction(() => document.querySelector('.room-chip'), { timeout: 40000 });
  await B.waitForFunction(() => document.querySelector('.room-chip'), { timeout: 40000 });
  await A.screenshot({ path: 'scripts/duo-1-hosting.png' });
  if (!(await clickByText(A, 'the photobooth'))) throw new Error('no booth button on host');

  step('waiting for both to land in capture…');
  await A.waitForSelector('.deck', { timeout: 40000 });
  await B.waitForSelector('.deck', { timeout: 40000 });
  await new Promise((r) => setTimeout(r, 5000)); // camera + media call settle
  await A.screenshot({ path: 'scripts/duo-2-capture-host.png' });
  await B.screenshot({ path: 'scripts/duo-3-capture-guest.png' });

  const chipA = await A.$eval('.duo-chip', (el) => el.textContent).catch(() => 'NO CHIP');
  const chipB = await B.$eval('.duo-chip', (el) => el.textContent).catch(() => 'NO CHIP');
  console.log('   host chip:', chipA);
  console.log('   guest chip:', chipB);

  step('host: switch to single snap, then SNAP');
  const arrows = await A.$$('button[aria-label="next mode"]');
  if (arrows[0]) await arrows[0].click();
  await new Promise((r) => setTimeout(r, 300));
  const snapBtns = await A.$$('button[aria-label*="take photos"]');
  await snapBtns[0].click();

  step('waiting for the mutual confirm bar (fire_at countdown + frame exchange)…');
  await A.waitForSelector('.confirm-bar', { timeout: 90000 });
  await B.waitForSelector('.confirm-bar', { timeout: 90000 });
  step('host: ✨ print it (both should print)');
  if (!(await clickByText(A, 'print it'))) throw new Error('no print button');

  step('waiting for both edit screens…');
  await A.waitForSelector('.strip-canvas', { timeout: 90000 });
  await B.waitForSelector('.strip-canvas', { timeout: 90000 });
  await new Promise((r) => setTimeout(r, 2500));
  await A.screenshot({ path: 'scripts/duo-4-edit-host.png' });
  await B.screenshot({ path: 'scripts/duo-5-edit-guest.png' });

  step('edit sync: host picks the sky frame, guest strip should follow');
  const tabs = await A.$$('button[role="tab"]');
  for (const t of tabs) {
    const l = (await A.evaluate((el) => el.textContent, t)) || '';
    if (l.includes('frame')) { await t.click(); break; }
  }
  await new Promise((r) => setTimeout(r, 400));
  const swatches = await A.$$('.swatch');
  await swatches[4].click(); // sky #BDE0FE
  await new Promise((r) => setTimeout(r, 1500));
  const px = await B.$eval('.strip-canvas', (c) => {
    const x = document.createElement('canvas');
    x.width = 8; x.height = 8;
    const ctx = x.getContext('2d');
    ctx.drawImage(c, 0, 0, 8, 8, 0, 0, 8, 8);
    return Array.from(ctx.getImageData(1, 1, 1, 1).data).slice(0, 3);
  });
  const isSky = Math.abs(px[0] - 189) < 25 && Math.abs(px[1] - 224) < 25 && Math.abs(px[2] - 254) < 25;
  console.log(`   guest strip corner px: ${px.join(',')} → ${isSky ? 'SKY ✔ (edit sync works)' : 'NOT SKY ✖'}`);
  await B.screenshot({ path: 'scripts/duo-6-edit-synced.png' });

  console.log('\n=== RESULT ===');
  const clean = errs.filter((e) => !e.includes('favicon') && !e.includes('404'));
  if (clean.length) { console.log('ERRORS:'); clean.slice(0, 15).forEach((e) => console.log('  - ' + e)); }
  else console.log('duo flow complete, no page errors ✔');
  if (!isSky) process.exitCode = 1;
} catch (e) {
  console.log('\n✖ DUO SMOKE FAILED: ' + e.message);
  errs.slice(0, 15).forEach((er) => console.log('  - ' + er));
  process.exitCode = 1;
} finally {
  await browserA?.close().catch(() => {});
  await browserB?.close().catch(() => {});
}
