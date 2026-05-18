"""Domain-specific exceptions for clean error handling."""


class DocMindError(Exception):
    """Base exception for all DocMind errors."""

    def __init__(self, message: str, code: str, status: int = 500):
        self.message = message
        self.code = code
        self.status = status
        super().__init__(message)


class NotFoundError(DocMindError):
    """Resource not found."""

    def __init__(self, resource: str, resource_id: str):
        super().__init__(
            message=f"{resource} '{resource_id}' not found",
            code=f"{resource.upper()}_NOT_FOUND",
            status=404,
        )


class AuthenticationError(DocMindError):
    """Authentication failed."""

    def __init__(self, message: str = "Invalid credentials"):
        super().__init__(message=message, code="AUTHENTICATION_FAILED", status=401)


class AuthorizationError(DocMindError):
    """User does not have permission."""

    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(message=message, code="AUTHORIZATION_FAILED", status=403)


class ValidationError(DocMindError):
    """Input validation failed."""

    def __init__(self, message: str):
        super().__init__(message=message, code="VALIDATION_ERROR", status=422)


class IngestionError(DocMindError):
    """Document ingestion failed."""

    def __init__(self, document_id: str, reason: str):
        super().__init__(
            message=f"Failed to ingest document '{document_id}': {reason}",
            code="INGESTION_FAILED",
            status=422,
        )


class RateLimitError(DocMindError):
    """Rate limit exceeded."""

    def __init__(self, retry_after: int = 60):
        super().__init__(
            message=f"Rate limit exceeded. Retry after {retry_after} seconds.",
            code="RATE_LIMIT_EXCEEDED",
            status=429,
        )
