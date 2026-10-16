from pipeline.types import VerificationResult, ItemResult

VISIBLE_FRACTION_MEDIUM_THRESHOLD = 0.6
# Non-blocking tip for items that ran past the photo edge and were completed by the model.
CUT_OFF_TIP = "For a cleaner result, step back so the whole piece fits in the frame"


def run(verification: VerificationResult | None, visible_fraction: float,
        max_attempts: int, cut_off: bool = False) -> ItemResult:
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
    if cut_off:
        return ItemResult(tier="medium", reason="ran past the photo edge; completed by the model",
                           retake_instruction=CUT_OFF_TIP, visible_fraction=visible_fraction)
    return ItemResult(tier="high", reason="verification passed, fully visible",
                       retake_instruction=None, visible_fraction=visible_fraction)
