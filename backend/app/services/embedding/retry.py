"""
Asynchronous Retry Handler with Exponential Backoff and Jitter.
Handles API rate limits (HTTP 429), timeouts, and transient connection drops.
"""

import asyncio
import logging
import random
from typing import Any, Callable, Coroutine, List, Type

logger = logging.getLogger(__name__)


async def with_retry(
    func: Callable[..., Coroutine[Any, Any, Any]],
    *args: Any,
    max_retries: int = 3,
    initial_backoff: float = 0.5,
    backoff_multiplier: float = 2.0,
    retryable_exceptions: tuple[Type[Exception], ...] = (Exception,),
    **kwargs: Any,
) -> Any:
    """
    Executes an async function with exponential backoff and random jitter.
    """
    attempt = 0
    backoff = initial_backoff

    while True:
        try:
            attempt += 1
            return await func(*args, **kwargs)
        except retryable_exceptions as e:
            if attempt >= max_retries:
                logger.error(
                    f"Embedding request failed after {max_retries} attempts: {str(e)}"
                )
                raise

            # Add +/- 25% jitter
            jitter = random.uniform(0.75, 1.25)
            wait_time = backoff * jitter
            logger.warning(
                f"Embedding call failed on attempt {attempt}/{max_retries} with '{type(e).__name__}: {e}'. "
                f"Retrying in {wait_time:.2f}s..."
            )
            await asyncio.sleep(wait_time)
            backoff *= backoff_multiplier
