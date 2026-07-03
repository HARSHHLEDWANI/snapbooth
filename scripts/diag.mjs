import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', protocolTimeout: 120000, args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--enable-unsafe-swiftshader','--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
page.on('console', (m) => console.log('[console:' + m.type() + ']', m.text().slice(0, 300)));
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r)=>setTimeout(r,1500));
const clickByText = async (text) => { for (const b of await page.$$('button')) { const t = (await page.evaluate((el) => el.textContent, b)) || ''; if (t.toLowerCase().includes(text)) { await b.click(); return true; } } return false; };
await clickByText('skip');
await new Promise((r)=>setTimeout(r,300));
await clickByText('enter the booth');
await page.waitForSelector('.deck', { timeout: 30000 });
await new Promise((r)=>setTimeout(r,5000));
const info = await page.evaluate(() => {
  const stage = document.querySelector('.stage3d');
  const canvases = stage ? stage.querySelectorAll('canvas') : [];
  const v = document.querySelector('video');
  return {
    stageExists: !!stage,
    canvasCount: canvases.length,
    canvasSizes: Array.from(canvases).map((c) => c.width + 'x' + c.height),
    videoReady: Array.from(document.querySelectorAll('video')).map((x) => x.readyState),
  };
});
console.log('INFO', JSON.stringify(info));
await page.screenshot({ path: 'scripts/diag-capture.png' });
await browser.close();
