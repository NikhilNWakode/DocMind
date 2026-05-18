"""Rate limiting middleware using slowapi."""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings

settings = get_settings()

# Create limiter instance — uses client IP by default
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.rate_limit_per_minute}/minute"],
    storage_uri=settings.redis_url,
    strategy="fixed-window",
)


def get_user_rate_key(request) -> str:
    """Rate limit key based on authenticated user ID.

    Falls back to IP if no auth header present.
    """
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        # Use a hash of the token as key (stable per user session)
        import hashlib
        token_hash = hashlib.sha256(auth[7:].encode()).hexdigest()[:16]
        return f"user:{token_hash}"
    return get_remote_address(request)
