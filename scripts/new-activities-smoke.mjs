/**
 * new-activities-smoke.mjs — two browsers connect a room, then:
 *  1. "we decide": host deals, both pick the same option → both see AGREED
 *  2. "the hangout": host switches to dice (guest's tool must follow) and
 *     rolls — both screens must land on the SAME face
 *  3. "tied together": host starts level 1 — the guest's canvas must render
 *     a blob (proves host→guest physics snapshots are flowing)
 */
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.SMOKE_URL || 'http://localhost:3000';

async function makeBrowser(tag, x) {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    protocolTimeout: 240000,
    args: [
      '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
      '--enable-unsafe-swiftshader', '--no-sandbox', '--mute-audio',
      `--window-position=${x},30`, '--window-size=980,760',
      `--user-data-dir=${process.env.TEMP}\\tp-newact-${tag}-${Date.now()}`,
      '--no-first-run', '--no-default-browser-check',
    ],
  });
}

const errs = [];
async function preparePage(browser, tag) {
  const page = (await browser.pages())[0] || (await browser.newPage());
  await page.setViewport({ width: 960, height: 700 });
  await page.evaluateOnNewDocument(() => { window.__SB_NO_PREVIEW = true; });
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`[${tag}] console: ` + m.text().slice(0, 180)); });
  page.on('pageerror', (e) => errs.push(`[${tag}] pageerror: ` + e.message.slice(0, 180)));
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
const navTo = async (page, label) => {
  await page.waitForSelector('.plain-nav', { timeout: 15000 });
  for (const b of await page.$$('.plain-nav button')) {
    const t = ((await page.evaluate((el) => el.textContent, b)) || '').trim();
    if (t === label) { await b.click(); return true; }
  }
  return false;
};
const backToStreet = async (A, B) => {
  await clickByText(A, '← street');
  await clickByText(B, '← street');
  await A.waitForSelector('.plain-nav', { timeout: 15000 });
  await B.waitForSelector('.plain-nav', { timeout: 15000 });
};
const step = (s) => console.log('▶ ' + s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browserA, browserB;

try {
  browserA = await makeBrowser('host', 10);
  const A = await preparePage(browserA, 'host');
  await A.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await A.waitForSelector('.landing', { timeout: 60000 });
  await sleep(800);

  step('host: open a room');
  if (!(await clickByText(A, '💞 open a room'))) throw new Error('no duo button');
  await sleep(400);
  if (!(await clickByText(A, '✨ open a room'))) throw new Error('no host button');
  await A.waitForSelector('.link-text', { timeout: 25000 });
  const link = await A.$eval('.link-text', (el) => el.textContent);
  console.log('   link:', link);

  step('guest joins');
  browserB = await makeBrowser('guest', 1000);
  const B = await preparePage(browserB, 'guest');
  await B.goto(link, { waitUntil: 'networkidle2', timeout: 60000 });
  await A.waitForFunction(() => document.querySelector('.room-chip'), { timeout: 40000 });
  await B.waitForFunction(() => document.querySelector('.room-chip'), { timeout: 40000 });

  // ── 1. we decide ──
  step('WE DECIDE: host opens it from the nav — guest follows');
  if (!(await navTo(A, 'decide'))) throw new Error('no decide nav button');
  await A.waitForSelector('.dec-wrap', { timeout: 20000 });
  await B.waitForSelector('.dec-wrap', { timeout: 20000 });
  console.log('   both in decide ✔');

  step('host deals — both should see the same question');
  await A.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('deal the questions')), { timeout: 10000 });
  await clickByText(A, 'deal the questions');
  await A.waitForSelector('.dec-wrap .opt', { timeout: 10000 });
  await B.waitForSelector('.dec-wrap .opt', { timeout: 10000 });
  const dqA = await A.$eval('.dec-wrap h3', (el) => el.textContent);
  const dqB = await B.$eval('.dec-wrap h3', (el) => el.textContent);
  console.log('   host q:', dqA);
  console.log('   guest q:', dqB);
  if (dqA !== dqB) throw new Error('decide questions differ');

  step('both pick option 1 → AGREED on both');
  await (await A.$$('.dec-wrap .opt'))[0].click();
  await sleep(300);
  await (await B.$$('.dec-wrap .opt'))[0].click();
  await A.waitForSelector('.dec-wrap .verdict', { timeout: 8000 });
  await B.waitForSelector('.dec-wrap .verdict', { timeout: 8000 });
  const vA = await A.$eval('.dec-wrap .verdict', (el) => el.textContent);
  const vB = await B.$eval('.dec-wrap .verdict', (el) => el.textContent);
  console.log('   verdicts:', vA, '·', vB);
  if (!vA.includes('AGREED') || !vB.includes('AGREED')) throw new Error('decide reveal did not agree');
  await A.screenshot({ path: 'scripts/newact-1-decide.png' });

  // ── 2. the hangout ──
  step('HANGOUT: host opens it — guest follows');
  await backToStreet(A, B);
  if (!(await navTo(A, 'hangout'))) throw new Error('no hangout nav button');
  await A.waitForSelector('.hang-wrap', { timeout: 20000 });
  await B.waitForSelector('.hang-wrap', { timeout: 20000 });
  console.log('   both in the hangout ✔');

  step('host switches to dice — guest tool must follow — then rolls');
  for (const b of await A.$$('.belt-btn')) {
    const t = (await A.evaluate((el) => el.textContent, b)) || '';
    if (t.includes('dice')) { await b.click(); break; }
  }
  await A.waitForSelector('.die', { timeout: 8000 });
  await B.waitForSelector('.die', { timeout: 8000 });
  console.log('   tool switch synced ✔');
  await clickByText(A, 'roll');
  await sleep(1600); // tumble animation
  const dieA = await A.$eval('.die', (el) => el.textContent);
  const dieB = await B.$eval('.die', (el) => el.textContent);
  console.log('   dice:', dieA, '·', dieB);
  if (dieA !== dieB || !'⚀⚁⚂⚃⚄⚅'.includes(dieA)) throw new Error('dice did not sync');
  await A.screenshot({ path: 'scripts/newact-2-hangout.png' });

  // ── 3. tied together ──
  step('TIED TOGETHER: host opens the park — guest follows');
  await backToStreet(A, B);
  if (!(await navTo(A, 'tied'))) throw new Error('no tied nav button');
  await A.waitForSelector('.rope-wrap', { timeout: 20000 });
  await B.waitForSelector('.rope-wrap', { timeout: 20000 });
  console.log('   both at the park ✔');

  step('host starts level 1 — guest canvas must render a blob (snapshots flowing)');
  await A.waitForSelector('.level-btn', { timeout: 10000 });
  await (await A.$$('.level-btn'))[0].click();
  await A.waitForSelector('.rope-wrap .stage canvas', { timeout: 25000 });
  await B.waitForSelector('.rope-wrap .stage canvas', { timeout: 25000 });

  // scan the spawn region of the GUEST canvas for blob pink (#ff8fab-ish):
  // sky/platform pixels have green > 190; blob pixels sit near g≈143.
  let blobSeen = false;
  for (let tries = 0; tries < 20 && !blobSeen; tries++) {
    await sleep(500);
    blobSeen = await B.$eval('.rope-wrap .stage canvas', (c) => {
      const ctx = c.getContext('2d');
      const d = ctx.getImageData(80, 440, 220, 180).data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 230 && d[i + 1] > 110 && d[i + 1] < 185 && d[i + 2] > 140) return true;
      }
      return false;
    });
  }
  console.log('   guest sees the blobs:', blobSeen);
  if (!blobSeen) throw new Error('guest never rendered a blob — snapshots not arriving');
  await A.screenshot({ path: 'scripts/newact-3-rope-host.png' });
  await B.screenshot({ path: 'scripts/newact-4-rope-guest.png' });

  console.log('\n=== RESULT ===');
  const clean = errs.filter((e) => !e.includes('favicon') && !e.includes('404') && !e.includes('loremflickr') && !e.includes('picsum'));
  if (clean.length) { console.log('ERRORS:'); clean.slice(0, 15).forEach((e) => console.log('  - ' + e)); process.exitCode = 1; }
  else console.log('new-activities flow complete, no page errors ✔');
} catch (e) {
  console.log('\n✖ NEW-ACTIVITIES SMOKE FAILED: ' + e.message);
  errs.slice(0, 15).forEach((er) => console.log('  - ' + er));
  process.exitCode = 1;
} finally {
  await browserA?.close().catch(() => {});
  await browserB?.close().catch(() => {});
}
