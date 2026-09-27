const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const assert = require('node:assert/strict');
const base = process.env.CLEARVEST_PREVIEW_URL || 'http://127.0.0.1:5173';
const contract = yaml.load(fs.readFileSync(path.resolve(__dirname, '../../docs/api/openapi.yaml'), 'utf8'));
const output = path.resolve(__dirname, '../node_modules/.cache/clearvest-review');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
    const errors = []; const comparisons = []; const lists = []; const histories = []; const newsRequests = [];
    let newsMode = 'ok'; let brokenHistory = '';
    await context.route('https://images.financialmodelingprep.com/symbol/**', route => {
      const symbol = new URL(route.request().url()).pathname.split('/').pop().replace('.png', '');
      if (symbol === 'INTC') return route.abort();
      return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><rect width="36" height="36" rx="5" fill="#edf3ff"/><text x="18" y="24" text-anchor="middle" font-family="Arial" font-size="20" fill="#2457c5">${symbol[0]}</text></svg>` });
    });
    let mode = 'ok'; let marketMode = 'ok';
    await context.route('http://127.0.0.1:4010/**', async route => {
      const url = new URL(route.request().url());
      let body = structuredClone(contract.paths[url.pathname]?.get?.responses?.['200']?.content?.['application/json']?.example ?? {});
      let status = 200;
      if (url.pathname === '/profile') { status = 404; body = { error: { code: 'NOT_FOUND', message: 'No profile' } }; }
      if (url.pathname === '/market/history') {
        histories.push(url.searchParams.get('symbols'));
        body = { ...body, series: [{ ...body.series[0], symbol: url.searchParams.get('symbols') }] };
        if (url.searchParams.get('symbols') === brokenHistory) { status = 502; body = { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Unavailable' } }; }
      }
      if (url.pathname === '/market/news') {
        const symbols = url.searchParams.get('symbols')?.split(',') || [];
        newsRequests.push(symbols.join(',')); body.symbols = symbols;
        body.articles = body.articles.map((article, index) => ({ ...article, symbol: symbols[index % symbols.length] || article.symbol }));
        if (newsMode === 'error') { status = 502; body = { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Unavailable' } }; }
        if (newsMode === 'empty' && symbols.length) body.articles = [];
        if (newsMode === 'stale') body.stale = true;
      }
      if (url.pathname === '/market/movers') {
        const category = url.searchParams.get('category'); lists.push(category); body.category = category;
        if (category === 'gainers') body.stocks = body.stocks.filter(stock => stock.changePct > 0).sort((a, b) => b.changePct - a.changePct);
        if (category === 'losers') body.stocks = body.stocks.filter(stock => stock.changePct < 0).sort((a, b) => a.changePct - b.changePct);
        if (marketMode === 'error' && category === 'gainers') { status = 502; body = { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Unavailable' } }; }
        if (marketMode === 'stale') body.stale = true;
        if (marketMode === 'empty') body.stocks = [];
      }
      if (url.pathname === '/market/compare-companies') {
        comparisons.push(url.searchParams.get('symbols'));
        if (mode === 'slow') await new Promise(resolve => setTimeout(resolve, 900));
        if (mode === 'error') { status = 502; body = { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Unavailable' } }; }
        else if (mode === 'empty') body = { companies: [], notes: 'No company data' };
        else {
          const examples = body.companies;
          body.companies = url.searchParams.get('symbols').split(',').map((symbol, index) => ({ ...examples[index % examples.length], symbol }));
          body.stale = mode === 'stale';
          if (mode === 'missing') body.companies[0].pe = null;
          if (mode === 'negative') body.companies[0].revenueGrowth = -0.1;
        }
      }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/markets');
    // Trading activity is collapsed below research until opened (DESIGN.md §4.9).
    const openActivity = () => page.getByText('Market activity: most active, gainers and losers', { exact: true }).click();
    assert.equal(await page.getByRole('region', { name: 'Top 10 most active', exact: true }).count(), 0, 'Board stays unmounted until opened');
    await openActivity();
    const active = page.getByRole('region', { name: 'Top 10 most active', exact: true });
    await active.getByRole('button', { name: 'Research MSFT', exact: true }).waitFor();
    assert.equal(await active.locator('ol > li').count(), 10);
    assert.deepEqual(new Set(lists), new Set(['active', 'gainers']));
    assert.equal(comparisons.length, 0);
    await page.getByRole('group', { name: 'VOO interactive price chart' }).waitFor();
    await active.getByRole('button', { name: 'Research NVDA', exact: true }).click();
    await page.getByRole('group', { name: 'NVDA interactive price chart' }).waitFor();
    const scroller = active.getByRole('region', { name: 'Scrollable top 10 most active' });
    assert.equal(await scroller.evaluate(el => el.clientHeight), 300, 'Exactly five 60px rows fit');
    assert(await scroller.evaluate(el => el.scrollHeight > el.clientHeight));
    await scroller.focus(); await page.keyboard.press('End');
    await active.getByRole('button', { name: 'Research MSFT', exact: true }).scrollIntoViewIfNeeded();
    assert(await scroller.evaluate(el => el.scrollTop > 0), 'Remaining stocks scroll within the widget');
    await scroller.evaluate(el => { el.scrollTop = 0; });
    await active.getByRole('img', { name: 'NVDA logo', exact: true }).waitFor();
    await active.getByRole('img', { name: 'INTC logo unavailable', exact: true }).waitFor();
    const gainers = page.getByRole('region', { name: 'Top gainers', exact: true });
    await page.getByRole('button', { name: 'Top losers', exact: true }).click();
    await page.getByRole('region', { name: 'Top losers', exact: true }).getByRole('button', { name: 'Research INTC', exact: true }).waitFor();
    assert.equal(await gainers.count(), 0, 'Movers share one panel');
    await page.getByRole('button', { name: 'Top gainers', exact: true }).click();
    await gainers.waitFor();
    const news = page.getByRole('region', { name: 'Market news', exact: true });
    await news.getByRole('article').first().waitFor();
    assert(newsRequests.includes('NVDA'));
    await Promise.all([page.waitForResponse(response => response.url().endsWith('/market/news')), news.getByRole('button', { name: 'Market-wide', exact: true }).click()]);
    await news.getByRole('link').first().waitFor();
    assert.equal(await news.getByRole('link').first().getAttribute('target'), '_blank');
    await news.getByRole('button', { name: 'Related news', exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, 'markets-overview-desktop.png'), fullPage: true });

    const openCompare = page.getByRole('button', { name: 'Compare securities', exact: true });
    await openCompare.click();
    const dialog = page.getByRole('dialog', { name: 'Compare securities' });
    const left = dialog.getByRole('region', { name: 'First security', exact: true });
    const right = dialog.getByRole('region', { name: 'Second security', exact: true });
    await left.getByRole('group', { name: 'NVDA interactive price chart' }).waitFor();
    await right.getByText('Enter a ticker above to load its chart and key figures.').waitFor();
    assert(!histories.includes(''), 'An empty second chart never requests a ticker');
    await right.getByRole('textbox', { name: 'Research a ticker symbol' }).fill('AAPL');
    await right.getByRole('button', { name: 'Research symbol', exact: true }).click();
    await right.getByRole('group', { name: 'AAPL interactive price chart' }).waitFor();
    await left.getByRole('textbox', { name: 'Research a ticker symbol' }).fill('MSFT');
    await left.getByRole('button', { name: 'Research symbol', exact: true }).click();
    await left.getByRole('group', { name: 'MSFT interactive price chart' }).waitFor();
    assert.equal(await right.getByRole('textbox').inputValue(), 'AAPL', 'Chart searches are independent');
    await right.getByRole('button', { name: '5Y', exact: true }).click();
    assert.equal(await left.getByRole('button', { name: '1Y', exact: true }).getAttribute('aria-pressed'), 'true');
    await right.getByRole('button', { name: 'View as table', exact: true }).click();
    await right.getByRole('table', { name: 'AAPL closing prices' }).waitFor();
    await right.getByRole('button', { name: 'View chart', exact: true }).click();
    brokenHistory = 'FAIL';
    await right.getByRole('textbox').fill('FAIL'); await right.getByRole('button', { name: 'Research symbol', exact: true }).click();
    await right.getByRole('button', { name: 'Retry', exact: true }).waitFor();
    await left.getByRole('group', { name: 'MSFT interactive price chart' }).waitFor();
    brokenHistory = ''; await right.getByRole('button', { name: 'Retry', exact: true }).click();
    await right.getByRole('group', { name: 'FAIL interactive price chart' }).waitFor();
    await right.getByRole('textbox').fill('AAPL'); await right.getByRole('button', { name: 'Research symbol', exact: true }).click();
    await dialog.getByRole('region', { name: 'Market news', exact: true }).getByText('The latest headlines connected to MSFT and AAPL.').waitFor();
    await dialog.screenshot({ path: path.join(output, 'research-compare-desktop.png') });
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), `Dialog overflow at ${width}`);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await left.locator('..').evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    assert(await openCompare.evaluate(el => el === document.activeElement), 'Escape returns focus');
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    await openCompare.click();
    await dialog.getByRole('button', { name: 'Exit comparison', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overview overflow at ${width}`);
      if (width === 390) await page.screenshot({ path: path.join(output, 'markets-overview-mobile.png'), fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
    await active.getByRole('button', { name: 'Compare NVDA', exact: true }).click();
    const comparison = page.getByRole('region', { name: 'Put companies in perspective' });
    await comparison.getByRole('button', { name: 'Remove NVDA' }).waitFor();
    assert.equal(comparisons.length, 0, 'Adding a company is not a provider call');
    const input = comparison.getByRole('textbox', { name: 'Add company tickers' });
    const add = comparison.getByRole('button', { name: 'Add company', exact: true });
    const compare = comparison.getByRole('button', { name: 'Compare companies', exact: true });
    await comparison.locator('summary').filter({ hasText: /^Download$/ }).click();
    assert(await comparison.getByRole('button', { name: 'Download CSV', exact: true }).isDisabled());
    await page.keyboard.press('Escape');
    await compare.click(); await comparison.getByRole('alert').waitFor();
    for (const invalid of ['nvda', 'bad ticker', 'A,B,C,D']) {
      await input.fill(invalid); await add.click(); await comparison.getByRole('alert').waitFor();
      assert.equal(comparisons.length, 0);
    }
    await comparison.getByRole('button', { name: 'Remove NVDA' }).click();
    mode = 'slow'; await comparison.getByRole('button', { name: 'Semiconductors AMD + NVDA' }).click();
    await comparison.getByRole('status', { name: 'Loading company comparison' }).waitFor();
    await comparison.getByRole('heading', { name: 'AMD vs NVDA', exact: true }).waitFor();
    await comparison.getByRole('article', { name: 'Price / earnings' }).getByText('95.1×', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, 'comparison-visual-desktop.png'), fullPage: true });
    await comparison.getByRole('button', { name: 'Growth & profitability', exact: true }).click();
    await comparison.getByRole('article', { name: 'Gross margin' }).getByText('53.2%', { exact: true }).waitFor();
    await comparison.getByRole('article', { name: 'Earnings per share' }).getByText('1.90', { exact: true }).waitFor();
    await comparison.getByRole('button', { name: 'Financial strength', exact: true }).click();
    await comparison.getByRole('article', { name: 'Debt / equity' }).getByText('0.06×', { exact: true }).waitFor();
    await comparison.getByRole('button', { name: 'Data table', exact: true }).click();
    await comparison.getByRole('table', { name: 'Fundamentals for AMD and NVDA' }).waitFor();
    await input.fill('AAPL'); await add.click();
    await comparison.getByText('Your selection has changed. Compare again to update these results.').waitFor();
    for (const format of ['CSV', 'JSON']) {
      await comparison.locator('summary').filter({ hasText: /^Download$/ }).click();
      const [download] = await Promise.all([page.waitForEvent('download'), comparison.getByRole('button', { name: `Download ${format}` }).click()]);
      assert.match(download.suggestedFilename(), /^clearvest-comparison-AMD-NVDA-.*\.(csv|json)$/);
      const file = path.join(output, download.suggestedFilename()); await download.saveAs(file);
      const text = fs.readFileSync(file, 'utf8');
      if (format === 'JSON') { const value = JSON.parse(text); assert.deepEqual(value.companies.map(company => company.symbol), ['AMD', 'NVDA']); assert.equal(value.units.grossMargin, 'fraction'); }
      else assert(text.includes('"Gross margin","fraction",0.532,0.75'));
    }
    await input.fill('MSFT'); await add.click(); assert(await input.isDisabled());
    mode = 'missing'; await compare.click();
    await comparison.getByRole('table', { name: 'Fundamentals for AMD and NVDA and AAPL and MSFT' }).waitFor();
    await comparison.getByLabel('Not available from the data provider', { exact: true }).waitFor();
    await comparison.getByRole('button', { name: 'Visual', exact: true }).click();
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Comparison overflow at ${width}`);
      if (width === 390) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(output, 'comparison-visual-mobile.png'), fullPage: true }); }
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.getByRole('button', { name: 'Market overview', exact: true }).click();
    await active.getByRole('button', { name: 'Compare INTC', exact: true }).waitFor();
    assert(await active.getByRole('button', { name: 'Compare INTC', exact: true }).isDisabled(), 'A fifth company cannot be silently added');
    await active.getByRole('button', { name: 'Compare AMD', exact: true }).click();
    await comparison.getByRole('button', { name: 'Remove MSFT' }).waitFor();
    for (const state of ['negative', 'stale', 'empty', 'error']) {
      mode = state; await page.reload(); await comparison.getByRole('button', { name: 'Semiconductors AMD + NVDA' }).click();
      if (state === 'negative') { await comparison.getByRole('button', { name: 'Growth & profitability', exact: true }).click(); await comparison.getByText('−10.0%', { exact: true }).waitFor(); }
      if (state === 'stale') await comparison.getByText('Cached data', { exact: true }).waitFor();
      if (state === 'empty') await comparison.getByText('No company data was returned. Try another pair of tickers.').waitFor();
      if (state === 'error') { await comparison.getByRole('button', { name: 'Retry', exact: true }).waitFor(); mode = 'ok'; await comparison.getByRole('button', { name: 'Retry', exact: true }).click(); await comparison.getByRole('heading', { name: 'AMD vs NVDA', exact: true }).waitFor(); }
    }
    for (const state of ['error', 'stale', 'empty']) {
      marketMode = state; await page.goto(base + '/markets'); await page.reload(); await openActivity();
      if (state === 'error') {
        await gainers.getByRole('button', { name: 'Retry', exact: true }).waitFor();
        await active.getByRole('button', { name: 'Research MSFT', exact: true }).waitFor();
        marketMode = 'ok'; await gainers.getByRole('button', { name: 'Retry', exact: true }).click(); await gainers.getByRole('button', { name: 'Research SOFI', exact: true }).waitFor();
      }
      if (state === 'stale') await active.getByText('Cached data', { exact: true }).waitFor();
      if (state === 'empty') await active.getByText('No stocks returned for this list. Check back later.').waitFor();
    }
    marketMode = 'ok';
    for (const state of ['empty', 'error', 'stale']) {
      newsMode = state; await page.goto(base + '/markets?symbol=NVDA'); await page.reload();
      if (state === 'empty') { await news.getByText('No related stories were returned for NVDA. Showing market-wide headlines.').waitFor(); await news.getByRole('article').first().waitFor(); }
      if (state === 'error') { await news.getByRole('button', { name: 'Retry', exact: true }).waitFor(); newsMode = 'ok'; await news.getByRole('button', { name: 'Retry', exact: true }).click(); await news.getByRole('article').first().waitFor(); }
      if (state === 'stale') await news.getByText('Cached data', { exact: true }).waitFor();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: top 10, gainers/losers, independent errors/retry/cache/empty, five-row scrolling, mover tabs, logos/fallbacks, full-screen independent charts, reduced motion/focus restore, related news, company chips/presets, visual metric groups, negative/missing values, data table, subtle CSV/JSON downloads, draft/export consistency, 320/390/768 layouts, no profile required, no page errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
