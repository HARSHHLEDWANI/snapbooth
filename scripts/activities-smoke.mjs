/**
 * activities-smoke.mjs — two browsers connect a room on the street, the host
 * opens the QUIZ from the plain-text nav (guest must follow via the
 * open-activity message), they play one question over the activity channel,
 * and both must see the same simultaneous reveal.
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
      `--user-data-dir=${process.env.TEMP}\\tp-act-${tag}-${Date.now()}`,
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
const step = (s) => console.log('▶ ' + s);
let browserA, browserB;

try {
  browserA = await makeBrowser('host', 10);
  const A = await preparePage(browserA, 'host');
  await A.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await A.waitForSelector('.landing', { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 800));

  step('host: open a room');
  if (!(await clickByText(A, '💞 open a room'))) throw new Error('no duo button');
  await new Promise((r) => setTimeout(r, 400));
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

  step('host opens QUIZ from the top nav — guest should be pulled in');
  const navBtns = await A.$$('.plain-nav button');
  let clicked = false;
  for (const b of navBtns) {
    const t = (await A.evaluate((el) => el.textContent, b)) || '';
    if (t.trim() === 'quiz') { await b.click(); clicked = true; break; }
  }
  if (!clicked) throw new Error('no quiz nav button');
  await A.waitForSelector('.quiz-wrap', { timeout: 20000 });
  await B.waitForSelector('.quiz-wrap', { timeout: 20000 });
  console.log('   both in quiz ✔');

  step('host picks the cute pack — both should get question 1');
  await A.waitForSelector('.pack', { timeout: 10000 });
  const packs = await A.$$('.pack');
  await packs[0].click();
  await A.waitForSelector('.opt', { timeout: 10000 });
  await B.waitForSelector('.opt', { timeout: 10000 });
  const qA = await A.$eval('.q-card h3', (el) => el.textContent);
  const qB = await B.$eval('.q-card h3', (el) => el.textContent);
  console.log('   host q:', qA);
  console.log('   guest q:', qB);
  if (qA !== qB) throw new Error('questions differ between peers');

  step('both pick option 1 → simultaneous reveal should MATCH');
  await (await A.$$('.opt'))[0].click();
  await new Promise((r) => setTimeout(r, 300));
  await (await B.$$('.opt'))[0].click();
  await A.waitForSelector('.verdict', { timeout: 8000 });
  await B.waitForSelector('.verdict', { timeout: 8000 });
  const vA = await A.$eval('.verdict', (el) => el.textContent);
  const vB = await B.$eval('.verdict', (el) => el.textContent);
  console.log('   host verdict:', vA, '· guest verdict:', vB);
  await A.screenshot({ path: 'scripts/act-1-quiz-host.png' });
  await B.screenshot({ path: 'scripts/act-2-quiz-guest.png' });
  if (!vA.includes('MATCHED') || !vB.includes('MATCHED')) throw new Error('reveal did not match');

  step('wait for auto-advance to question 2 on both');
  await A.waitForFunction(() => document.querySelector('.progress')?.textContent?.includes('2 /'), { timeout: 10000 });
  await B.waitForFunction(() => document.querySelector('.progress')?.textContent?.includes('2 /'), { timeout: 10000 });
  console.log('   advanced together ✔');

  step('host opens the ARCADE via nav — guest follows; open reaction duel');
  const navA = await A.$$('.plain-nav button');
  // nav is hidden after leaving landing — use the header back button then nav
  const backA = await clickByText(A, '← street');
  const backB = await clickByText(B, '← street');
  console.log('   back to street:', backA, backB);
  await A.waitForSelector('.plain-nav', { timeout: 15000 });
  const nav2 = await A.$$('.plain-nav button');
  for (const b of nav2) {
    const t = (await A.evaluate((el) => el.textContent, b)) || '';
    if (t.trim() === 'arcade') { await b.click(); break; }
  }
  await A.waitForSelector('.game', { timeout: 20000 });
  await B.waitForSelector('.game', { timeout: 20000 });
  await (await A.$$('.game'))[0].click();
  await A.waitForSelector('.pad', { timeout: 15000 });
  await B.waitForSelector('.pad', { timeout: 15000 });
  console.log('   both in reaction duel ✔');
  await A.screenshot({ path: 'scripts/act-3-arcade-host.png' });
  await B.screenshot({ path: 'scripts/act-4-arcade-guest.png' });

  console.log('\n=== RESULT ===');
  const clean = errs.filter((e) => !e.includes('favicon') && !e.includes('404'));
  if (clean.length) { console.log('ERRORS:'); clean.slice(0, 15).forEach((e) => console.log('  - ' + e)); process.exitCode = 1; }
  else console.log('activities flow complete, no page errors ✔');
} catch (e) {
  console.log('\n✖ ACTIVITIES SMOKE FAILED: ' + e.message);
  errs.slice(0, 15).forEach((er) => console.log('  - ' + er));
  process.exitCode = 1;
} finally {
  await browserA?.close().catch(() => {});
  await browserB?.close().catch(() => {});
}
