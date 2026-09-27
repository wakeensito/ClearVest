import type { QueryClient } from '@tanstack/react-query'
import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import type { Holding, Profile } from '../../api/client'
import { PICK_A_PLAN, PlanVsActual, SUGGESTED } from './PlanVsActual'
import { renderSeeded, sampleHoldings, seedError, seedFunds, TEMPLATES, text } from './xray.fixtures'

const MEDIUM: Profile = { age: 35, horizon: 'medium', goals: [], riskTolerance: 'medium' }

function render({ profile = MEDIUM as Profile | null, holdings = sampleHoldings().holdings as Holding[], seed = (c: QueryClient) => seedFunds(c), templates = true } = {}) {
  return renderSeeded(h(PlanVsActual, { holdings }), (c) => {
    c.setQueryData(['holdings'], { ...sampleHoldings(), holdings })
    c.setQueryData(['profile'], profile)
    if (templates) c.setQueryData(['templates'], TEMPLATES)
    else seedError(c, ['templates'])
    seed(c)
  })
}

const selected = (html: string) => /<option value="([^"]+)" selected="">/.exec(html)?.[1]

describe('PlanVsActual', () => {
  it('compares today with the suggested plan and leads with the drift sentence', () => {
    const html = render()
    expect(html).toContain('data-plan-vs-actual')
    expect(selected(html)).toBe('three-fund')
    expect(text(html)).toContain('Compare with')
    expect(text(html)).toContain(SUGGESTED)
    expect(text(html)).toContain('Nothing in bonds, where the Bogleheads three-fund plan keeps 20%. Stocks: 94% today vs 80% in the plan.')
    expect(text(html)).toContain('US stocks, international stocks and US bonds in one example weighting.')
  })

  it('draws two aria-hidden bars and a legend with both sets of percents', () => {
    const html = render()
    expect(html).toMatch(/<div class="[^"]*bars[^"]*" aria-hidden="true">/)
    expect(text(html)).toMatch(/Today\s+Bogleheads three-fund/)
    expect(text(html)).toContain('Stocks 93.7% 80.0%')
    expect(text(html)).toContain('Bonds 0.0% 20.0%')
    expect(text(html)).toContain('Cash 6.3% 0.0%')
    expect(html).toContain('var(--cv-viz-1)')
    expect(html).toContain('var(--cv-viz-4)')
    expect(html).toContain('var(--cv-viz-7)')
  })

  it('links a prefilled advisor question, never auto-sent', () => {
    const href = /href="(\/advisor\?q=[^"]+)"/.exec(render())?.[1] ?? ''
    expect(decodeURIComponent(href.replace('/advisor?q=', '')))
      .toBe('My mix has nothing in bonds, where the Bogleheads three-fund plan keeps 20%. Stocks: 94% today vs 80% in the plan. What should a beginner understand about that?')
    expect(href).not.toContain('send=')
  })

  it('says where the suggested plan came from, under the select', () => {
    const t = text(render())
    expect(t).toContain('Picked from your answers (age, time horizon, risk comfort). A starting point, not advice.')
    expect(t).not.toContain('Answer three questions')
  })

  it('without a profile, invites the three profile questions, linking to the profile editor', () => {
    const html = render({ profile: null })
    expect(text(html)).toContain('Answer three questions in your investment profile to get a suggested plan.')
    expect(html).toMatch(/<a href="\/welcome\?edit=1"[^>]*>investment profile<\/a>/)
    expect(text(html)).not.toContain('Picked from your answers')
  })

  it('suggests a plan from the profile', () => {
    expect(selected(render({ profile: { ...MEDIUM, riskTolerance: 'low' } }))).toBe('sixty-forty')
    expect(selected(render({ profile: { ...MEDIUM, riskTolerance: 'high', horizon: 'long' } }))).toBe('buffett-90-10')
  })

  it('without a profile, shows the default plan and asks the user to pick one', () => {
    const html = render({ profile: null })
    expect(selected(html)).toBe('three-fund')
    expect(text(html)).toContain(PICK_A_PLAN)
    expect(text(html)).not.toContain(SUGGESTED)
  })

  it('says how many funds were checked, and the assumption, while funds are missing', () => {
    expect(text(render({ seed: (c) => seedFunds(c, ['VOO', 'QQQ']) }))).toContain('2 of 3 funds checked · assumes unchecked funds hold stocks')
    expect(text(render())).not.toContain('funds checked')
  })

  it('shows only today when templates fail', () => {
    const html = render({ templates: false })
    expect(html).not.toContain('<select')
    expect(text(html)).toContain('Today')
    expect(text(html)).toContain('Stocks 93.7%')
    expect(text(html)).not.toContain('Plan')
    expect(text(html)).not.toMatch(/Your mix is|Nothing in/)
  })

  it('renders nothing for an empty account', () => {
    expect(render({ holdings: [] })).toBe('')
  })
})
