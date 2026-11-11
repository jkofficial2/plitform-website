import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { load } from 'cheerio';
import assert from 'node:assert/strict';

const live = process.argv.includes('--live');
const root = resolve(live ? '.qa-live/dist' : 'dist');
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(resolve(dir, entry.name)) : resolve(dir, entry.name)))).flat();
}
const files = await walk(root);
const htmlFiles = files.filter(path => extname(path) === '.html');
const titles = new Set();
const descriptions = new Set();
const headings = new Set();
const pages = [];
let localReferences = 0;
for (const file of htmlFiles) {
  const $ = load(await readFile(file, 'utf8'));
  const path = '/' + relative(root, file).replace(/index\.html$/, '');
  const is404 = path === '/404.html';
  const title = $('title').text().trim();
  const description = $('meta[name="description"]').attr('content');
  const h1 = $('h1').text().trim();
  assert.equal($('html').attr('lang'), 'ru', path);
  assert.equal($('meta[name="viewport"]').length, 1, path);
  assert.equal($('h1').length, 1, path);
  assert.ok(title && !titles.has(title), `Missing or duplicate title: ${path}`);
  assert.ok(description && !descriptions.has(description), `Missing or duplicate description: ${path}`);
  assert.ok(h1 && !headings.has(h1), `Missing or duplicate H1: ${path}`);
  titles.add(title); descriptions.add(description); headings.add(h1);
  for (const tag of ['header', 'nav', 'main', 'footer']) assert.ok($(tag).length, `${tag}: ${path}`);
  assert.ok($('meta[property="og:title"]').attr('content'), path);
  assert.ok($('meta[property="og:image"]').attr('content'), path);
  if (!live || is404) {
    assert.match($('meta[name="robots"]').attr('content') || '', /noindex/, path);
    assert.equal($('link[rel="canonical"]').length, 0, path);
  } else {
    assert.equal($('meta[name="robots"]').length, 0, path);
    assert.equal($('link[rel="canonical"]').attr('href'), `https://plitform-qa.ru${path}`, path);
    assert.ok($('script[type="application/ld+json"]').length, path);
  }
  const ids = $('[id]').toArray().map(node => $(node).attr('id'));
  assert.equal(new Set(ids).size, ids.length, `Duplicate IDs: ${path}`);
  for (const img of $('img').toArray()) {
    assert.ok($(img).attr('width') && $(img).attr('height'), `Missing image dimensions: ${path}`);
    assert.notEqual($(img).attr('alt'), undefined, `Missing alt: ${path}`);
    assert.ok($(img).attr('srcset'), `Missing responsive images: ${path}`);
    assert.match($(img).attr('src'), /\.webp$/, path);
  }
  const references = [...$('a[href], link[href], script[src], img[src]').toArray().map(node => $(node).attr('href') || $(node).attr('src')), ...$('img[srcset]').toArray().flatMap(node => $(node).attr('srcset').split(',').map(item => item.trim().split(/\s+/)[0])), $('meta[property="og:image"]').attr('content')];
  for (const ref of references.filter(Boolean)) {
    if (!live) assert.ok(!/^(tel:|mailto:)/.test(ref), `Fake contact action: ${path}`);
    if (/^(mailto:|tel:|data:)/.test(ref)) continue;
    const url = new URL(ref, `https://plitform-qa.ru${path}`);
    if (url.origin !== 'https://plitform-qa.ru') continue;
    let target = resolve(root, '.' + url.pathname);
    const info = await stat(target).catch(() => undefined);
    if (info?.isDirectory()) target = resolve(target, 'index.html');
    assert.ok(await stat(target).catch(() => undefined), `Broken local reference ${ref} on ${path}`);
    if (url.hash && extname(target) === '.html') {
      const targetHtml = target === file ? $ : load(await readFile(target, 'utf8'));
      assert.ok(targetHtml('[id]').toArray().some(node => targetHtml(node).attr('id') === decodeURIComponent(url.hash.slice(1))), `Missing anchor ${ref} on ${path}`);
    }
    localReferences++;
  }
  pages.push({ path, title, description, h1, htmlBytes: (await stat(file)).size });
}
assert.equal(htmlFiles.length, 7, 'Expected six content pages and 404');
const robots = await readFile(resolve(root, 'robots.txt'), 'utf8');
assert.ok(robots.includes('Allow: /'), 'Crawler must be able to read noindex');
if (live) {
  const xml = await readFile(resolve(root, 'sitemap.xml'), 'utf8');
  assert.equal((xml.match(/<loc>/g) || []).length, 6);
  assert.ok(!xml.includes('404') && !xml.includes('.example'));
  assert.ok(robots.includes('Sitemap: https://plitform-qa.ru/sitemap.xml'));
} else {
  assert.ok(!robots.includes('Sitemap:'));
  assert.ok(!files.includes(resolve(root, 'sitemap.xml')), 'Demo must not have a sitemap');
}
const assets = await Promise.all(files.filter(path => /\.(css|js|webp)$/.test(path)).map(async path => ({ path: relative(root, path), bytes: (await stat(path)).size })));
await mkdir('reports', { recursive: true });
await writeFile(`reports/html-${live ? 'live' : 'demo'}.json`, JSON.stringify({ mode: live ? 'live fixture' : 'demo', pages, localReferences, assets }, null, 2));
console.log(`${live ? 'Live fixture' : 'Demo'}: ${pages.length} pages, ${localReferences} local references verified. Unique metadata, static content, images and indexing configuration OK.`);
