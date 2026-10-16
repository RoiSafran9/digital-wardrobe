from pipeline.types import VerificationResult, ItemResult

VISIBLE_FRACTION_MEDIUM_THRESHOLD = 0.6
CUT_OFF_RETAKE = "Part of this piece is outside the photo — step back so the whole piece fits in the frame"


def cut_off(visible_fraction: float) -> ItemResult:
    return ItemResult(tier="low", reason="cut off by the photo frame; not generated",
                       retake_instruction=CUT_OFF_RETAKE, visible_fraction=visible_fraction)


def run(verification: VerificationResult | None, visible_fraction: float,
        max_attempts: int) -> ItemResult:
    if verification is None or (verification.status == "fail" and verification.attempt >= max_attempts + 1):
        return ItemResult(
            tier="low",
            reason="verification failed after all retries" if verification else "generation never succeeded",
            retake_instruction="Shoot it alone in better light, spread out flat",
            visible_fraction=visible_fraction,
        )
    if visible_fraction < VISIBLE_FRACTION_MEDIUM_THRESHOLD:
        return ItemResult(
            tier="medium",
            reason=f"low visible fraction ({visible_fraction:.2f}), likely overlapping another item",
            retake_instruction=None,
            visible_fraction=visible_fraction,
        )
    return ItemResult(tier="high", reason="verification passed, fully visible",
                       retake_instruction=None, visible_fraction=visible_fraction)
