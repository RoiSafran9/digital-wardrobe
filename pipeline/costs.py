"""Estimated USD for one model call, for the owner's cost report (ai_calls). An estimate for trends, not a bill.

Paid-tier list prices from ai.google.dev/gemini-api/docs/pricing, read on AS_OF (the outfit PoC). Update the
table and AS_OF together when Google changes them. Vision models: per 1M input/output tokens. Image models:
per output image, plus input tokens.
"""

AS_OF = "2026-10-19"

RATES: dict[str, dict[str, float]] = {
    "gemini-3.1-flash-lite": {"in_per_m": 0.25, "out_per_m": 1.50},
    "gemini-2.5-flash-image": {"in_per_m": 0.30, "per_image": 0.039},
    "gemini-3.1-flash-image": {"in_per_m": 0.50, "per_image": 0.067},
    "gemini-3.1-flash-lite-image": {"in_per_m": 0.25, "per_image": 0.0336},
}


def estimate_usd(model: str, input_tokens: int | None, output_tokens: int | None, images_out: int = 0) -> float | None:
    """None when the model has no rate or the call returned no token counts."""
    rate = RATES.get(model)
    if rate is None or (input_tokens is None and output_tokens is None):
        return None
    usd = (input_tokens or 0) / 1e6 * rate.get("in_per_m", 0.0)
    if "per_image" in rate:
        usd += (images_out or 0) * rate["per_image"]
    else:
        usd += (output_tokens or 0) / 1e6 * rate.get("out_per_m", 0.0)
    return round(usd, 6)
