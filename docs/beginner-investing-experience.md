# ClearVest: A welcoming introduction to investing

Status: Product proposal with local implementation underway. The beginner home, contextual research and public advisor are implemented; Max owns the Learn tab. See the [implementation handoff](handoffs/2026-09-26-frontend-beginner-journey-financials.md) for completed work, verification and remaining ideas.

ClearVest should help someone feel **“I can understand investing, and I know what to learn next.”** Right now, the experience starts with a profile, an account connection and financial tools. The Learn page has useful definitions, but it mostly sends people into advisor conversations. The missing piece is a guided experience where beginners can try things and build confidence.

1. **Make the homepage a learning journey.**
   Welcome users with “Start from zero,” “Understand my investments,” or “Practice first.” Give them one small next step rather than several dashboards. Someone should get value before connecting an account or knowing their risk tolerance.

2. **Turn lessons into short, interactive missions.**
   Examples include “Become a shareholder,” where users explore what owning a tiny piece of a company means; “Build your first basket,” where they group companies and discover where their risks overlap; “Spot the difference,” comparing a stock and an ETF; and “Read your first chart,” explaining a price movement in plain language.

   Each mission should involve a choice, feedback and something the user can now explain.

3. **Add a practice portfolio with a purpose.**
   Give users clearly labeled virtual money and guided scenarios: “Your largest holding drops,” “You need this money sooner,” or “Two funds own many of the same companies.” Ask what they notice before explaining the tradeoffs. Reward completing the exercise and understanding it—not making the most money.

4. **Make the existing research tools teach as people use them.**
   The two-company comparison is a strong foundation. Add a beginner view with prompts such as “Which business earns more from each dollar of sales?” Explain a metric beside the chart, then let users reveal more detail. Company logos make the experience familiar; the lesson should help them move beyond choosing a familiar brand.

5. **Give news a beginner translation.**
   Each story could include “What happened,” “What this term means,” and “Why investors are paying attention.” Let users save unfamiliar concepts to learn later. This turns the news section into a reason to return without making everything feel urgent.

For gamification, use **a progress map, optional weekly learning goals and milestones tied to skills**: “I can explain diversification” is more meaningful than an arbitrary level. Avoid profit leaderboards and rewards for trading; FCA research found some trading-app engagement features increased trading frequency and risk-taking. [FCA research](https://www.fca.org.uk/publications/fca-research/research-note-digital-engagement-practices-trading-apps-experiment)

Keep gainers and losers inside **Markets**, while making the beginner journey the default landing experience.

The next build should be focused: **a welcoming homepage, five interactive missions, one guided practice scenario and saved progress.** A first visit could end with: “You explored your first company and learned what a share represents. Next, discover why investors own more than one.” That gives ClearVest a clearer identity and makes the existing tools part of a learning experience.
