"""PortfolioFn: profile, Plaid linking, holdings, risk."""

from clearvest.api import create_app, make_handler

from portfolio.routes import health, holdings, plaid, profile, risk

app = create_app(health.router, profile.router, plaid.router, holdings.router, risk.router)
handler = make_handler(app)
