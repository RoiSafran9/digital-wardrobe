import json
import time
from google import genai
from pipeline.config import require_env
from pipeline.types import DetectedItem, ItemFacts
from pipeline.run_log import RunLogger

MODEL_VISION = "gemini-2.5-flash"
MODEL_IMAGE = "gemini-2.5-flash-image"

PROMPTS_DIR = __file__.rsplit("/providers/", 1)[0] + "/prompts"


def _read_prompt(name: str) -> str:
    with open(f"{PROMPTS_DIR}/{name}") as f:
        return f.read()


class GeminiProvider:
    def __init__(self, logger: RunLogger | None = None):
        api_key = require_env("GEMINI_API_KEY")
        self.client = genai.Client(api_key=api_key)
        self.logger = logger

    def _log(self, stage, prompt_version, start, status, error=None):
        if self.logger:
            self.logger.log(stage=stage, model=MODEL_VISION, prompt_version=prompt_version,
                             latency_ms=(time.monotonic() - start) * 1000,
                             status=status, error=error)

    async def detect_items(self, image_path: str) -> list[DetectedItem]:
        start = time.monotonic()
        try:
            with open(image_path, "rb") as f:
                image_bytes = f.read()
            prompt = _read_prompt("stage1_detect_v1.txt")
            response = self.client.models.generate_content(
                model=MODEL_VISION,
                contents=[{"inline_data": {"mime_type": "image/jpeg", "data": image_bytes}}, prompt],
            )
            raw = json.loads(response.text)
            items = [DetectedItem.model_validate(i) for i in raw]
            self._log("stage1_detect", "v1", start, "ok")
            return items
        except Exception as e:
            self._log("stage1_detect", "v1", start, "error", str(e))
            raise

    async def extract_facts(self, crop_path: str, context_path: str | None) -> ItemFacts:
        start = time.monotonic()
        try:
            with open(crop_path, "rb") as f:
                crop_bytes = f.read()
            prompt = _read_prompt("stage3_facts_v1.txt")
            response = self.client.models.generate_content(
                model=MODEL_VISION,
                contents=[{"inline_data": {"mime_type": "image/jpeg", "data": crop_bytes}}, prompt],
            )
            raw = json.loads(response.text)
            facts = ItemFacts.model_validate(raw)
            self._log("stage3_facts", "v1", start, "ok")
            return facts
        except Exception as e:
            self._log("stage3_facts", "v1", start, "error", str(e))
            raise

    async def judge(self, crop_path: str, generated_path: str, facts: ItemFacts) -> list[str]:
        raise NotImplementedError("judge is implemented by ClaudeProvider (must differ from generator)")

    async def generate(self, crop_path: str, facts: ItemFacts, violations: list[str] | None) -> str:
        start = time.monotonic()
        try:
            with open(crop_path, "rb") as f:
                crop_bytes = f.read()
            template = _read_prompt("stage4_generate_v1.txt")
            violations_block = ("\nPrevious attempt violations to fix:\n" + "\n".join(violations)
                                 if violations else "")
            prompt = template.format(facts_block=facts.model_dump_json(indent=2),
                                      violations_block=violations_block)
            response = self.client.models.generate_content(
                model=MODEL_IMAGE,
                contents=[{"inline_data": {"mime_type": "image/jpeg", "data": crop_bytes}}, prompt],
            )
            out_path = crop_path.rsplit(".", 1)[0] + "_generated.png"
            image_bytes = response.candidates[0].content.parts[0].inline_data.data
            with open(out_path, "wb") as f:
                f.write(image_bytes)
            self._log("stage4_generate", "v1", start, "ok")
            return out_path
        except Exception as e:
            self._log("stage4_generate", "v1", start, "error", str(e))
            raise
