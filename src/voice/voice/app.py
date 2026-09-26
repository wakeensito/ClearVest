"""VoiceFn: upload, turn, speak."""

from clearvest.api import create_app, make_handler

from voice.routes import speak, turn, upload

app = create_app(upload.router, turn.router, speak.router)
handler = make_handler(app)
