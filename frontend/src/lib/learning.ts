export const LEARNING_SOURCE = 'https://www.investor.gov/introduction-investing'
export const GLOSSARY_SOURCE = 'https://www.investor.gov/introduction-investing/investing-basics/glossary'

export const TERMS = [
  { term: 'Portfolio', meaning: 'The collection of investments you own, such as shares, funds and bonds.', example: 'Your holdings list shows the individual investments inside your portfolio.' },
  { term: 'Asset allocation', meaning: 'How your money is divided among different investment types.', example: 'The portfolio mix groups your holdings into categories such as stocks, funds and bonds.' },
  { term: 'Diversification', meaning: 'Spreading investments across different assets to reduce dependence on any one of them. It cannot prevent every loss.', example: 'Two funds can own similar companies. A larger number of funds does not always mean a more varied mix.' },
  { term: 'ETF', meaning: 'An exchange-traded fund pools investments and has shares that trade on an exchange.', example: 'Look inside a fund to understand its investments; the ticker alone does not describe its risks.' },
  { term: 'Volatility', meaning: 'How much an investment’s price moves over time.', example: 'Large price swings can matter more when you need to use your money soon.' },
  { term: 'Time horizon', meaning: 'How long you expect to invest before you need the money.', example: 'Different goals can have different timelines. Your investment profile lets you describe yours.' },
  { term: 'Risk tolerance', meaning: 'Your willingness and ability to accept losses or changes in investment value.', example: 'It can change with your circumstances. Revisit it when your needs change.' },
  { term: 'Expense ratio', meaning: 'A fund’s annual operating expenses expressed as a percentage of its assets.', example: 'Compare costs alongside strategy and risk when researching funds.' },
] as const

export function filterTerms(search: string) {
  const query = search.trim().toLowerCase()
  return TERMS.filter(({ term, meaning }) => `${term} ${meaning}`.toLowerCase().includes(query))
}
