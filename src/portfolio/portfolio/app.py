"""PortfolioFn: profile, Plaid linking, holdings, risk."""

from clearvest.api import create_app, make_handler

from portfolio.routes import exposure, health, holdings, plaid, profile, risk

app = create_app(exposure.router, health.router, profile.router, plaid.router, holdings.router, risk.router)
handler = make_handler(app)
