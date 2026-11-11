import { readFile, writeFile } from 'node:fs/promises';
import { load } from 'cheerio';

const json = async path => JSON.parse(await readFile(path, 'utf8'));
const [lighthouse, browser, demo, live, dependencies, packageJson] = await Promise.all([
  json('reports/lighthouse-summary.json'), json('reports/browser-tests.json'),
  json('reports/html-demo.json'), json('reports/html-live.json'),
  json('reports/dependencies.json'), json('package.json'),
]);
const representative = await json('reports/lighthouse-live-home.report.json');
const contact = load(await readFile('dist/kontakty/index.html', 'utf8'));
const home = load(await readFile('dist/index.html', 'utf8'));
const seconds = n => (n / 1000).toFixed(2);
const names = { home: 'Главная', catalog: 'Каталог', road: 'Дорожные плиты', floor: 'Плиты перекрытий', custom: 'По спецификации', contacts: 'Контакты' };
const liveRows = lighthouse.filter(result => result.mode === 'live').map(result => `| ${names[result.slug]} | ${result.scores.performance} | ${result.scores.accessibility} | ${result.scores['best-practices']} | ${result.scores.seo} | ${seconds(result.metrics['largest-contentful-paint'])} с | ${result.metrics['total-blocking-time']} мс | ${result.metrics['cumulative-layout-shift']} |`);
const demoResult = lighthouse.find(result => result.mode === 'demo');
const cssBytes = demo.assets.filter(asset => asset.path.endsWith('.css')).reduce((sum, asset) => sum + asset.bytes, 0);
const chrome = representative.environment.hostUserAgent.match(/(?:Chrome|HeadlessChrome)\/([\d.]+)/)?.[1] || representative.userAgent;
const settings = representative.configSettings;
const report = `# Проверка сайта «ПлитФорм»

Проверка выполнена 11 ноября 2026 года локально, до публикации. Все показатели ниже измерены инструментами, а не рассчитаны по предположениям.

## Результат

- Astro и TypeScript: 0 ошибок, 0 предупреждений, 0 замечаний.
- Статическая сборка демо и отдельной рабочей конфигурации завершена успешно.
- Chrome / Playwright: **${browser.stats.expected} тестов пройдено**, ошибок ${browser.stats.unexpected}, нестабильных тестов ${browser.stats.flaky}, пропусков ${browser.stats.skipped}. Время последнего прогона ${(browser.stats.duration / 1000).toFixed(1)} с.
- Проверено ${demo.localReferences} локальных ссылок/ресурсов в демо и ${live.localReferences} в рабочей конфигурации, включая якоря.
- npm audit: **${dependencies.metadata.vulnerabilities.total} уязвимостей**.

## Мобильный Lighthouse

Chrome ${chrome}, Lighthouse ${representative.lighthouseVersion}, Astro ${packageJson.dependencies.astro}, Node.js ${process.version}. Профиль: ${settings.formFactor}, viewport ${settings.screenEmulation.width} × ${settings.screenEmulation.height}, моделирование сети ${settings.throttlingMethod}, CPU slowdown ×${settings.throttling.cpuSlowdownMultiplier}. Адреса локальные, на 127.0.0.1. В рабочей конфигурации использован синтетический проверочный домен, исходные демонстрационные реквизиты не изменены.

| Страница рабочего режима | Скорость | Доступность | Лучшие практики | SEO | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${liveRows.join('\n')}

Главная в **деморежиме**: скорость ${demoResult.scores.performance}, доступность ${demoResult.scores.accessibility}, лучшие практики ${demoResult.scores['best-practices']}, SEO ${demoResult.scores.seo}. SEO снижен из-за намеренного запрета индексирования через \`noindex\`. Убирать его до заполнения реальных реквизитов не следует.

Это лабораторные измерения. INP и полевые Core Web Vitals потребуют реальных посещений после публикации. TBT не заменяет INP. Соответствие техническим требованиям и SEO 100 не гарантируют индексацию или позиции в выдаче. Источники: [Google Search — технические требования](https://developers.google.com/search/docs/essentials/technical), [Google — noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing), [Web Vitals](https://web.dev/articles/vitals).

Полные результаты по каждой странице находятся в [lighthouse-summary.json](lighthouse-summary.json). Интерактивные HTML-отчёты доступны локально: [демо](lighthouse-demo-home.report.html), [главная](lighthouse-live-home.report.html), [каталог](lighthouse-live-catalog.report.html), [дорожные плиты](lighthouse-live-road.report.html), [перекрытия](lighthouse-live-floor.report.html), [по спецификации](lighthouse-live-custom.report.html), [контакты](lighthouse-live-contacts.report.html). Тяжёлые HTML/JSON-отчёты Lighthouse и скриншоты исключены из Git; их можно заново получить командами из README.

Оставшиеся рекомендации Lighthouse по скорости относятся к задержке локального сервера, сжатию HTML, внешнему CSS и небольшой экономии изображения. Итоговый хостинг должен включать HTTPS, сжатие и кеширование файлов с хешами. После размещения следует повторить аудит на реальном домене.

## Страницы и техническое SEO

| URL | Готово |
| --- | --- |
| \`/\` | Главная, три направления, как заказать, подготовка к расчёту, контакты |
| \`/produktsiya/\` | Каталог с изображениями и переходами |
| \`/produktsiya/dorozhnye-plity/\` | Применение, справочные характеристики, данные для заявки |
| \`/produktsiya/plity-perekrytiy/\` | Применение, справочные характеристики, данные для заявки |
| \`/produktsiya/plity-po-spetsifikatsii/\` | Применение, справочные характеристики, данные для заявки |
| \`/kontakty/\` | Контакты и подготовка письма |
| \`/404.html\` | Отдельная страница ошибки с noindex |

На всех страницах проверены уникальные title, description и H1, \`lang="ru"\`, viewport, статический основной текст, семантические области страницы и обычные ссылки. Названия категорий и регион включены в естественные заголовки и описания. Есть Open Graph, favicon и хлебные крошки.

В демо нет canonical, sitemap или JSON-LD предприятия. Robots разрешает обход, чтобы поисковик мог увидеть noindex. В рабочей сборке проверены абсолютные canonical, шесть корректных URL в sitemap, ссылка на sitemap в robots, Organization и BreadcrumbList. 404 исключена из sitemap и всегда закрыта от индексирования. Неизвестный URL проверочного сервера отдаёт страницу ошибки со статусом HTTP 404.

## Адаптивность и доступность

- Все семь страниц проверены на ширинах **320, 360, 390, 600, 768, 1024 и 1440 px**: 49 сочетаний страницы и ширины. Горизонтальная прокрутка отсутствует, изображения загружаются.
- Все страницы проверены при увеличении текста до **200%** в viewport 640 px, без горизонтальной прокрутки.
- Axe проверяет все страницы на десктопе и телефоне: WCAG 2 A/AA, 2.1 A/AA, 2.2 AA и best practices. Нарушений в этих автоматических проверках не найдено; это не сертификат полной доступности.
- Пройдены навигация клавиатурой, ссылка пропуска шапки, фокус на первой ошибке и переход фокуса к подготовленному письму.
- На телефоне быстрые действия остаются в видимой области; высота кнопок не меньше 48 px.
- Проверены навигация без JavaScript, объяснение для подготовки письма и неактивная кнопка подготовки без JS.
- Вручную просмотрены контрольные скриншоты главной, каталога, категории и контактов на широком и узком экране.

Скриншоты: [главная — десктоп](screenshots/home-desktop.png), [главная — телефон](screenshots/home-mobile.png), [каталог](screenshots/catalog-desktop.png), [категория на 320 px](screenshots/product-mobile.png), [контакты — десктоп](screenshots/contacts-desktop.png), [контакты — телефон](screenshots/contacts-mobile.png).

## Форма и контакты

Проверены пустые обязательные поля, неверный контакт, телефон и email, свободное описание неизвестного вида плит, подстановка всех трёх категорий из страницы и из фиксированной мобильной кнопки. Неизвестный параметр категории игнорируется. Спецсимволы остаются текстом и не превращаются в HTML.

Письмо подготавливается и копируется целиком, с темой. Отдельно проверены запрет Clipboard API с ручным выделением и скрытие старого предпросмотра после изменения формы. Готовая заявка проверена на 320 px вместе с копированием и axe.

В демо нет активных tel/mailto. В тестовом рабочем режиме телефон и почта совпадают с видимыми реквизитами; тема и тело mailto после декодирования точно совпадают с текстом формы. Реальный звонок и почтовое приложение не запускались, письма не отправлялись.

## Исправлено при проверках

- Переполнение длинного заголовка категории на 320 px; дополнительно подобран размер для чтения без некрасивого разрыва слова.
- Переполнение подвала при увеличении текста до 200%.
- Перевод фокуса в содержимое по ссылке пропуска шапки.
- Размещение пометки деморежима в семантической области шапки.
- Сохранение категории при переходе через фиксированную мобильную кнопку заявки.
- Несовпадение видимого текста логотипа и его доступного имени, обнаруженное дополнительной проверкой Lighthouse.
- Уязвимые зависимости заменены актуальными исправленными версиями; повторный npm audit — 0.

## Объём и ограничения

Общий минимизированный CSS: **${cssBytes.toLocaleString('ru-RU')} байт** без сжатия. Клиентский модуль контактов: **${Buffer.byteLength(contact('script[type="module"]').text()).toLocaleString('ru-RU')} байт**. На главной клиентских модулей **${home('script[type="module"]').length}**. Изображения выводятся в адаптивном WebP с заданными размерами; нижние загружаются отложенно. Нет внешних шрифтов и аналитики.

Сайт не опубликован. Перед публикацией нужны подтверждённые название и регион, телефон, email, домен, данные продукции, документы и фотографии; адрес и часы показываются только при наличии. После заполнения следует выключить деморежим и проверить фактический домен, HTTPS и ответы сервера. Затем подключить Search Console и передать sitemap.

Исходный запрос на заявку не отправляется и не сохраняется сайтом. У почтового приложения есть собственные ограничения на длину mailto; поэтому всегда доступно копирование и ручная отправка. Реальная индексация, позиции в Google, время ответа опубликованного сервера и полевые Core Web Vitals до публикации не проверялись.

## Повторение

\`\`\`sh
npm ci
npm test
npm run audit:lighthouse
npm audit --json > reports/dependencies.json
node scripts/capture.mjs
node scripts/write-report.mjs
\`\`\`

Нужны Node.js из .nvmrc и установленный Chrome. В ограниченной среде к командам Astro можно добавить ASTRO_TELEMETRY_DISABLED=1. Подробности: [README](../README.md). Машинные результаты: [Playwright](browser-tests.json), [демо-HTML](html-demo.json), [рабочий HTML](html-live.json), [зависимости](dependencies.json).
`;
await writeFile('reports/verification.md', report);
console.log('Verification report written to reports/verification.md');
