"""Typed errors. api.py turns every AppError into the spec's error envelope."""


class AppError(Exception):
    code = "INTERNAL"
    status = 500

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class InvalidInput(AppError):
    code = "VALIDATION"
    status = 400


class NotFound(AppError):
    code = "NOT_FOUND"
    status = 404


class NotLinked(AppError):
    code = "NOT_LINKED"
    status = 409


class UpstreamError(AppError):
    """An external dependency failed. `detail` is logged, never sent to clients."""

    code = "UPSTREAM_UNAVAILABLE"
    status = 502

    def __init__(self, provider: str, detail: str = ""):
        super().__init__(f"{provider} is unavailable right now")
        self.provider = provider
        self.detail = detail
