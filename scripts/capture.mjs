import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

let server;
let browser;
const origin = 'http://127.0.0.1:4323';
try {
  try { await fetch(origin); }
  catch {
    server = spawn(process.execPath, ['scripts/serve.mjs', '--port', '4323'], { stdio: 'ignore' });
    for (let n = 0; n < 40; n++) {
      try { if ((await fetch(origin)).ok) break; } catch { /* Server is starting. */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  await mkdir('reports/screenshots', { recursive: true });
  browser = await chromium.launch({ channel: 'chrome' });
  console.log(`Chrome ${browser.version()}`);
  const page = await browser.newPage();
  for (const [name, path, width, height] of [['home-desktop', '/', 1440, 1000], ['home-mobile', '/', 390, 844], ['catalog-desktop', '/produktsiya/', 1440, 1000], ['product-mobile', '/produktsiya/plity-po-spetsifikatsii/', 320, 850], ['contacts-desktop', '/kontakty/', 1440, 1000], ['contacts-mobile', '/kontakty/', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${origin}${path}`);
    // Bring lazy images into view before capturing a complete page.
    for (const img of await page.locator('img').all()) { await img.scrollIntoViewIfNeeded(); await img.evaluate(node => node.decode()); }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: `reports/screenshots/${name}.png`, fullPage: true });
    if (name.startsWith('home-')) await page.screenshot({ path: `reports/screenshots/${name}-first-screen.png` });
  }
  if (process.argv.includes('--inspect')) {
    for (const route of ['/', '/produktsiya/', '/produktsiya/plity-po-spetsifikatsii/', '/kontakty/']) {
      await page.setViewportSize({ width: 640, height: 900 });
      await page.goto(`${origin}${route}`);
      await page.evaluate(() => { document.documentElement.style.fontSize = '36px'; });
      console.log(JSON.stringify({ route, overflow: await page.evaluate(() => [...document.querySelectorAll('body *')].filter(node => { const box = node.getBoundingClientRect(); return box.width > 0 && (box.right > innerWidth + 1 || box.left < -1); }).map(node => ({ tag: node.tagName, class: node.className, width: node.getBoundingClientRect().width, right: node.getBoundingClientRect().right, text: node.textContent.slice(0, 90) }))) }));
    }
  }
  console.log('Screenshots saved in reports/screenshots/');
} finally { await browser?.close(); server?.kill(); }
