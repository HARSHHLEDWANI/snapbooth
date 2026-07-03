import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false,
  protocolTimeout: 60000,
  args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--no-sandbox','--window-size=1100,800','--window-position=40,40','--mute-audio',`--user-data-dir=${process.env.TEMP}\\sb-diag-${Date.now()}`,'--no-first-run','--no-default-browser-check'],
});
const page = (await browser.pages())[0];
await page.setViewport({ width: 1080, height: 760 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 200)); });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
// wait for hydration: styled-jsx applies absolute positioning once React is live
await page.waitForFunction(() => {
  const el = document.querySelector('.landing');
  return el && getComputedStyle(el).position === 'absolute';
}, { timeout: 60000 });
await new Promise((r)=>setTimeout(r,800));
const clickByText = async (text) => { for (const b of await page.$$('button')) { const t = (await page.evaluate((el) => el.textContent, b)) || ''; if (t.toLowerCase().includes(text)) { await b.click(); return true; } } return false; };
await clickByText('skip');
await new Promise((r)=>setTimeout(r,300));
await page.screenshot({ path: 'scripts/headed-1-landing.png' });
await clickByText('enter the booth');
await page.waitForSelector('.deck', { timeout: 30000 });
// responsiveness probe: evaluate every 2s for 20s
for (let i = 1; i <= 10; i++) {
  await new Promise((r)=>setTimeout(r,2000));
  const t0 = Date.now();
  const info = await page.evaluate(() => ({
    video: Array.from(document.querySelectorAll('video')).map((v) => v.readyState),
    fps: true,
  }));
  console.log(`probe ${i}: ${Date.now()-t0}ms, videoReady=${info.video.join(',')}`);
}
await page.screenshot({ path: 'scripts/headed-2-capture.png' });
// take a real single snap
const arrows = await page.$$('button[aria-label="next mode"]');
if (arrows[0]) await arrows[0].click();
const snapBtns = await page.$$('button[aria-label*="take photos"]');
await snapBtns[0].click();
console.log('snapped, waiting for edit…');
await page.waitForSelector('.strip-canvas', { timeout: 40000 });
await new Promise((r)=>setTimeout(r,2000));
await page.screenshot({ path: 'scripts/headed-3-edit.png' });
console.log('EDIT OK');
await browser.close();
