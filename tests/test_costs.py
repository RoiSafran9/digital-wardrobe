"""Estimated USD per model call (pipeline/costs.py): list prices × tokens / images, for trends, not a bill."""
import pytest
from pipeline import costs
from pipeline.providers.gemini import MODEL_IMAGE, MODEL_IMAGE_FALLBACK, MODEL_VISION


def test_every_model_in_use_has_a_dated_rate():
    for model in (MODEL_VISION, MODEL_IMAGE, MODEL_IMAGE_FALLBACK):
        assert model in costs.RATES
    assert costs.AS_OF == "2026-10-19"


def test_vision_call_is_priced_by_tokens():
    rate = costs.RATES[MODEL_VISION]
    assert costs.estimate_usd(MODEL_VISION, 1_000_000, 0) == pytest.approx(rate["in_per_m"])
    assert costs.estimate_usd(MODEL_VISION, 0, 1_000_000) == pytest.approx(rate["out_per_m"])


def test_image_call_is_priced_per_image_plus_input():
    rate = costs.RATES[MODEL_IMAGE]
    assert costs.estimate_usd(MODEL_IMAGE, 1_000_000, 1290, images_out=1) == pytest.approx(rate["per_image"] + rate["in_per_m"])
    assert costs.estimate_usd(MODEL_IMAGE_FALLBACK, 0, 1290, images_out=2) == pytest.approx(2 * costs.RATES[MODEL_IMAGE_FALLBACK]["per_image"])


def test_unknown_model_or_missing_tokens_has_no_estimate():
    assert costs.estimate_usd("some-new-model", 100, 100) is None
    assert costs.estimate_usd(MODEL_VISION, None, None) is None
