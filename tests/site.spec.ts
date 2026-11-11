import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = ['/', '/produktsiya/', '/produktsiya/dorozhnye-plity/', '/produktsiya/plity-perekrytiy/', '/produktsiya/plity-po-spetsifikatsii/', '/kontakty/', '/404.html'];
const widths = [320, 360, 390, 600, 768, 1024, 1440];

for (const width of widths) {
  test(`All pages fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator('h1')).toHaveCount(1);
      const overflow = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      expect(overflow.document, route).toBeLessThanOrEqual(overflow.viewport);
      for (const img of await page.locator('img').all()) {
        await img.scrollIntoViewIfNeeded();
        await expect.poll(() => img.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
      }
    }
  });
}

for (const route of routes) {
  test(`Accessible content and controls: ${route}`, async ({ page }) => {
    await page.goto(route);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  });
}

for (const route of routes) {
  test(`Accessible mobile content and controls: ${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  });
}

test('Static navigation works with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4321/');
  await page.getByRole('navigation', { name: 'Основная навигация', exact: true }).getByRole('link', { name: 'Продукция', exact: true }).click();
  await expect(page).toHaveURL(/\/produktsiya\/$/);
  await page.getByRole('heading', { name: 'Дорожные плиты', exact: true }).getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Дорожные плиты');
  await page.getByRole('link', { name: 'Запросить цену', exact: true }).first().click();
  await expect(page.locator('.noscript-note')).toBeVisible();
  await expect(page.locator('.noscript-note')).toContainText('Для подготовки письма включите JavaScript');
  await expect(page.getByRole('button', { name: 'Подготовить письмо', exact: true })).toBeDisabled();
  await context.close();
});

test('Category flows from product to request, including all three categories', async ({ page }) => {
  for (const [slug, label] of [['dorozhnye-plity', 'Дорожные плиты'], ['plity-perekrytiy', 'Плиты перекрытий'], ['plity-po-spetsifikatsii', 'Плиты по спецификации']]) {
    await page.goto(`/produktsiya/${slug}/`);
    await page.getByRole('link', { name: 'Запросить цену', exact: true }).first().click();
    await expect(page.getByLabel('Вид плит', { exact: true })).toHaveValue(slug);
    await expect(page.getByLabel('Вид плит', { exact: true }).locator('option:checked')).toHaveText(label);
  }
});

test('Invalid category parameters cannot inject content', async ({ page }) => {
  await page.goto('/kontakty/?category=%3Cscript%3Ealert(1)%3C/script%3E#zayavka');
  await expect(page.locator('#product-category')).toHaveValue('');
});

test('Fixed mobile request button preserves the current product category', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const slug of ['dorozhnye-plity', 'plity-perekrytiy', 'plity-po-spetsifikatsii']) {
    await page.goto(`/produktsiya/${slug}/`);
    await page.getByRole('navigation', { name: 'Быстрая связь' }).getByRole('link', { name: 'Запросить цену' }).click();
    await expect(page.locator('#product-category')).toHaveValue(slug);
  }
});

test('Prepared request remains usable and accessible on a 320px screen', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/kontakty/?category=plity-po-spetsifikatsii#zayavka');
  await page.locator('#customer-name').fill('Иван');
  await page.locator('#customer-contact').fill('ivan@example.org');
  await page.locator('#order-description').fill('Нужны плиты по чертежу, 20 штук');
  await page.getByRole('button', { name: 'Подготовить письмо', exact: true }).click();
  await expect(page.locator('#prepared-request')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.getByRole('button', { name: 'Скопировать заявку' }).click();
  await expect(page.locator('#copy-status')).toContainText('Заявка скопирована');
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  expect(result.violations.map(v => v.id)).toEqual([]);
});

test('Form validates blank and invalid contacts; prepares and copies exactly entered data', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/kontakty/?category=dorozhnye-plity#zayavka');
  const submit = page.getByRole('button', { name: 'Подготовить письмо', exact: true });
  await submit.click();
  await expect(page.locator('#name-error')).not.toBeEmpty();
  await expect(page.locator('#contact-error')).not.toBeEmpty();
  await expect(page.locator('#order-error')).not.toBeEmpty();
  await expect(page.locator('#customer-name')).toBeFocused();
  await page.locator('#customer-name').fill('Иван Петров');
  await page.locator('#customer-contact').fill('не телефон');
  await page.locator('#order-description').fill('20 плит, размеры нужно уточнить. Текст: <b>без HTML</b> & ещё');
  await submit.click();
  await expect(page.locator('#customer-contact')).toBeFocused();
  await expect(page.locator('#customer-contact')).toHaveAttribute('aria-invalid', 'true');
  await page.locator('#customer-contact').fill('+7 (863) 200-12-34');
  await page.locator('#delivery-city').fill('Ростов-на-Дону');
  await page.locator('#order-comment').fill('Желательно в декабре');
  await submit.click();
  await expect(page.locator('#prepared-request')).toBeVisible();
  await expect(page.locator('#request-text')).toHaveValue(/Вид плит: Дорожные плиты/);
  await expect(page.locator('#request-text')).toHaveValue(/<b>без HTML<\/b> & ещё/);
  await expect(page.locator('#request-text')).toHaveValue(/Город доставки: Ростов-на-Дону/);
  await expect(page.getByRole('link', { name: 'Открыть в почте' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Скопировать заявку' }).click();
  await expect(page.locator('#copy-status')).toContainText('Заявка скопирована');
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain('Тема: Запрос цены на бетонные плиты');
  expect(clipboard).toContain(await page.locator('#request-text').inputValue());
  await page.locator('#order-comment').fill('Заказ изменён');
  await expect(page.locator('#prepared-request')).toBeHidden();
});

test('Unknown product name can be entered as free text and email contact is accepted', async ({ page }) => {
  await page.goto('/kontakty/#zayavka');
  await page.locator('#customer-name').fill('Анна');
  await page.locator('#customer-contact').fill('anna@example.org');
  await page.locator('#order-description').fill('Нужны плиты для площадки, вид и размеры не знаю');
  await page.getByRole('button', { name: 'Подготовить письмо', exact: true }).click();
  await expect(page.locator('#prepared-request')).toBeVisible();
  await expect(page.locator('#request-text')).toHaveValue(/Вид плит: Указан в описании заказа/);
});

test('Clipboard denial offers selectable text and honest feedback', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('Denied')) } }));
  await page.goto('/kontakty/');
  await page.locator('#customer-name').fill('Анна');
  await page.locator('#customer-contact').fill('anna@example.org');
  await page.locator('#order-description').fill('10 плит по проекту');
  await page.getByRole('button', { name: 'Подготовить письмо', exact: true }).click();
  await page.getByRole('button', { name: 'Скопировать заявку' }).click();
  await expect(page.locator('#copy-status')).toContainText('Автоматическое копирование недоступно');
  await expect(page.locator('#request-text')).toBeFocused();
  expect(await page.locator('#request-text').evaluate((n: HTMLTextAreaElement) => n.selectionEnd - n.selectionStart)).toBeGreaterThan(50);
});

test('Demo contacts are explained and have no dial or mail actions', async ({ page }) => {
  await page.goto('/kontakty/');
  await expect(page.locator('a[href^="tel:"], a[href^="mailto:"]')).toHaveCount(0);
  await expect(page.locator('#kontakty-zavoda')).toContainText('Рабочий телефон появится');
  await expect(page.locator('#kontakty-zavoda')).toContainText('Рабочая почта появится');
});

test('Keyboard skip link and form work without a mouse', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Перейти к содержимому' })).toBeFocused();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('main');
  await page.goto('/kontakty/');
  await page.locator('#customer-name').focus();
  await page.keyboard.type('Ivan');
  await page.keyboard.press('Tab');
  await page.keyboard.type('ivan@example.org');
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');
  await page.keyboard.type('20 concrete slabs');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Rostov');
  await page.keyboard.press('Tab');
  await page.keyboard.type('In December');
  await page.keyboard.press('Tab');
  await expect(page.locator('#prepare-button')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#prepared-heading')).toBeFocused();
});

test('Readable layout at 200% text size and 320px reflow', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 });
  for (const route of routes) {
    await page.goto(route);
    await page.evaluate(() => { document.documentElement.style.fontSize = `${parseFloat(getComputedStyle(document.documentElement).fontSize) * 2}px`; });
    const size = await page.evaluate(() => ({ actual: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(size.actual, route).toBeLessThanOrEqual(size.viewport);
  }
});

test('Mobile actions remain visible and large enough', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('footer').scrollIntoViewIfNeeded();
  const buttons = page.getByRole('navigation', { name: 'Быстрая связь' }).getByRole('link');
  await expect(buttons).toHaveCount(2);
  for (const button of await buttons.all()) {
    await expect(button).toBeInViewport();
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  }
});

test('No browser exceptions, failed local resources, or broken page routes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', request => errors.push(request.url()));
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response!.status()).toBe(200);
  }
  const missing = await page.goto('/this-page-does-not-exist/');
  expect(missing!.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('страницы');
  expect(errors).toEqual([]);
});

test('Working configuration: tel and encoded mailto match the visible request', async ({ page }) => {
  await page.goto('http://127.0.0.1:4322/kontakty/?category=plity-perekrytiy#zayavka');
  await expect(page.locator('.header-phone a')).toHaveAttribute('href', 'tel:+78632001234');
  await expect(page.locator('#kontakty-zavoda a[href^="mailto:"]')).toHaveAttribute('href', 'mailto:sales@plitform-qa.ru');
  await page.locator('#customer-name').fill('Иван & Анна');
  await page.locator('#customer-contact').fill('ivan+test@example.org');
  await page.locator('#order-description').fill('30 плит, размеры 6 × 1,2 м? Нужно уточнить #проект');
  await page.getByRole('button', { name: 'Подготовить письмо', exact: true }).click();
  const href = await page.locator('#open-email').getAttribute('href');
  const url = new URL(href!);
  expect(url.pathname).toBe('sales@plitform-qa.ru');
  expect(url.searchParams.get('subject')).toBe('Запрос цены на бетонные плиты');
  expect(url.searchParams.get('body')).toBe(await page.locator('#request-text').inputValue());
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://plitform-qa.ru/kontakty/');
});

test('Working sitemap and structured data agree with the visible pages', async ({ request, page }) => {
  const sitemap = await request.get('http://127.0.0.1:4322/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml.match(/<loc>/g)).toHaveLength(6);
  expect(xml).not.toContain('404');
  expect(xml).not.toContain('.example');
  expect(await (await request.get('http://127.0.0.1:4322/robots.txt')).text()).toContain('Sitemap: https://plitform-qa.ru/sitemap.xml');
  await page.goto('http://127.0.0.1:4322/produktsiya/dorozhnye-plity/');
  const structured = await page.locator('script[type="application/ld+json"]').allTextContents();
  const organization = structured.map(s => JSON.parse(s)).find(s => s['@type'] === 'Organization');
  const breadcrumbs = structured.map(s => JSON.parse(s)).find(s => s['@type'] === 'BreadcrumbList');
  expect(organization.telephone).toBe('+7 (863) 200-12-34');
  expect(breadcrumbs.itemListElement.map((i: { name: string }) => i.name)).toEqual(['Главная', 'Продукция', 'Дорожные плиты']);
  expect(breadcrumbs.itemListElement[2].item).toBe('https://plitform-qa.ru/produktsiya/dorozhnye-plity/');
});
