// The beginner words a ticker search can't answer ("index fund", "S&P 500", "Fidelity", "bonds"),
// answered from a small hand-checked list with no network call (plan: unified search, tier B).
// Every entry is a plain, non-leveraged index fund from a big fund family, plus the S&P 500 index
// itself. `curatedMatches` spreads results across recipes so a list shows Vanguard AND Fidelity AND
// Schwab, never eight share classes of one fund.

/** A group of funds that copy the same (or nearly the same) slice of the market. */
export type Recipe = 's&p-500' | 'total-us' | 'total-intl' | 'total-bond' | 'tech' | 'dividend' | 'small-us' | 'world' | 'short-treasury'

export type CuratedKind = 'etf' | 'mutual_fund' | 'index'

export interface CuratedFund {
  symbol: string
  name: string
  kind: CuratedKind
  /** The fund company. Null for the index itself. */
  family: string | null
  tracks: Recipe
  /** Morningstar-style category; always one `plainCategory()` can translate. */
  category: string
  /** One plain sentence: no numbers, no percent signs, no advice words; at most 110 characters. */
  oneLiner: string
  /** Topical tags (canonical, see `TAGS`). Kind and family tags are added by `tagsOf`. */
  tags: readonly Tag[]
  /** Order within a recipe: lower first. Families alternate so the first rows vary. */
  rank: number
}

/** Topical tags a fund can carry. Kind (`etf`, `mutual fund`, `index fund`) and family tags are derived. */
export const TAGS = ['s&p 500', 'total market', 'international', 'bonds', 'tech', 'dividend', 'small companies', 'world', 'treasury', 'low fee', 'no fee'] as const
export type Tag = (typeof TAGS)[number]

export const FAMILIES = ['Vanguard', 'Fidelity', 'Schwab', 'iShares', 'SPDR', 'Invesco'] as const

/**
 * Recipe labels and the index names providers use for them (`Fund.tracks`, casefolded), so a
 * researched fund that isn't curated still finds its recipe. `sameIndex`: every fund in the recipe
 * copies the very same index, so "Same index as VOO" is literally true; otherwise the row says
 * "Similar mix to VTI".
 */
export const RECIPES: Record<Recipe, { label: string; sameIndex: boolean; aliases: readonly string[] }> = {
  's&p-500': { label: 'S&P 500', sameIndex: true, aliases: ["standard & poor's 500 index", 's&p 500 index', 's&p 500', 'standard and poors 500 index', 's&p 500 tr'] },
  'total-us': { label: 'Whole U.S. market', sameIndex: false, aliases: ['crsp us total market index', 'dow jones us total stock market index', 's&p total market index', 'fidelity us total investable market index', 'dow jones u.s. broad stock market index', 's&p total market index tr'] },
  'total-intl': { label: 'Outside the U.S.', sameIndex: false, aliases: ['ftse global all cap ex us index', 'msci acwi ex usa imi index', 'fidelity global ex us index', 'ftse developed ex us index'] },
  'total-bond': { label: 'U.S. bonds', sameIndex: false, aliases: ['bloomberg us aggregate float adjusted index', 'bloomberg us aggregate bond index', 'bloomberg u.s. aggregate bond index'] },
  tech: { label: 'Tech-heavy', sameIndex: false, aliases: ['nasdaq-100 index', 'nasdaq 100 index', 'msci us imi information technology 25/50 index', 'technology select sector index'] },
  dividend: { label: 'Dividend payers', sameIndex: false, aliases: ['dow jones us dividend 100 index', 'ftse high dividend yield index', 's&p us dividend growers index', 's&p high yield dividend aristocrats index'] },
  'small-us': { label: 'Small U.S. companies', sameIndex: false, aliases: ['crsp us small cap index', 's&p smallcap 600 index', 'dow jones us small-cap total stock market index'] },
  world: { label: 'The whole world', sameIndex: false, aliases: ['ftse global all cap index', 'msci acwi index', 'msci acwi imi index'] },
  'short-treasury': { label: 'Short U.S. government loans', sameIndex: false, aliases: ['bloomberg us treasury 1-3 year index', 'ice 0-3 month us treasury securities index', 'bloomberg short treasury 1-3 year index'] },
}

const RECIPE_ORDER = Object.keys(RECIPES) as Recipe[]

const SP = 'The biggest U.S. companies, the list most people mean by “the market”'
const TOTAL = 'Nearly every U.S. company, big and small, in one fund'

const f = (symbol: string, name: string, kind: CuratedKind, family: string | null, tracks: Recipe, category: string, rank: number, oneLiner: string, tags: Tag[]): CuratedFund =>
  ({ symbol, name, kind, family, tracks, category, rank, oneLiner, tags })

export const CURATED_FUNDS: readonly CuratedFund[] = [
  // S&P 500: the same index from five families. The index itself ranks last.
  f('VOO', 'Vanguard S&P 500 ETF', 'etf', 'Vanguard', 's&p-500', 'Large Blend', 1, `${SP}, as an ETF.`, ['s&p 500', 'low fee']),
  f('FXAIX', 'Fidelity 500 Index Fund', 'mutual_fund', 'Fidelity', 's&p-500', 'Large Blend', 2, `${SP}, as a mutual fund.`, ['s&p 500', 'low fee']),
  f('SWPPX', 'Schwab S&P 500 Index Fund', 'mutual_fund', 'Schwab', 's&p-500', 'Large Blend', 3, `${SP}, as a mutual fund.`, ['s&p 500', 'low fee']),
  f('IVV', 'iShares Core S&P 500 ETF', 'etf', 'iShares', 's&p-500', 'Large Blend', 4, `${SP}, as an ETF.`, ['s&p 500', 'low fee']),
  f('SPY', 'SPDR S&P 500 ETF Trust', 'etf', 'SPDR', 's&p-500', 'Large Blend', 5, 'The oldest and most traded ETF of the biggest U.S. companies.', ['s&p 500']),
  f('SPLG', 'SPDR Portfolio S&P 500 ETF', 'etf', 'SPDR', 's&p-500', 'Large Blend', 6, `${SP}, as a lower-cost ETF.`, ['s&p 500', 'low fee']),
  f('VFIAX', 'Vanguard 500 Index Fund Admiral Shares', 'mutual_fund', 'Vanguard', 's&p-500', 'Large Blend', 7, `${SP}, as a mutual fund.`, ['s&p 500', 'low fee']),
  f('^GSPC', 'S&P 500', 'index', null, 's&p-500', 'Large Blend', 99, 'The index itself: a scorecard you can follow but not buy. Index funds copy it.', ['s&p 500']),
  // Whole U.S. market.
  f('VTI', 'Vanguard Total Stock Market ETF', 'etf', 'Vanguard', 'total-us', 'Large Blend', 1, `${TOTAL}, as an ETF.`, ['total market', 'low fee']),
  f('FSKAX', 'Fidelity Total Market Index Fund', 'mutual_fund', 'Fidelity', 'total-us', 'Large Blend', 2, `${TOTAL}, as a mutual fund.`, ['total market', 'low fee']),
  f('SWTSX', 'Schwab Total Stock Market Index Fund', 'mutual_fund', 'Schwab', 'total-us', 'Large Blend', 3, `${TOTAL}, as a mutual fund.`, ['total market', 'low fee']),
  f('ITOT', 'iShares Core S&P Total U.S. Stock Market ETF', 'etf', 'iShares', 'total-us', 'Large Blend', 4, `${TOTAL}, as an ETF.`, ['total market', 'low fee']),
  f('SCHB', 'Schwab U.S. Broad Market ETF', 'etf', 'Schwab', 'total-us', 'Large Blend', 5, `${TOTAL}, as an ETF.`, ['total market', 'low fee']),
  f('VTSAX', 'Vanguard Total Stock Market Index Fund Admiral Shares', 'mutual_fund', 'Vanguard', 'total-us', 'Large Blend', 6, `${TOTAL}, as a mutual fund.`, ['total market', 'low fee']),
  f('FZROX', 'Fidelity ZERO Total Market Index Fund', 'mutual_fund', 'Fidelity', 'total-us', 'Large Blend', 7, `${TOTAL}, with no yearly fee. Bought through Fidelity.`, ['total market', 'low fee', 'no fee']),
  // Outside the U.S.
  f('VXUS', 'Vanguard Total International Stock ETF', 'etf', 'Vanguard', 'total-intl', 'Foreign Large Blend', 1, 'Thousands of companies outside the U.S., in Europe, Asia and beyond, as an ETF.', ['international', 'low fee']),
  f('IXUS', 'iShares Core MSCI Total International Stock ETF', 'etf', 'iShares', 'total-intl', 'Foreign Large Blend', 2, 'Thousands of companies outside the U.S., in Europe, Asia and beyond, as an ETF.', ['international', 'low fee']),
  f('SCHF', 'Schwab International Equity ETF', 'etf', 'Schwab', 'total-intl', 'Foreign Large Blend', 3, 'Big companies in wealthy countries outside the U.S., as an ETF.', ['international', 'low fee']),
  f('VTIAX', 'Vanguard Total International Stock Index Fund Admiral Shares', 'mutual_fund', 'Vanguard', 'total-intl', 'Foreign Large Blend', 4, 'Thousands of companies outside the U.S., as a mutual fund.', ['international']),
  f('FZILX', 'Fidelity ZERO International Index Fund', 'mutual_fund', 'Fidelity', 'total-intl', 'Foreign Large Blend', 5, 'Companies outside the U.S., with no yearly fee. Bought through Fidelity.', ['international', 'low fee', 'no fee']),
  // U.S. bonds.
  f('BND', 'Vanguard Total Bond Market ETF', 'etf', 'Vanguard', 'total-bond', 'Intermediate Core Bond', 1, 'Thousands of loans to the U.S. government and companies, as an ETF.', ['bonds', 'low fee']),
  f('AGG', 'iShares Core U.S. Aggregate Bond ETF', 'etf', 'iShares', 'total-bond', 'Intermediate Core Bond', 2, 'Thousands of loans to the U.S. government and companies, as an ETF.', ['bonds', 'low fee']),
  f('SCHZ', 'Schwab U.S. Aggregate Bond ETF', 'etf', 'Schwab', 'total-bond', 'Intermediate Core Bond', 3, 'Thousands of loans to the U.S. government and companies, as an ETF.', ['bonds', 'low fee']),
  f('VBTLX', 'Vanguard Total Bond Market Index Fund Admiral Shares', 'mutual_fund', 'Vanguard', 'total-bond', 'Intermediate Core Bond', 4, 'Thousands of loans to the U.S. government and companies, as a mutual fund.', ['bonds', 'low fee']),
  // Tech-heavy.
  f('QQQ', 'Invesco QQQ Trust', 'etf', 'Invesco', 'tech', 'Large Growth', 1, 'The biggest companies on the Nasdaq exchange, mostly tech, as an ETF.', ['tech']),
  f('VGT', 'Vanguard Information Technology ETF', 'etf', 'Vanguard', 'tech', 'Technology', 2, 'U.S. technology companies only, as an ETF. Narrower than a whole-market fund.', ['tech', 'low fee']),
  f('FTEC', 'Fidelity MSCI Information Technology Index ETF', 'etf', 'Fidelity', 'tech', 'Technology', 3, 'U.S. technology companies only, as an ETF. Narrower than a whole-market fund.', ['tech', 'low fee']),
  f('XLK', 'Technology Select Sector SPDR Fund', 'etf', 'SPDR', 'tech', 'Technology', 4, 'The tech companies inside the biggest U.S. companies list, as an ETF.', ['tech']),
  // Dividend payers.
  f('SCHD', 'Schwab U.S. Dividend Equity ETF', 'etf', 'Schwab', 'dividend', 'Large Value', 1, 'Established U.S. companies that pay steady dividends, as an ETF.', ['dividend', 'low fee']),
  f('VYM', 'Vanguard High Dividend Yield ETF', 'etf', 'Vanguard', 'dividend', 'Large Value', 2, 'U.S. companies that pay larger than usual dividends, as an ETF.', ['dividend', 'low fee']),
  f('SDY', 'SPDR S&P Dividend ETF', 'etf', 'SPDR', 'dividend', 'Large Value', 3, 'U.S. companies that have raised their dividends for many years, as an ETF.', ['dividend']),
  f('VIG', 'Vanguard Dividend Appreciation ETF', 'etf', 'Vanguard', 'dividend', 'Large Blend', 4, 'U.S. companies that keep growing their dividends, as an ETF.', ['dividend', 'low fee']),
  // Small U.S. companies.
  f('VB', 'Vanguard Small-Cap ETF', 'etf', 'Vanguard', 'small-us', 'Small Blend', 1, 'Smaller U.S. companies, which tend to swing more than big ones, as an ETF.', ['small companies', 'low fee']),
  f('IJR', 'iShares Core S&P Small-Cap ETF', 'etf', 'iShares', 'small-us', 'Small Blend', 2, 'Smaller U.S. companies, which tend to swing more than big ones, as an ETF.', ['small companies', 'low fee']),
  f('SCHA', 'Schwab U.S. Small-Cap ETF', 'etf', 'Schwab', 'small-us', 'Small Blend', 3, 'Smaller U.S. companies, which tend to swing more than big ones, as an ETF.', ['small companies', 'low fee']),
  // The whole world.
  f('VT', 'Vanguard Total World Stock ETF', 'etf', 'Vanguard', 'world', 'Global Large-Stock Blend', 1, 'Companies in the U.S. and around the world in one ETF.', ['world', 'low fee']),
  f('ACWI', 'iShares MSCI ACWI ETF', 'etf', 'iShares', 'world', 'Global Large-Stock Blend', 2, 'Big companies in the U.S. and around the world in one ETF.', ['world']),
  f('SPGM', 'SPDR Portfolio MSCI Global Stock Market ETF', 'etf', 'SPDR', 'world', 'Global Large-Stock Blend', 3, 'Companies in the U.S. and around the world in one lower-cost ETF.', ['world', 'low fee']),
  // Short loans to the U.S. government.
  f('SGOV', 'iShares 0-3 Month Treasury Bond ETF', 'etf', 'iShares', 'short-treasury', 'Short Government', 1, 'Very short loans to the U.S. government, so its price barely moves.', ['treasury', 'bonds']),
  f('VGSH', 'Vanguard Short-Term Treasury ETF', 'etf', 'Vanguard', 'short-treasury', 'Short Government', 2, 'Short loans to the U.S. government; its price moves only a little.', ['treasury', 'bonds', 'low fee']),
  f('SCHO', 'Schwab Short-Term U.S. Treasury ETF', 'etf', 'Schwab', 'short-treasury', 'Short Government', 3, 'Short loans to the U.S. government; its price moves only a little.', ['treasury', 'bonds', 'low fee']),
]

const BY_SYMBOL = new Map(CURATED_FUNDS.map(fund => [fund.symbol, fund]))
export const curatedFund = (symbol: string) => BY_SYMBOL.get(symbol.trim().toUpperCase().replace(/\./g, '-'))

/** Every tag a query can hit: topical tags plus the kind and the family. */
export function tagsOf(fund: CuratedFund): string[] {
  const kind = fund.kind === 'etf' ? ['etf', 'index fund'] : fund.kind === 'mutual_fund' ? ['mutual fund', 'index fund'] : ['index']
  return [...fund.tags, ...kind, ...(fund.family ? [fund.family.toLowerCase()] : [])]
}

/** Every tag word a query is scanned for, so a query tag is always one some fund can carry. */
const QUERY_TAGS = [...TAGS, 'etf', 'mutual fund', 'index fund', 'index', ...FAMILIES.map(family => family.toLowerCase())]

/**
 * Beginner wording → canonical tag. Applied to the normalized query as whole-word phrases, longest
 * first. Keys and values are lowercase.
 */
export const SYNONYMS: Record<string, string> = {
  etfs: 'etf', 'exchange traded fund': 'etf', 'exchange traded funds': 'etf',
  'mutual funds': 'mutual fund', 'index funds': 'index fund',
  sp500: 's&p 500', 'sp 500': 's&p 500', 's and p 500': 's&p 500', 's and p': 's&p 500', 's&p': 's&p 500', 's&p500': 's&p 500',
  spx: 's&p 500', "standard & poor's 500": 's&p 500', "standard and poor's 500": 's&p 500', 'standard and poors 500': 's&p 500', 'standard and poors': 's&p 500',
  cheap: 'low fee', 'low cost': 'low fee', 'low fees': 'low fee', 'low-cost': 'low fee', inexpensive: 'low fee',
  'zero fee': 'no fee', 'no fees': 'no fee', 'zero fees': 'no fee', free: 'no fee',
  bond: 'bonds', 'fixed income': 'bonds',
  blackrock: 'ishares', 'state street': 'spdr', spdrs: 'spdr',
  nasdaq: 'tech', 'nasdaq 100': 'tech', 'nasdaq-100': 'tech', technology: 'tech',
  foreign: 'international', intl: 'international', 'outside the us': 'international', 'outside the u.s.': 'international', overseas: 'international',
  global: 'world', worldwide: 'world', 'whole world': 'world', 'total world': 'world',
  'whole market': 'total market', 'total stock market': 'total market', 'entire market': 'total market', 'total us market': 'total market', 'broad market': 'total market',
  dividends: 'dividend', income: 'dividend',
  'small cap': 'small companies', 'small caps': 'small companies', 'small-cap': 'small companies', 'small company': 'small companies', small: 'small companies',
  treasuries: 'treasury', 't-bills': 'treasury', 't bills': 'treasury', 'government bonds': 'treasury', cash: 'treasury',
}

/** Words that carry no filter on their own: "vanguard index fund" is just "vanguard, index fund". */
const FILLER = new Set(['fund', 'funds', 'the', 'a', 'an', 'of', 'and', 'in', 'for', 'with', 'etc', 'shares', 'share', 'stock', 'stocks', 'index', 'u.s.', 'us', 'usa', 'american', 'companies', 'company'])

/** Lowercase, trimmed, one space between words, curly quotes straightened. */
export const normalizeText = (text: string) => text.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim()

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Whole-phrase match; `&`, `'`, `.` and `-` count as word characters so "s&p" and "u.s." stay whole. */
const phrase = (p: string) => new RegExp(`(^|[^a-z0-9&'.-])${escape(p)}(?=$|[^a-z0-9&'.-])`, 'g')
const SYNONYM_KEYS = Object.keys(SYNONYMS).sort((a, b) => b.length - a.length)
const TAG_KEYS = [...QUERY_TAGS].sort((a, b) => b.length - a.length)

/** The canonical tags a query names, plus the words it has left over (fund-name words like "total"). */
export function parseQuery(text: string): { tags: string[]; words: string[] } {
  let rest = ` ${normalizeText(text).replace(/[,;:!?"()]/g, ' ')} `
  const tags: string[] = []
  const take = (key: string, tag: string) => {
    const re = phrase(key)
    if (!re.test(rest)) return
    rest = rest.replace(phrase(key), '$1 ')
    if (!tags.includes(tag)) tags.push(tag)
  }
  // Synonyms first ("s and p" before "and" is dropped as filler), then canonical tags.
  for (const key of SYNONYM_KEYS) take(key, SYNONYMS[key]!)
  for (const tag of TAG_KEYS) take(tag, tag)
  const words = rest.split(' ').map(word => word.replace(/^[.'-]+|[.'-]+$/g, '')).filter(word => word && !FILLER.has(word))
  // "index" (or "funds") alone means "show me index funds".
  if (!tags.length && !words.length && /\b(index|funds?)\b/.test(normalizeText(text))) tags.push('index fund')
  return { tags, words }
}

export const SCORE = { exact: 100, tags: 50, name: 30, symbolPrefix: 20 } as const

/** How well one fund answers the query; 0 when it doesn't. */
export function scoreFund(fund: CuratedFund, text: string): number {
  const query = normalizeText(text)
  if (!query) return 0
  const upper = query.toUpperCase().replace(/\./g, '-')
  if (upper === fund.symbol) return SCORE.exact
  const { tags, words } = parseQuery(query)
  const nameWords = fund.name.toLowerCase().split(/[\s-]+/)
  // Whole words, or a prefix of four or more letters ("vangu"), so "app" never finds "Appreciation".
  const inName = (word: string) => nameWords.some(own => own === word || (word.length >= 4 && own.startsWith(word)))
  if (tags.length) {
    const own = tagsOf(fund)
    if (!tags.every(tag => own.includes(tag)) || !words.every(inName)) return 0
    // "cheap": the no-fee funds first.
    const bonus = tags.includes('low fee') && own.includes('no fee') ? 1 : 0
    return SCORE.tags + tags.length + bonus
  }
  const typed = query.split(' ').filter(word => word.length >= 2)
  if (typed.length && typed.every(inName)) return SCORE.name
  if (/^[A-Z0-9^-]{2,6}$/.test(upper) && fund.symbol.startsWith(upper)) return SCORE.symbolPrefix
  return 0
}

export interface CuratedMatch {
  fund: CuratedFund
  score: number
}

export const MAX_CURATED = 8
/** Rows per recipe on the first pass, in recipe order: variety before depth. */
const QUOTAS = [3, 3, 2]

/**
 * Curated answers, best first, at most 8. Exact symbol hits lead. The rest are grouped by recipe
 * (best group first, ties in `RECIPES` order) and dealt round-robin with quotas 3/3/2, so "index
 * fund" reads VOO, VTI, VXUS, FXAIX, FSKAX, IXUS, ...: three recipes, several families. When fewer
 * groups match, the leftover room is dealt round-robin from every group.
 */
export function curatedMatches(text: string, limit = MAX_CURATED): CuratedMatch[] {
  const scored = CURATED_FUNDS.map(fund => ({ fund, score: scoreFund(fund, text) })).filter(match => match.score > 0)
  const exact = scored.filter(match => match.score === SCORE.exact)
  const rest = scored.filter(match => match.score !== SCORE.exact)
  const groups = RECIPE_ORDER
    .map(recipe => rest.filter(match => match.fund.tracks === recipe).sort((a, b) => b.score - a.score || a.fund.rank - b.fund.rank))
    .filter(group => group.length > 0)
    .sort((a, b) => b[0]!.score - a[0]!.score || RECIPE_ORDER.indexOf(a[0]!.fund.tracks) - RECIPE_ORDER.indexOf(b[0]!.fund.tracks))
  const out: CuratedMatch[] = [...exact]
  const taken = groups.map(() => 0)
  const deal = (quota: (index: number) => number) => {
    let progress = true
    while (out.length < limit && progress) {
      progress = false
      groups.forEach((group, index) => {
        if (out.length >= limit || taken[index]! >= Math.min(group.length, quota(index))) return
        out.push(group[taken[index]!]!)
        taken[index]! += 1
        progress = true
      })
    }
  }
  deal(index => QUOTAS[index] ?? 0)
  deal(() => Infinity)
  return out.slice(0, limit)
}

/** The recipe a researched fund belongs to: its curated entry, else its provider `tracks` name. */
export function recipeOf(symbol: string, tracks?: string | null): Recipe | null {
  const curated = curatedFund(symbol)
  if (curated) return curated.tracks
  const name = tracks?.trim().toLowerCase().replace(/^the\s+/, '')
  if (!name) return null
  return RECIPE_ORDER.find(recipe => RECIPES[recipe].aliases.includes(name)) ?? null
}

/** Glossary terms with a real-fund illustration, and the query that finds them. */
const TERM_QUERIES: Record<string, string> = {
  ETF: 'etf', 'Index fund': 'index fund', 'Mutual fund': 'mutual fund', Bond: 'bonds', Dividend: 'dividend',
}

/** Up to three examples for a Learn glossary term, one per fund family ("VOO · Vanguard"). */
export function examplesFor(term: string, limit = 3): CuratedFund[] {
  const query = TERM_QUERIES[term]
  if (!query) return []
  const seen = new Set<string>()
  const out: CuratedFund[] = []
  for (const { fund } of curatedMatches(query, CURATED_FUNDS.length)) {
    if (!fund.family || seen.has(fund.family)) continue
    seen.add(fund.family)
    out.push(fund)
    if (out.length === limit) break
  }
  return out
}
