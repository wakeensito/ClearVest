// Beginner starter path for the Learn tab. Plain-language, educational content only — no
// recommendations. Dollar limits mirror src/layer/clearvest/data/retirement_accounts.json (2026).

export interface LessonCard {
  heading: string
  body: string
  example?: string
}

export interface QuizQuestion {
  question: string
  options: readonly string[]
  answer: number
  explain: string
}

/** One row of a fund's published top holdings. `weight` is a fraction (0.07 = 7%), like every weight in the app. */
export interface FundHolding {
  symbol: string
  name: string
  weight: number
}

/** A call the fund manager makes. Same shape as a quiz question, plus the setup and the payoff. */
export interface FundDecision extends QuizQuestion {
  /** What is happening in the fund right before the question. */
  situation: string
  /** The row of the holdings strip this decision is about. */
  focus: string
  /** Why this rule matters to someone who owns the fund. Shown under the explanation. */
  payoff: string
}

/** "Be the fund": the user plays a real index fund. Replaces the quiz; cards still run first. */
export interface FundPlay {
  fund: string
  fundName: string
  /** Date the holdings were pulled (YYYY-MM-DD). Shown on screen, so refresh it with the numbers. */
  asOf: string
  /** How much of the fund the listed holdings add up to, as a fraction. */
  topShare: number
  holdings: readonly FundHolding[]
  decisions: readonly FundDecision[]
  /** The holding the score screen ties back to the user ("about 7% of your VOO is Apple"). */
  spotlight: string
}

export interface Lesson {
  id: string
  title: string
  minutes: number
  cards: readonly LessonCard[]
  quiz: readonly QuizQuestion[]
  askPrompt: string
  play?: FundPlay
}

export interface Unit {
  id: string
  title: string
  summary: string
  lessons: readonly Lesson[]
}

export const UNITS: readonly Unit[] = [
  {
    id: 'basics',
    title: 'Before you invest',
    summary: 'What investing is, what to have in place first, and why time helps.',
    lessons: [
      {
        id: 'what-is-investing',
        title: 'What investing actually is',
        minutes: 3,
        cards: [
          {
            heading: 'Saving keeps money safe. Investing puts it to work.',
            body: 'Money in a savings account stays put and earns a little interest. When you invest, you buy something, like a small piece of a company, that can grow in value over time.',
            example: 'A savings account is a parking spot. An investment is a vehicle that can take you further, but it can also break down along the way.',
          },
          {
            heading: 'The value goes up and down',
            body: 'Investments do not grow in a straight line. Some years they rise, some years they fall. That up-and-down movement is the price you pay for the chance of higher growth.',
          },
          {
            heading: 'Risk and reward travel together',
            body: 'Investments with the chance of bigger gains usually come with bigger swings. Anything promising high returns with no risk is a warning sign.',
            example: 'A government savings bond moves very little. A single tech stock can double or be cut in half in a year.',
          },
        ],
        quiz: [
          {
            question: 'What is the main difference between saving and investing?',
            options: [
              'Investing can grow more over time, but its value can also fall',
              'Saving always earns more than investing',
              'Investing is guaranteed by the government',
            ],
            answer: 0,
            explain: 'Investing gives your money a chance to grow faster than a savings account, in exchange for ups and downs along the way.',
          },
          {
            question: 'Someone promises you big returns with no risk. What does that usually mean?',
            options: ['It is a great deal', 'It is a warning sign', 'It is how index funds work'],
            answer: 1,
            explain: 'Higher returns come with higher risk. A promise of both is one of the most common signs of a scam.',
          },
        ],
        askPrompt: 'Explain the difference between saving and investing with a simple everyday example.',
      },
      {
        id: 'safety-net-first',
        title: 'Build your safety net first',
        minutes: 3,
        cards: [
          {
            heading: 'Start with an emergency fund',
            body: 'An emergency fund is cash set aside for surprises like a car repair or a lost job. A common guideline is three to six months of essential expenses, kept somewhere easy to reach.',
            example: 'If your rent, food and bills add up to $2,000 a month, a three-month cushion is about $6,000.',
          },
          {
            heading: 'High-interest debt often comes first',
            body: 'Credit card debt can charge 20% interest or more a year. Paying it down is a guaranteed saving that investing is unlikely to beat.',
          },
          {
            heading: 'Money you need soon should not be in stocks',
            body: 'If you will need the money within about three years, for a deposit or tuition, a sudden drop could leave you short. Many people keep short-term money in savings instead.',
          },
        ],
        quiz: [
          {
            question: 'What is an emergency fund for?',
            options: ['Buying stocks when prices drop', 'Unexpected costs, like a car repair or job loss', 'Paying for vacations'],
            answer: 1,
            explain: 'It covers surprises so you do not have to sell investments at a bad time or take on debt.',
          },
          {
            question: 'Your credit card charges 24% interest. What often makes sense before investing?',
            options: ['Paying down the card', 'Investing all your money right away', 'Opening a second card'],
            answer: 0,
            explain: 'Paying off 24% interest is like earning a guaranteed 24%. Few investments can match that reliably.',
          },
        ],
        askPrompt: 'How do people usually decide between building an emergency fund, paying off debt and starting to invest?',
      },
      {
        id: 'starting-early',
        title: 'Why starting early matters',
        minutes: 3,
        cards: [
          {
            heading: 'Growth on top of growth',
            body: 'When your investments earn money, those earnings can start earning too. This snowball effect is called compound growth.',
          },
          {
            heading: 'Time does most of the work',
            body: 'The longer money stays invested, the more room it has to compound. Small amounts invested early can end up larger than bigger amounts invested later.',
            example: 'Try the growth calculator on the Learn page: compare 10 years with 30 years at the same monthly amount.',
          },
          {
            heading: 'Consistency beats timing',
            body: 'You do not need a lot to start. Investing a steady amount regularly matters more than finding the perfect moment.',
          },
        ],
        quiz: [
          {
            question: 'What is compound growth?',
            options: ['A fee your brokerage charges', 'Earnings that start earning money themselves', 'A type of stock'],
            answer: 1,
            explain: 'Compounding means your returns generate their own returns, which is why time matters so much.',
          },
          {
            question: 'Which usually helps compound growth the most?',
            options: ['Waiting for the perfect time to buy', 'Giving money more years to grow', 'Checking prices every day'],
            answer: 1,
            explain: 'More time lets growth build on itself. Nobody can reliably predict the perfect moment.',
          },
        ],
        askPrompt: 'Show me how compound growth works with a simple example using small monthly amounts.',
      },
    ],
  },
  {
    id: 'what-to-buy',
    title: 'What you can buy',
    summary: 'Stocks, bonds and funds, and why spreading out matters.',
    lessons: [
      {
        id: 'stocks-and-bonds',
        title: 'Stocks and bonds',
        minutes: 3,
        cards: [
          {
            heading: 'A stock is a small piece of a company',
            body: 'When you buy a share, you own a tiny slice of that business. If the company grows, your share can become more valuable. If it struggles, the price can fall.',
          },
          {
            heading: 'A bond is a loan you make',
            body: 'When you buy a bond, you lend money to a government or company. The issuer promises interest and repayment, but may fail to pay. Bonds often have smaller price swings than stocks.',
          },
          {
            heading: 'Bonds are steadier, not risk-free',
            body: 'Bond prices can fall, especially when interest rates rise. Stocks have historically grown more over long periods, with bigger swings along the way.',
          },
        ],
        quiz: [
          {
            question: 'When you buy a stock, you are…',
            options: ['Lending money to a company', 'Owning a small piece of a company', 'Opening a savings account'],
            answer: 1,
            explain: 'A share is ownership. A bond is the one that works like a loan.',
          },
          {
            question: 'Which is true about bonds?',
            options: ['They can never lose value', 'They usually move less than stocks, but can still fall', 'They are the same as stocks'],
            answer: 1,
            explain: 'Bonds are generally steadier, but their prices can drop, for example when interest rates go up.',
          },
        ],
        askPrompt: 'Explain stocks and bonds in plain language, and why someone might own both.',
      },
      {
        id: 'funds',
        title: 'Funds: index funds and ETFs',
        minutes: 4,
        cards: [
          {
            heading: 'A fund is a basket of investments',
            body: 'Instead of buying one company, a fund pools money from many people to buy many investments at once. One purchase can give you hundreds of companies.',
          },
          {
            heading: 'Index funds follow a list',
            body: 'An index fund copies a market index, like the S&P 500, a list of about 500 large US companies. It does not try to pick winners, which usually keeps costs low.',
            example: 'VOO is one fund that tracks the S&P 500.',
          },
          {
            heading: 'Exchange-traded funds trade like stocks',
            body: 'An exchange-traded fund can be bought and sold any time the market is open. A mutual fund is priced once a day. Many index funds come in both forms.',
          },
          {
            heading: 'Watch the expense ratio',
            body: 'Funds charge a yearly fee called the expense ratio. Small differences add up over decades.',
            example: 'On $10,000, a 0.03% fee costs about $3 a year. A 1% fee costs about $100 a year.',
          },
        ],
        quiz: [
          {
            question: 'What does an index fund do?',
            options: ['Picks the stocks it thinks will win', 'Copies a market index, like the S&P 500', 'Only holds cash'],
            answer: 1,
            explain: 'Index funds follow a set list instead of trying to beat the market, which usually keeps fees low.',
          },
          {
            question: 'A fund has a 1% expense ratio. On $10,000, about how much is that a year?',
            options: ['$1', '$10', '$100'],
            answer: 2,
            explain: '1% of $10,000 is $100 a year, every year. That is why low fees matter over time.',
          },
        ],
        askPrompt: 'What is the difference between an index fund, an ETF and a mutual fund?',
      },
      {
        id: 'be-the-fund',
        title: 'Be the fund for 60 seconds',
        minutes: 1,
        cards: [
          {
            heading: 'You are VOO now.',
            body: 'VOO is one fund that tracks the S&P 500. It holds money from millions of people, spread across about 500 US companies. Today you run it. Below are your ten biggest holdings, and you have three calls to make. Each one is a call the fund makes in real life.',
          },
        ],
        quiz: [],
        play: {
          fund: 'VOO',
          fundName: 'Vanguard S&P 500 ETF',
          // Pulled with yfinance: Ticker('VOO').funds_data.top_holdings. Rounded to one decimal.
          asOf: '2026-09-26',
          topShare: 0.378,
          holdings: [
            { symbol: 'NVDA', name: 'NVIDIA', weight: 0.081 },
            { symbol: 'AAPL', name: 'Apple', weight: 0.07 },
            { symbol: 'MSFT', name: 'Microsoft', weight: 0.057 },
            { symbol: 'AMZN', name: 'Amazon', weight: 0.038 },
            { symbol: 'GOOGL', name: 'Alphabet (Class A)', weight: 0.03 },
            { symbol: 'AVGO', name: 'Broadcom', weight: 0.027 },
            { symbol: 'GOOG', name: 'Alphabet (Class C)', weight: 0.024 },
            { symbol: 'META', name: 'Meta Platforms', weight: 0.019 },
            { symbol: 'MU', name: 'Micron Technology', weight: 0.016 },
            { symbol: 'TSLA', name: 'Tesla', weight: 0.016 },
          ],
          spotlight: 'AAPL',
          decisions: [
            {
              situation: 'New money came into the fund today. Apple is worth almost twice as much as Amazon.',
              question: 'How much of the new money goes to each?',
              focus: 'AAPL',
              options: [
                'Split it equally between them',
                'About twice as much to Apple, in line with its size',
                'More to Amazon, it has more room to grow',
              ],
              answer: 1,
              explain: 'The fund puts about twice as much into Apple as into Amazon. Bigger companies get bigger slices, in proportion to their size. This has a name: cap weighting.',
              payoff: 'That is why Nvidia, Apple and Microsoft are 8.1%, 7.0% and 5.7% of VOO. Nobody at the fund picked them. They are simply the biggest.',
            },
            {
              situation: 'Nvidia had a huge year. Its price roughly doubled, and it is now 8.1% of the fund, your biggest holding.',
              question: 'Do you trim it back?',
              focus: 'NVDA',
              options: ['Sell some to bring it back down', 'Do nothing', 'Buy more, it is winning'],
              answer: 1,
              explain: 'The fund does nothing. When a company’s price rises, its slice of the fund grows on its own. No trade needed, so no trade made.',
              payoff: 'Nvidia became the biggest slice of VOO by price alone. The fund never bought extra to get it there.',
            },
            {
              situation: 'You read the news and you think Tesla is overpriced. It is 1.6% of the fund.',
              question: 'Do you cut it?',
              focus: 'TSLA',
              options: ['Sell some of it', 'Hold it, at the weight the index says', 'Sell all of it'],
              answer: 1,
              explain: 'The fund holds it. An index fund has no opinions. It trades only when the index changes, when a company is added or dropped, or when money comes in or goes out. That is called index rebalancing.',
              payoff: 'If Tesla is ever dropped from the S&P 500, the fund sells it that day. Until then, it stays, whatever anyone thinks of the price.',
            },
          ],
        },
        askPrompt: 'Explain how an S&P 500 index fund like VOO decides how much of each company to hold, and why it rarely trades.',
      },
      {
        id: 'diversification',
        title: "Don't put all your eggs in one basket",
        minutes: 3,
        cards: [
          {
            heading: 'One company can fall a lot',
            body: 'Even well-known companies can lose most of their value. If all your money is in one stock, one bad year for that company is a bad year for you.',
          },
          {
            heading: 'Spreading out softens the bumps',
            body: 'Diversification means owning many different investments, so one loss has a smaller effect. It reduces risk, but it cannot prevent every loss.',
          },
          {
            heading: 'More funds is not always more variety',
            body: 'Two funds can own many of the same companies. Large companies such as Apple and Microsoft appear in many popular funds, so owning several funds can still leave you concentrated.',
            example: 'Your Portfolio tab shows your largest holdings, so you can spot concentration.',
          },
        ],
        quiz: [
          {
            question: 'What does diversification do?',
            options: ['Guarantees you will not lose money', 'Spreads risk so one loss hurts less', 'Increases your fees'],
            answer: 1,
            explain: 'Owning many investments lowers the impact of any single one. It cannot remove all risk.',
          },
          {
            question: 'You own three different funds. Are you automatically diversified?',
            options: ['Yes, three funds is always enough', 'Not necessarily. They may own the same companies', 'Only if they are ETFs'],
            answer: 1,
            explain: 'Funds often overlap. Look at what each fund actually holds.',
          },
        ],
        askPrompt: 'Is my portfolio diversified? Explain in plain language and point out any overlap between my funds.',
      },
    ],
  },
  {
    id: 'accounts',
    title: 'Where your money lives',
    summary: 'Brokerage and retirement accounts, the employer match, and Roth versus traditional.',
    lessons: [
      {
        id: 'account-types',
        title: 'Brokerage vs. retirement accounts',
        minutes: 3,
        cards: [
          {
            heading: 'An account holds your investments',
            body: 'People usually use a brokerage account to buy and hold investments. Think of the account as a container: the investments are what goes inside, and the account type affects the tax rules.',
          },
          {
            heading: 'A brokerage account is flexible',
            body: 'You can put money in and take it out any time. You generally pay taxes on dividends and on profits when you sell.',
          },
          {
            heading: 'Retirement accounts trade flexibility for tax breaks',
            body: 'Accounts like a 401(k) or IRA offer tax advantages. In return, taking money out before age 59½ usually means taxes plus a 10% penalty, with some exceptions.',
          },
        ],
        quiz: [
          {
            question: 'What is the main trade-off of a retirement account?',
            options: ['Tax breaks, but rules on early withdrawals', 'No taxes ever and no rules', 'Higher fees for everyone'],
            answer: 0,
            explain: 'You get tax advantages, but taking money out early usually costs taxes and a penalty.',
          },
          {
            question: 'Which account lets you withdraw any time without an early-withdrawal penalty?',
            options: ['A 401(k)', 'A regular brokerage account', 'A traditional IRA'],
            answer: 1,
            explain: 'A brokerage account has no age rules, though you may owe taxes on profits.',
          },
        ],
        askPrompt: 'Explain the difference between a brokerage account and a retirement account, and when each is used.',
      },
      {
        id: 'employer-plans',
        title: '401(k), TSP and the employer match',
        minutes: 3,
        cards: [
          {
            heading: 'Workplace plans take money straight from your paycheck',
            body: 'A 401(k) is offered by many employers. The TSP (Thrift Savings Plan) is the federal version for government employees and members of the uniformed services.',
          },
          {
            heading: 'The match is extra money',
            body: 'Many employers add money when you contribute, called a match. It is part of your pay, so many people contribute at least enough to get the full match.',
            example: 'A common setup: your employer adds 50 cents for every dollar you put in, up to 6% of your pay.',
          },
          {
            heading: 'There is a yearly limit',
            body: 'For 2026 you can contribute up to $24,500 of your own pay to a 401(k) or TSP, with a usual extra $8,000 catch-up at age 50 and up. A higher catch-up can apply at ages 60–63; check your plan’s rules.',
          },
        ],
        quiz: [
          {
            question: 'What is an employer match?',
            options: ['A fee your employer charges', 'Money your employer adds when you contribute', 'A type of loan'],
            answer: 1,
            explain: 'A match is extra money added to your account because you contributed.',
          },
          {
            question: 'Who is the TSP for?',
            options: ['Anyone with a brokerage account', 'Federal employees and members of the uniformed services', 'Only people over 50'],
            answer: 1,
            explain: 'The Thrift Savings Plan is the federal government’s version of a 401(k).',
          },
        ],
        askPrompt: 'How does an employer 401(k) match work, and why do people try not to miss it?',
      },
      {
        id: 'roth-vs-traditional',
        title: 'Roth vs. traditional',
        minutes: 4,
        cards: [
          {
            heading: 'Pay taxes now or later',
            body: 'Traditional accounts may give you a tax break today, with taxes due on withdrawals later. Whether an IRA contribution is deductible depends on your situation. Roth accounts use money you already paid taxes on, and qualified withdrawals in retirement are tax-free.',
          },
          {
            heading: 'The key question is your tax rate',
            body: 'If you expect to be in a higher tax bracket later, Roth often comes out ahead. If you expect a lower bracket in retirement, traditional often does. Age alone does not decide it.',
          },
          {
            heading: 'Roth IRA basics',
            body: 'For 2026 the combined limit across your traditional and Roth IRAs is $7,500, plus $1,100 at age 50 and up, and cannot exceed eligible earned income. Roth eligibility also depends on income. Withdrawal rules differ for contributions and earnings.',
          },
        ],
        quiz: [
          {
            question: 'With a Roth account, when do you pay taxes?',
            options: ['Now, on the money you put in', 'Later, when you withdraw in retirement', 'Never, on anything'],
            answer: 0,
            explain: 'Roth money is taxed before it goes in, so qualified withdrawals in retirement are tax-free.',
          },
          {
            question: 'What usually matters most when choosing Roth or traditional?',
            options: ['Your favorite color', 'Your tax rate now compared with your expected tax rate later', 'Which one has the longer name'],
            answer: 1,
            explain: 'Paying tax now makes sense when your rate is lower now than it will be later, and the other way around.',
          },
        ],
        askPrompt: 'Help me understand Roth versus traditional accounts. What questions should I ask myself?',
      },
    ],
  },
  {
    id: 'habits',
    title: 'Habits that help',
    summary: 'Investing steadily, staying calm in drops, and avoiding hype.',
    lessons: [
      {
        id: 'steady-investing',
        title: 'Investing a little at a time',
        minutes: 3,
        cards: [
          {
            heading: 'Set it and repeat it',
            body: 'Investing the same amount on a schedule, like every payday, is called dollar-cost averaging. It builds a habit and takes the guesswork out of timing.',
          },
          {
            heading: 'You buy more when prices are low',
            body: 'A fixed amount buys more shares when prices drop and fewer when they rise. It smooths out your purchase price over time.',
            example: '$100 buys 2 shares at $50, or 4 shares at $25.',
          },
          {
            heading: 'Automation helps',
            body: 'Most accounts can move money in automatically. It does not guarantee a profit, but it makes staying consistent easier.',
          },
        ],
        quiz: [
          {
            question: 'What is dollar-cost averaging?',
            options: ['Investing the same amount on a regular schedule', 'Buying only when prices are rising', 'Selling everything each year'],
            answer: 0,
            explain: 'A steady amount on a schedule, no matter what the market is doing.',
          },
          {
            question: 'You invest $100 and the price drops from $50 to $25. What happens to your next purchase?',
            options: ['You buy fewer shares', 'You buy more shares', 'Nothing changes'],
            answer: 1,
            explain: '$100 buys 4 shares at $25 instead of 2 at $50.',
          },
        ],
        askPrompt: 'Explain dollar-cost averaging with a simple example and what it can and cannot do.',
      },
      {
        id: 'market-drops',
        title: 'What to do when the market drops',
        minutes: 3,
        cards: [
          {
            heading: 'Drops are normal',
            body: 'Markets have fallen many times and recovered over the long run, though recoveries can take years and past results do not guarantee the future.',
          },
          {
            heading: 'Pause and check what changed',
            body: 'A falling price means your investment is worth less, even before you sell. Selling after a drop can mean missing a later recovery, but recovery is never guaranteed. Check your goals, timeline and the investment itself.',
          },
          {
            heading: 'Your timeline is your guide',
            body: 'A longer timeline gives you more time to handle ups and downs, but a company can still fail. Money you need soon has less time to recover from a drop.',
          },
        ],
        quiz: [
          {
            question: 'The market drops 15% this month. What often hurts long-term investors most?',
            options: ['Staying invested', 'Panic-selling and missing the recovery', 'Checking their plan'],
            answer: 1,
            explain: 'A rushed sale can mean missing a later recovery. But prices may not recover, so check your situation rather than assuming you must always hold.',
          },
          {
            question: 'Why keep money you need next year out of stocks?',
            options: ['Stocks are illegal for short goals', 'A drop might not recover before you need it', 'Stocks never go up'],
            answer: 1,
            explain: 'Short timelines leave little room to wait out a decline.',
          },
        ],
        askPrompt: 'The market just dropped. Help me think through it calmly, based on my time horizon.',
      },
      {
        id: 'hype-and-scams',
        title: 'Spotting hype and scams',
        minutes: 3,
        cards: [
          {
            heading: 'Know the red flags',
            body: 'Guaranteed returns, pressure to act now, secret strategies and requests to pay in gift cards or crypto are classic warning signs.',
          },
          {
            heading: 'Hot tips are not a plan',
            body: 'A stock trending on social media may already be priced for the hype. Ask what you would own, why, and what could go wrong.',
          },
          {
            heading: 'Check before you trust',
            body: 'Use FINRA BrokerCheck and Investor.gov to check registration and disciplinary history. Registration is a check to make, not a promise that advice is good or an investment is safe.',
          },
        ],
        quiz: [
          {
            question: 'Which one is a red flag?',
            options: ['A fund that lists its fees', '“Guaranteed 30% returns, but you must decide today”', 'A registered adviser'],
            answer: 1,
            explain: 'Guarantees plus pressure are two of the most common scam tactics.',
          },
          {
            question: 'Where can you check whether a broker is legitimate?',
            options: ['A social media comment section', 'FINRA BrokerCheck or Investor.gov', 'The person’s own website only'],
            answer: 1,
            explain: 'Both are free, official lookups for registered professionals.',
          },
        ],
        askPrompt: 'What are the most common investment scams, and how can a beginner spot them?',
      },
    ],
  },
]

export const ALL_LESSONS: readonly Lesson[] = UNITS.flatMap((unit) => unit.lessons)

export function findLesson(id: string | undefined): { lesson: Lesson; unit: Unit; index: number } | null {
  const index = ALL_LESSONS.findIndex((lesson) => lesson.id === id)
  const lesson = ALL_LESSONS[index]
  if (!lesson) return null
  const unit = UNITS.find((u) => u.lessons.includes(lesson))
  return unit ? { lesson, unit, index } : null
}

/** The lesson you play rather than read. The Learn tab gives it its own card. */
export const PLAY_LESSON: Lesson | undefined = ALL_LESSONS.find((lesson) => lesson.play)

/** The first lesson not yet completed, or null when everything is done. */
export function nextLesson(completed: readonly string[]): Lesson | null {
  return ALL_LESSONS.find((lesson) => !completed.includes(lesson.id)) ?? null
}
