"""MarketFn: historical prices, company comparison, macro context, portfolio templates."""

from clearvest.api import create_app, make_handler

from market.routes import companies, history, macro, templates

app = create_app(history.router, companies.router, macro.router, templates.router)
handler = make_handler(app)
