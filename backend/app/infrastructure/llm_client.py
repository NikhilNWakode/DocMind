"""LLM client abstraction — Groq (free, OpenAI-compatible API).

Supports any OpenAI-compatible provider by changing LLM_BASE_URL:
  - Groq:   https://api.groq.com/openai/v1  (free, fast)
  - OpenAI: https://api.openai.com/v1        (paid)
  - Ollama: http://localhost:11434/v1         (local)
"""

from collections.abc import AsyncGenerator

from openai import AsyncOpenAI

from app.config import get_settings

settings = get_settings()

llm_client = AsyncOpenAI(
    api_key=settings.llm_api_key,
    base_url=settings.llm_base_url,
)


async def stream_chat_completion(
    messages: list[dict[str, str]],
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 1500,
) -> AsyncGenerator[str, None]:
    """Stream chat completion tokens."""
    response = await llm_client.chat.completions.create(
        model=model or settings.llm_model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=True,
    )

    async for chunk in response:
        if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


async def chat_completion(
    messages: list[dict[str, str]],
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 1500,
) -> str:
    """Non-streaming chat completion."""
    response = await llm_client.chat.completions.create(
        model=model or settings.llm_model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content or ""
