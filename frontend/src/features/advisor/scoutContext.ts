import { useLocation } from 'react-router'
import { findLesson } from '../../lib/lessons'

export interface ScoutPageContext {
  page: 'home' | 'portfolio' | 'markets' | 'learn' | 'advisor'
  symbol?: string
  range?: '1y' | '5y' | '10y'
  lessonId?: string
  priceDate?: string
  metric?: 'holding' | 'business' | 'revenue' | 'profit' | 'valuation' | 'risk' | 'price' | 'exposure'
  scenario?: { symbol: string; dropPct: number }
}

export function scoutContext(pathname: string, search: string): ScoutPageContext {
  const page = pathname.startsWith('/learn') ? 'learn' : pathname === '/portfolio' ? 'portfolio'
    : pathname === '/markets' ? 'markets' : pathname === '/advisor' ? 'advisor' : 'home'
  const params = new URLSearchParams(search)
  const symbol = params.get('symbol')?.toUpperCase() ?? (page === 'markets' || page === 'portfolio' ? 'VOO' : '')
  const range = params.get('range') ?? '1y'
  const metric = params.get('metric')
  const priceDate = params.get('priceDate')
  const validPriceDate = priceDate && /^\d{4}-\d{2}-\d{2}$/.test(priceDate) && Number.isFinite(Date.parse(priceDate)) && new Date(priceDate).toISOString().slice(0, 10) === priceDate
  const lessonId = pathname.startsWith('/learn/') ? pathname.split('/')[2] : undefined
  return {
    page,
    ...(validPriceDate && /^[A-Z0-9.^-]{1,12}$/.test(symbol) && ['1y','5y','10y'].includes(range) && ['portfolio','markets','advisor'].includes(page) && (page !== 'advisor' || params.has('range')) && params.get('view') !== 'companies' && metric === 'price' ? {priceDate} : {}),
    ...(['portfolio','markets','advisor'].includes(page) && params.get('view') !== 'companies' && /^[A-Z0-9.^-]{1,12}$/.test(symbol) ? {symbol} : {}),
    ...(['1y','5y','10y'].includes(range) && (page === 'portfolio' || page === 'markets' || (page === 'advisor' && params.has('range'))) ? {range: range as ScoutPageContext['range']} : {}),
    ...(lessonId && findLesson(lessonId) ? {lessonId} : {}),
    ...(metric && ['business','revenue','profit','valuation','risk','price','exposure','holding'].includes(metric) ? {metric: metric as ScoutPageContext['metric']} : {}),
  }
}

export function contextLabel(context: ScoutPageContext): string {
  const page = {home:'Home',portfolio:'Portfolio',markets:'Markets',learn:'Learn',advisor:'Advisor'}[context.page]
  if (context.metric === 'holding') return `${context.symbol} · saved holding`
  if (context.priceDate) return `${context.symbol} · close on ${context.priceDate}`
  if (context.metric === 'exposure') return context.symbol ? `${context.symbol} · ownership` : 'Your ownership & overlap'
  if (context.scenario) return `${context.scenario.symbol} · ${context.scenario.dropPct}% drop scenario`
  if (context.lessonId) return `${findLesson(context.lessonId)?.lesson.title ?? 'Lesson'} · Learn`
  return [context.symbol, page, context.metric, context.symbol ? context.range?.toUpperCase() : undefined].filter(Boolean).join(' · ')
}

export function useScoutContext() {
  const {pathname,search} = useLocation()
  return scoutContext(pathname, search)
}
