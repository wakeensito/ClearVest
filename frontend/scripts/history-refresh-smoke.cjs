const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const yaml = require('js-yaml')
const spec = yaml.load(fs.readFileSync(path.resolve(__dirname, '../../docs/api/openapi.yaml'), 'utf8'))
const preview = process.env.CLEARVEST_PREVIEW_URL || 'http://127.0.0.1:5173'

;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined })
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const now = new Date('2026-09-26T12:00:00Z')
    await page.clock.install({ time: now })
    let mode = 'pending'
    let calls = 0
    await context.route('http://127.0.0.1:4010/**', async route => {
      const url = new URL(route.request().url())
      const op = spec.paths[url.pathname]?.[route.request().method().toLowerCase()]
      let status = 200
      let body = structuredClone(op?.responses?.['200']?.content?.['application/json']?.example ?? {})
      if (url.pathname === '/market/history') {
        calls++
        const symbol = url.searchParams.get('symbols')
        const pending = mode === 'pending' || mode === 'stale' || mode === 'delayed'
        status = mode === 'pending' || mode === 'delayed' ? 202 : 200
        body = {
          series: status === 202 ? [] : body.series.filter(item => item.symbol === symbol),
          stale: mode === 'stale' || mode === 'failed', refreshing: pending,
          refresh: [{ symbol, status: pending ? 'pending' : mode === 'failed' ? 'failed' : 'ready',
            fetchedAt: status === 202 ? null : '2026-09-25T12:00:00Z',
            requestedAt: mode === 'delayed' ? '2026-09-26T11:55:00Z' : now.toISOString() }],
        }
      }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } })
    })
    await page.goto(preview + '/portfolio')
    await page.getByText('Preparing VOO price history.', { exact: false }).waitFor()
    assert.equal(await page.getByText('No price history was returned', { exact: false }).count(), 0)
    mode = 'ready'
    await page.clock.fastForward(5000)
    await page.getByRole('group', { name: 'VOO interactive price chart' }).waitFor()
    const readyCalls = calls
    await page.clock.fastForward(15000)
    assert.equal(calls, readyCalls, 'Polling stops after the fresh snapshot arrives')

    mode = 'stale'
    await page.reload()
    await page.getByText('Updating prices.', { exact: false }).waitFor()
    await page.getByRole('group', { name: 'VOO interactive price chart' }).waitFor()
    await page.getByText('Data retrieved', { exact: false }).waitFor()
    // Continue past the automatic polling window; an existing chart stays visible.
    await page.clock.fastForward(125000)
    await page.getByRole('button', { name: 'Check again', exact: true }).waitFor()
    const stoppedCalls = calls
    await page.clock.fastForward(15000)
    assert.equal(calls, stoppedCalls, 'Polling is bounded when a worker cannot finish')

    mode = 'failed'
    await page.getByRole('button', { name: 'Check again', exact: true }).click()
    await page.getByText('Prices could not be updated.', { exact: false }).waitFor()
    await page.getByRole('group', { name: 'VOO interactive price chart' }).waitFor()

    mode = 'delayed'
    await page.reload()
    await page.getByText('Prices are taking longer to update.', { exact: false }).waitFor()
    mode = 'ready'
    await page.getByRole('button', { name: 'Check again', exact: true }).click()
    await page.getByRole('group', { name: 'VOO interactive price chart' }).waitFor()
    assert.deepEqual(errors, [])
    console.log('History refresh browser checks passed: pending → ready, stale charts, bounded polling, failed refresh, manual recovery.')
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
