/* Real Chromium integration checks. API responses are illustrative OpenAPI fixtures. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const base = process.env.CLEARVEST_PREVIEW_URL || 'http://127.0.0.1:5173';
const spec = yaml.load(fs.readFileSync(path.resolve(__dirname, '../../docs/api/openapi.yaml'), 'utf8'));
const output = path.resolve(__dirname, '../node_modules/.cache/clearvest-review');
const lessonIds = [...fs.readFileSync(path.resolve(__dirname, '../src/lib/lessons.ts'), 'utf8').matchAll(/^        id: '([^']+)'/gm)].map(match => match[1]);
const axePath = path.resolve(__dirname, '../node_modules/.cache/clearvest-a11y/node_modules/axe-core/axe.min.js');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, headless: true });
  try {
    const errors = [];
    const context = await browser.newContext({ viewport: { width: 320, height: 800 }, reducedMotion: 'reduce' });
    const mock = async route => {
      const url = new URL(route.request().url()), method = route.request().method().toLowerCase();
      const body = structuredClone(spec.paths[url.pathname]?.[method]?.responses?.['200']?.content?.['application/json']?.example ?? {});
      if (url.pathname === '/profile') return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'No profile' } } });
      if (url.pathname === '/market/company-research') body.symbol = url.searchParams.get('symbol');
      await route.fulfill({ json: body });
    };
    await context.route('http://127.0.0.1:4010/**', mock);
    await context.route('https://images.financialmodelingprep.com/**', route => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    const noOverflow = async label => {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: horizontal overflow`);
    };
    const audit = async label => {
      if (!fs.existsSync(axePath)) return;
      await page.addScriptTag({ path: axePath });
      const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, detail: n.failureSummary })) })));
      if (violations.length) await page.screenshot({ path: path.join(output, 'learn-a11y-debug.png'), fullPage: false });
      assert.deepEqual(violations, [], `${label}: accessibility`);
    };
    const complete = async (target, id, inspect = false) => {
      await target.goto(base + '/learn/' + id);
      for (let i = 0; i < 10 && !await target.getByRole('group', { name: 'Answer choices' }).isVisible(); i++) {
        if (inspect) await noOverflow(`${id} card ${i + 1}`);
        await target.getByRole('button', { name: /^(Continue|Check what you learned)$/ }).click();
      }
      for (let i = 0; i < 2; i++) {
        const next = target.getByRole('button', { name: i === 1 ? 'Finish lesson' : 'Continue', exact: true });
        assert(await next.isDisabled(), 'A quiz requires an answer before proceeding');
        await target.getByRole('group', { name: 'Answer choices' }).getByRole('button').first().click();
        if (inspect) { await noOverflow(`${id} quiz ${i + 1}`); if (i === 0 && id === lessonIds[0]) await audit('Answered lesson'); }
        await next.click();
      }
      await target.getByRole('heading', { name: 'Lesson complete', exact: true }).waitFor();
      if (inspect) await noOverflow(`${id} complete`);
    };
    await page.goto(base + '/learn');
    assert.equal(await page.locator('ol > li > details[open]').count(), 1, 'Only the next unit is expanded initially');
    await audit('Learn mobile');
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'learn-integrated-mobile.png'), fullPage: true });
    // Every lesson, quiz feedback state and completion action fits a narrow phone.
    for (const id of lessonIds) { console.log('Checking lesson:', id); await complete(page, id, true); }
    await page.getByRole('link', { name: 'See your progress', exact: true }).click();
    await page.getByText('You finished the starter path. Review any lesson below.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reset progress', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByText('12 of 12 lessons done').waitFor();
    await page.getByRole('button', { name: 'Reset progress', exact: true }).click();
    await page.getByRole('button', { name: 'Reset lessons', exact: true }).click();
    await page.getByText('0 of 12 lessons done').waitFor();
    // Partial completion resumes from Home and persists on reload, independently of research checks.
    await complete(page, 'what-is-investing');
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Home', exact: true }).click();
    const resume = page.getByRole('link', { name: /Continue learning/ });
    assert.equal(await resume.getAttribute('href'), '/learn/safety-net-first');
    await page.reload(); await page.getByText(/1 of 12 lessons complete/).waitFor();
    await complete(page, 'stocks-and-bonds');
    await page.getByRole('link', { name: 'Try reading a real company' }).click();
    await page.getByRole('heading', { name: 'What does this business do?' }).waitFor();
    assert(page.url().includes('guided=1'));
    await complete(page, 'funds');
    await page.getByRole('link', { name: 'Ask the advisor about this' }).click();
    assert((await page.getByRole('textbox', { name: 'Your question' }).inputValue()).includes('fund'));
    assert(page.url().includes('/advisor?'), 'Lesson question needs no profile setup');
    // Continue labels, unit expansion, flashcards and calculator remain usable at all breakpoints.
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + '/learn'); await noOverflow(`Learn ${width}`);
      await page.getByText('Try the growth illustration', { exact: true }).click();
      await page.getByRole('slider', { name: /Each month/ }).fill('1000');
      await page.getByRole('slider', { name: /For how long/ }).fill('40');
      await noOverflow(`Growth ${width}`);
      await page.getByRole('button', { name: '0%', exact: true }).click();
      assert.equal(await page.getByText('$480,000', { exact: true }).count(), 2, 'Zero growth leaves only contributions');
      await page.getByRole('button', { name: 'Flashcards', exact: true }).click();
      await page.getByRole('button', { name: 'Reveal meaning', exact: true }).click();
      await page.getByRole('button', { name: 'I knew it', exact: true }).click();
      await page.getByText(/1 marked as known/).waitFor(); await noOverflow(`Flashcards ${width}`);
      assert(await page.getByRole('button', { name: /Select to reveal the meaning/ }).evaluate(el => el === document.activeElement), 'Card navigation preserves keyboard focus');
      // Put the controls in view: Axe otherwise measures the small strip clipped by the sticky header.
      if (width === 320) { await page.getByRole('group', { name: 'Glossary view' }).evaluate(el => el.scrollIntoView({ block: 'center' })); await audit('Flashcards and growth mobile'); }
      if (width === 1440) await page.screenshot({ path: path.join(output, 'learn-integrated-desktop.png'), fullPage: true });
    }
    await page.goto(base + '/learn/missing-lesson');
    await page.getByRole('link', { name: 'Back to Learn', exact: true }).click();
    await page.evaluate(() => localStorage.setItem('cv-learn-progress', '{"completed":["funds","funds",null,"unknown"],"lastDay":"invalid","streak":1e309}'));
    await page.reload(); await page.getByText('1 of 12 lessons done').waitFor();
    // A read-only or completely blocked browser store still carries completion across SPA routes.
    for (const blockReads of [false, true]) {
      const blocked = await browser.newContext({ viewport: { width: 320, height: 800 } });
      await blocked.route('http://127.0.0.1:4010/**', mock);
      await blocked.addInitScript(block => {
        if (block) Storage.prototype.getItem = () => { throw new Error('blocked'); };
        Storage.prototype.setItem = () => { throw new Error('blocked'); };
        Storage.prototype.removeItem = () => { throw new Error('blocked'); };
      }, blockReads);
      const target = await blocked.newPage(); target.on('pageerror', error => errors.push(error.message));
      await complete(target, 'what-is-investing');
      await target.getByRole('link', { name: 'Back to Learn', exact: true }).click();
      await target.getByText('1 of 12 lessons done').waitFor();
      await target.getByRole('button', { name: 'Reset progress', exact: true }).click();
      await target.getByRole('button', { name: 'Reset lessons', exact: true }).click();
      await target.getByText('0 of 12 lessons done').waitFor();
      await blocked.close();
    }
    assert.deepEqual(errors, []);
    console.log(`Learn integration passed: all ${lessonIds.length} lessons, mobile layouts, quiz feedback, resume/reset, guided research, public advisor, flashcards, growth, invalid routes/storage and blocked storage.${fs.existsSync(axePath) ? ' Axe accessibility checks passed.' : ''}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
