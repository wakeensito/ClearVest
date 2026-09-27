// Shown on Home right after someone learns that a share can lose value. It turns
// "so how do I avoid the ones that fall?" into a research habit, without promising safety.

export const CLUES = [
  { question: 'Is it selling more?', term: 'Revenue', body: 'Sales that grow over several years suggest people keep wanting what the company offers.' },
  { question: 'Is it actually making money?', term: 'Net income', body: 'Profit is what’s left after every cost. A company can sell a lot and still lose money.' },
  { question: 'Can it handle its debts?', term: 'Debt', body: 'Borrowing isn’t bad on its own, but heavy debt can sink a business when sales slow down.' },
  { question: 'Is the price sensible?', term: 'P/E ratio', body: 'Compare the share price with what the company earns. A great company can still be priced too high.' },
] as const

export const PROFESSOR_PROMPT =
  'Teach me like a patient finance professor teaching a complete beginner. ' +
  'How do investors judge whether a company is on solid financial ground and less likely to run into trouble? ' +
  'Walk me through revenue, net income and the income statement, debt, and the P/E ratio one idea at a time, ' +
  'with a simple made-up example for each. Be clear that no company is guaranteed not to fall. ' +
  'Finish by suggesting which ClearVest lesson I should take next.'

export const GUIDED_RESEARCH = '/markets?symbol=AAPL&guided=1'
export const professorLink = `/advisor?q=${encodeURIComponent(PROFESSOR_PROMPT)}`
