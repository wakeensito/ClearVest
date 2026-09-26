"""AdvisorFn: chat and retirement account guidance."""

from clearvest.api import create_app, make_handler

from advisor.routes import chat, retirement

app = create_app(chat.router, retirement.router)
handler = make_handler(app)
