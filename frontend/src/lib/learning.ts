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
  { term: 'Stock', meaning: 'A share of ownership in a company. Its price rises and falls with how investors value the business.', example: 'Owning one share of a company means you own a very small slice of it.' },
  { term: 'Bond', meaning: 'A loan you make to a government or company, which pays you interest and returns the amount at the end.', example: 'Bonds usually move less than stocks, but their prices can fall when interest rates rise.' },
  { term: 'Index fund', meaning: 'A fund that copies a market index, such as the S&P 500, instead of picking investments.', example: 'Because it follows a set list, costs are usually low.' },
  { term: 'Mutual fund', meaning: 'A fund that pools money from many investors and is priced once at the end of each trading day.', example: 'Many workplace retirement plans offer mutual funds.' },
  { term: 'Market index', meaning: 'A list that tracks a group of investments to measure part of the market.', example: 'The S&P 500 follows about 500 large US companies.' },
  { term: 'Dividend', meaning: 'A share of a company’s profits paid to its shareholders, usually in cash.', example: 'Some funds pass dividends from the companies they hold on to you.' },
  { term: 'Compound growth', meaning: 'When investment earnings start earning money of their own, so growth builds on itself over time.', example: 'The growth calculator on this page shows how time affects the result.' },
  { term: 'Emergency fund', meaning: 'Cash set aside for unexpected costs, commonly three to six months of essential expenses.', example: 'It helps you avoid selling investments at a bad time.' },
  { term: 'Dollar-cost averaging', meaning: 'Investing the same amount on a regular schedule, whatever prices are doing.', example: 'A fixed amount buys more shares when prices are low and fewer when they are high.' },
  { term: 'Brokerage account', meaning: 'A regular investing account with no age rules for withdrawals. Gains and dividends are usually taxed.', example: 'You buy stocks, bonds and funds inside an account like this one.' },
  { term: '401(k)', meaning: 'A workplace retirement account funded from your paycheck, often with an employer match.', example: 'For 2026 you can contribute up to $24,500 of your own pay.' },
  { term: 'Employer match', meaning: 'Money your employer adds to your retirement account when you contribute.', example: 'A common match is 50 cents per dollar, up to 6% of pay.' },
  { term: 'Roth IRA', meaning: 'An individual retirement account funded with after-tax money, so qualified withdrawals in retirement are tax-free.', example: 'Contributions can be taken out any time. Income limits apply.' },
  { term: 'Traditional IRA', meaning: 'An individual retirement account that may lower your taxes now, with taxes paid when you withdraw later.', example: 'Withdrawals before 59½ usually mean taxes plus a 10% penalty.' },
  { term: 'Capital gain', meaning: 'The profit when you sell an investment for more than you paid.', example: 'Gains on investments held longer than a year are generally taxed at lower rates.' },
  { term: 'Bear market', meaning: 'A period when prices fall 20% or more from a recent high. A bull market is a long stretch of rising prices.', example: 'Bear markets have happened many times and have been followed by recoveries, though timing varies.' },
  { term: 'Rebalancing', meaning: 'Adjusting your investments back to your chosen mix after some grow faster than others.', example: 'If stocks grow from 70% to 80% of your portfolio, rebalancing moves some back to bonds.' },
] as const

export function filterTerms(search: string) {
  const query = search.trim().toLowerCase()
  return TERMS.filter(({ term, meaning }) => `${term} ${meaning}`.toLowerCase().includes(query))
}
