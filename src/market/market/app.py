"""MarketFn: historical prices, company comparison, macro context, portfolio templates."""

from clearvest.api import create_app, make_handler

from market.routes import (
    companies,
    fund,
    funds,
    history,
    macro,
    movers,
    news,
    research,
    templates,
)

app = create_app(
    history.router, companies.router, fund.router, funds.router, macro.router, movers.router, news.router,
    research.router, templates.router,
)
handler = make_handler(app)
