/* Start Vite first. Financial figures below are fixtures, never current market data. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const base = process.env.CLEARVEST_PREVIEW_URL || 'http://127.0.0.1:5173';
const spec = yaml.load(fs.readFileSync(path.resolve(__dirname, '../../docs/api/openapi.yaml'), 'utf8'));
const output = path.resolve(__dirname, '../node_modules/.cache/clearvest-review');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const errors = [], requests = [];
    let financialMode = 'ok', searchMode = 'ok', profileExists = false;
    const routes = async route => {
      const url = new URL(route.request().url()), method = route.request().method().toLowerCase();
      requests.push(url.pathname + url.search);
      let body = structuredClone(spec.paths[url.pathname]?.[method]?.responses?.['200']?.content?.['application/json']?.example ?? {}), status = 200;
      const fail = () => { status = 502; body = { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Unavailable' } }; };
      if (url.pathname === '/profile') {
        if (method === 'put') { profileExists = true; body = route.request().postDataJSON(); }
        else if (!profileExists) { status = 404; body = { error: { code: 'NOT_FOUND', message: 'No profile' } }; }
      }
      if (url.pathname === '/portfolio/holdings') { status = 409; body = { error: { code: 'NOT_LINKED', message: 'No account linked' } }; }
      if (url.pathname === '/market/history') body = { ...body, series: [{ ...body.series[0], symbol: url.searchParams.get('symbols') }] };
      if (url.pathname === '/market/company-research') {
        const symbol = url.searchParams.get('symbol'); body.symbol = symbol;
        body.profile.name = `${symbol} example company`;
        if (financialMode === 'empty') { body.profile = null; body.income = []; body.history = []; body.valuation = null; }
        if (symbol === 'VOO') { body.profile.name = 'Example fund'; body.profile.isFund = true; body.income = []; }
        if (financialMode === 'partial') { body.unavailable = ['valuation']; body.valuation = null; body.sources = body.sources.filter(source => source.section !== 'valuation'); }
        if (financialMode === 'stale') body.sources.forEach(source => source.stale = true);
        if (financialMode === 'loss') { body.income[0].netIncome = -20000000; body.income[0].epsDiluted = -5; body.valuation.eps = -5; body.valuation.pe = -20; body.history.forEach(row => row.pe = -10); }
        if (financialMode === 'currency') { body.income[1].currency = 'EUR'; body.income[2].currency = null; }
        if (financialMode === 'error') fail();
        if (financialMode === 'slow') await new Promise(resolve => setTimeout(resolve, 800));
      }
      if (url.pathname === '/market/search') {
        if (searchMode === 'empty') body.results = [];
        if (searchMode === 'error') fail();
      }
      if (url.pathname === '/market/news') body.articles = [];
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    };
    await context.route('http://127.0.0.1:4010/**', routes);
    await context.route('https://images.financialmodelingprep.com/**', route => route.abort());
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(error.message));
    const axePath = path.resolve(__dirname, '../node_modules/.cache/clearvest-a11y/node_modules/axe-core/axe.min.js');
    const audit = async label => {
      if (!fs.existsSync(axePath)) return;
      await page.addScriptTag({ path: axePath });
      const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })));
      assert.deepEqual(violations, [], `${label}: accessibility violations`);
    };
    const noOverflow = async label => {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const metrics = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1 && el.getBoundingClientRect().width > 0).map(el => ({ tag: el.tagName, class: el.className, right: el.getBoundingClientRect().right, text: el.textContent.slice(0, 80) })) }));
      if (metrics.scroll > metrics.width + 1) { console.log(label, metrics); await page.screenshot({ path: path.join(output, 'beginner-overflow-debug.png'), fullPage: true }); }
      assert(metrics.scroll <= metrics.width + 1, `${label}: no horizontal page overflow`);
    };
    await page.goto(base + '/');
    await page.getByRole('heading', { name: 'Investing starts with understanding.' }).waitFor();
    assert(!requests.some(url => /\/plaid\/|company-research|market\/history/.test(url)), 'Homepage does not request account links or financial data');
    await page.getByRole('slider').focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('slider').getAttribute('aria-valuetext'), '2 shares, 2 percent of this example business');
    await page.getByRole('button', { name: 'Yes, because I own it' }).click();
    await page.getByText(/Ownership does not guarantee success/).waitFor();
    await page.getByRole('button', { name: 'No, its value can fall' }).click();
    await page.getByText('1 of 3 ideas explored.', { exact: false }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Start your first lesson' }).getAttribute('href'), '/learn/what-is-investing', 'Primary action above the fold starts lesson 1');
    assert.equal(await page.getByRole('link', { name: /Next: What investing actually is/ }).getAttribute('href'), '/learn/what-is-investing', 'Correct quick check leads into lesson 1');
    await page.getByRole('region', { name: 'Your progress' }).getByText(/0 of \d+ lessons done/).waitFor();
    await page.reload(); await page.getByText('1 of 3 ideas explored.', { exact: false }).waitFor();
    await audit('Homepage');
    await page.screenshot({ path: path.join(output, 'beginner-home-desktop.png'), fullPage: true });
    await page.getByRole('link', { name: /Explore a real company/ }).click();
    const financials = () => page.getByRole('region', { name: 'AAPL company financials', exact: true });
    await financials().getByRole('heading', { name: 'What does this business do?' }).waitFor();
    assert.equal(await page.getByRole('region', { name: 'Top 10 most active', exact: true }).count(), 0, 'Guided mode removes movers distraction');
    assert.equal(await page.getByRole('group', { name: /interactive price chart/ }).count(), 0, 'Chart is optional in guided view');
    await financials().getByRole('button', { name: 'Next: Sales & profit' }).click();
    await financials().getByRole('heading', { name: 'Is the business earning money?' }).waitFor();
    assert(await financials().getByRole('heading', { name: 'Is the business earning money?' }).evaluate(el => el === document.activeElement), 'Next step moves keyboard focus');
    await financials().getByText('Open the income statement', { exact: true }).click();
    await financials().getByRole('table', { name: 'AAPL annual income statements' }).waitFor();
    await financials().getByRole('button', { name: '$100', exact: true }).click();
    await financials().getByText(/\$100 is revenue/).waitFor();
    await financials().getByRole('button', { name: '$20', exact: true }).click();
    await audit('Guided income statement');
    await page.screenshot({ path: path.join(output, 'beginner-financials-desktop.png'), fullPage: true });
    await financials().getByRole('button', { name: 'Next: Price & value' }).click();
    await financials().getByText(/middle value of 3 available positive/).waitFor();
    await financials().getByRole('button', { name: 'No, I need more context' }).click();
    await page.goto(base + '/'); await page.getByText('3 of 3 ideas explored.', { exact: false }).waitFor();

    // Responsive flows at small mobile, common mobile, tablet and desktop sizes.
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + '/'); await noOverflow(`Home ${width}`);
      if (width === 390) await page.screenshot({ path: path.join(output, 'beginner-home-mobile.png'), fullPage: true });
      await page.goto(base + '/markets?symbol=AAPL&guided=1');
      await financials().getByRole('button', { name: /^2 Sales & profit$/ }).click();
      await financials().getByText('Open the income statement', { exact: true }).click();
      await noOverflow(`Financials ${width}`);
      const table = financials().getByRole('region', { name: /income statement, scroll/ });
      if (width < 768) assert(await table.evaluate(el => el.scrollWidth > el.clientWidth), 'Wide statement scrolls inside its region');
      if (width === 390) await page.screenshot({ path: path.join(output, 'beginner-financials-mobile.png'), fullPage: true });
    }

    // Name lookup, empty results, provider retry, and selection update all research sections.
    const finder = page.getByRole('region', { name: 'Security research workspace', exact: true });
    await finder.getByText('Don’t know the ticker? Find a company by name', { exact: true }).click();
    await finder.getByRole('button', { name: 'Find company', exact: true }).click();
    await finder.getByText('Enter a company name or ticker.', { exact: true }).waitFor();
    searchMode = 'empty'; await finder.getByLabel('Company name or ticker').fill('nonexistent');
    await finder.getByRole('button', { name: 'Find company', exact: true }).click();
    await finder.getByText(/No companies found/).waitFor();
    searchMode = 'error'; await finder.getByLabel('Company name or ticker').fill('apple');
    await finder.getByRole('button', { name: 'Find company', exact: true }).click();
    await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
    searchMode = 'ok'; await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await finder.getByRole('button', { name: /Apple Inc./ }).click();
    await financials().getByRole('heading', { name: /Understand AAPL/ }).waitFor();

    for (const mode of ['partial', 'stale', 'loss', 'currency', 'empty', 'error', 'slow']) {
      financialMode = mode; await page.reload();
      if (mode === 'error') { await financials().getByRole('button', { name: 'Retry', exact: true }).waitFor(); financialMode = 'ok'; await financials().getByRole('button', { name: 'Retry', exact: true }).click(); }
      await financials().getByRole('heading', { name: /Understand AAPL/ }).waitFor();
      if (mode === 'partial') { await financials().getByText(/Some company information could not load/).waitFor(); financialMode = 'ok'; await financials().getByRole('button', { name: 'Retry missing data' }).click(); await financials().getByRole('button', { name: 'Retry missing data' }).waitFor({ state: 'hidden' }); }
      if (mode === 'stale') await financials().getByText(/Showing some previously saved figures/).waitFor();
      await financials().getByRole('button', { name: /^2 Sales & profit$/ }).click();
      if (mode === 'loss') { await financials().getByText(/reported a loss/).waitFor(); await financials().getByRole('button', { name: /^3 Price & value$/ }).click(); await financials().getByText('Not meaningful or unavailable', { exact: true }).waitFor(); }
      if (mode === 'currency') await financials().getByText('A comparable prior year is not available.', { exact: true }).waitFor();
      if (mode === 'empty') await financials().getByText(/Annual income statements are not available/).waitFor();
      assert(!(await financials().innerText()).match(/NaN|Infinity|undefined/), `${mode} has readable values`);
    }
    financialMode = 'ok';
    await page.goto(base + '/markets?symbol=VOO&guided=1');
    await page.getByText('Example fund is a fund.', { exact: true }).waitFor();
    await page.getByRole('link', { name: 'Explore funds in Learn' }).waitFor();

    // Both full-screen sides receive their own financial data, and reduced motion is respected.
    await page.goto(base + '/markets?symbol=AAPL');
    await page.getByRole('button', { name: 'Compare securities', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Compare securities' });
    const right = dialog.getByRole('region', { name: 'Second security', exact: true });
    await right.getByLabel('Research a ticker symbol').fill('MSFT');
    await right.getByRole('button', { name: 'Research symbol' }).click();
    await dialog.getByRole('region', { name: 'MSFT company financials' }).getByRole('heading', { name: 'Understand MSFT example company' }).waitFor();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert(await dialog.evaluate(el => [...el.querySelectorAll('*')].every(child => getComputedStyle(child).animationName === 'none')), 'Reduced-motion comparison has no animation');
    await audit('Full-screen comparison');
    await page.keyboard.press('Escape');
    assert(await page.getByRole('button', { name: 'Compare securities', exact: true }).evaluate(el => document.activeElement === el));
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');

    // General questions work without a profile; optional profile editing preserves a linked question.
    profileExists = false;
    await page.goto(base + '/advisor?q=' + encodeURIComponent('Explain EPS with a simple example.'));
    await page.getByRole('textbox', { name: 'Your question' }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: 'Your question' }).inputValue(), 'Explain EPS with a simple example.');
    await page.getByRole('complementary', { name: 'What the advisor sees' }).getByRole('link', { name: 'Edit profile' }).click();
    await page.getByRole('heading', { name: 'Edit your profile' }).waitFor();
    await audit('Profile form');
    await page.getByLabel('Age', { exact: true }).fill('13');
    await page.getByLabel('10+ years', { exact: true }).check();
    await page.getByLabel('Low', { exact: false }).check();
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await page.getByRole('textbox', { name: 'Your question' }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: 'Your question' }).inputValue(), 'Explain EPS with a simple example.');
    await page.setViewportSize({ width: 320, height: 700 }); await noOverflow('Advisor 320'); await audit('Advisor mobile');
    await page.goto(base + '/portfolio'); await page.getByText('What is a portfolio?', { exact: true }).click();
    await page.getByText(/A portfolio is your collection/).waitFor(); await noOverflow('Portfolio 320');

    // Corrupt chat storage cannot crash the application shell.
    await page.evaluate(() => localStorage.setItem(`cv-chat:${localStorage.getItem('cv-user-id')}`, JSON.stringify({ messages: 'not an array', disclaimer: {} })));
    await page.goto(base + '/advisor');
    await page.getByRole('textbox', { name: 'Your question' }).waitFor();
    await page.evaluate(() => localStorage.setItem(`cv-chat:${localStorage.getItem('cv-user-id')}`, JSON.stringify({ messages: [null, { role: 'user' }, { id: 'bad', role: 'advisor', text: 7 }] })));
    await page.reload(); await page.getByRole('textbox', { name: 'Your question' }).waitFor();

    // Blocked storage never prevents the first activity from working.
    const storageContext = await browser.newContext({ viewport: { width: 320, height: 700 } });
    await storageContext.route('http://127.0.0.1:4010/**', routes);
    await storageContext.addInitScript(() => { Storage.prototype.getItem = () => { throw new Error('blocked'); }; Storage.prototype.setItem = () => { throw new Error('blocked'); }; });
    const storagePage = await storageContext.newPage(); storagePage.on('pageerror', error => errors.push(error.message));
    await storagePage.goto(base + '/'); await storagePage.getByRole('button', { name: 'No, its value can fall' }).click();
    await storagePage.getByText('1 of 3 ideas explored.', { exact: false }).waitFor();
    await storageContext.close();
    if (fs.existsSync(axePath)) console.log('Axe accessibility checks passed on home, guided statements, full-screen comparison, profile form and mobile advisor.');
    assert.deepEqual(errors, []);
    console.log('Beginner journey checks passed: public entry, learning feedback/progress, guided financials, responsive tables, name search, empty/error/stale/partial/loss/currency data, funds, independent comparison, focus, reduced motion, advisor return and blocked storage.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
