import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--enable-unsafe-swiftshader','--no-sandbox'] });
const page = await browser.newPage();
page.on('response', (r) => { if (r.status() === 404) console.log('404:', r.url()); });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r)=>setTimeout(r,2000));
await browser.close();
