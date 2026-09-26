// Common beginner questions for the Learn tab. Educational answers, never personal recommendations.

export interface FaqItem {
  question: string
  answer: string
}

export const FAQ: readonly FaqItem[] = [
  {
    question: 'How much money do I need to start?',
    answer: 'Often very little. Many brokerages have no account minimum and let you buy fractional shares, so you can start with a few dollars. What matters more is having your safety net in place first.',
  },
  {
    question: 'Should I pay off debt or invest first?',
    answer: 'Many people pay off high-interest debt, like credit cards, before investing, because that interest is usually higher than what investments reliably earn. Lower-interest debt, like many student loans or mortgages, is less clear-cut, and an employer match is often worth collecting either way.',
  },
  {
    question: 'Is investing just gambling?',
    answer: 'Not in the same way. Gambling is usually a short-term bet with the odds against you. Owning a broad mix of businesses for many years has historically grown in value, though there are no guarantees and you can still lose money.',
  },
  {
    question: 'Can I lose all my money?',
    answer: 'With a single company, yes. Companies can go bankrupt. A broad fund holding hundreds of companies is far less likely to go to zero, but it can still fall a lot, sometimes for years.',
  },
  {
    question: 'What if the market crashes right after I invest?',
    answer: 'It happens, and it feels bad. If you do not need the money for many years, you have time to wait for a recovery. Investing a little at a time also means you keep buying at lower prices during a drop.',
  },
  {
    question: 'Should I pick individual stocks or buy funds?',
    answer: 'Funds give you instant diversification in one purchase, which is why many beginners start with broad, low-cost index funds. Picking individual stocks takes more research and concentrates your risk.',
  },
  {
    question: 'Do I pay taxes on my investments?',
    answer: 'In a regular brokerage account, you usually pay tax on dividends and on profits when you sell. Profits on investments held longer than a year are generally taxed at lower rates. Retirement accounts have their own rules.',
  },
  {
    question: 'Is my money protected if my brokerage goes out of business?',
    answer: 'At most US brokerages, SIPC protects your account up to $500,000, including up to $250,000 in cash, if the firm fails. It does not protect you from investments losing value. Bank deposits are covered by FDIC insurance instead.',
  },
  {
    question: 'Which account should I open first?',
    answer: 'It depends on your situation. A common order is: collect any employer match in a 401(k) or TSP, consider an IRA, then use a regular brokerage account for other goals. The advisor can talk through your specifics.',
  },
  {
    question: 'How often should I check my investments?',
    answer: 'Less often than you might think. Daily price swings are mostly noise for long-term goals. Many people review a few times a year, or when their life changes.',
  },
]
