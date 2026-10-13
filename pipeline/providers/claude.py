import json
import time
import base64
from anthropic import Anthropic
from pipeline.config import require_env
from pipeline.types import ItemFacts
from pipeline.run_log import RunLogger

MODEL = "claude-sonnet-4-6"
PROMPTS_DIR = __file__.rsplit("/providers/", 1)[0] + "/prompts"


def _read_prompt(name: str) -> str:
    with open(f"{PROMPTS_DIR}/{name}") as f:
        return f.read()


def _b64_image(path: str) -> str:
    with open(path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")


class ClaudeProvider:
    def __init__(self, logger: RunLogger | None = None):
        api_key = require_env("ANTHROPIC_API_KEY")
        self.client = Anthropic(api_key=api_key)
        self.logger = logger

    async def detect_items(self, image_path: str):
        raise NotImplementedError("ClaudeProvider is not used for stage1 detect in v0")

    async def extract_facts(self, crop_path: str, context_path: str | None) -> ItemFacts:
        start = time.monotonic()
        try:
            prompt = _read_prompt("stage3_facts_v1.txt")
            message = self.client.messages.create(
                model=MODEL, max_tokens=1024,
                messages=[{"role": "user", "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                                  "data": _b64_image(crop_path)}},
                    {"type": "text", "text": prompt + "\n\nRespond with JSON only."},
                ]}],
            )
            raw = json.loads(message.content[0].text)
            facts = ItemFacts.model_validate(raw)
            if self.logger:
                self.logger.log(stage="stage3_facts", model=MODEL, prompt_version="v1",
                                 latency_ms=(time.monotonic() - start) * 1000, status="ok")
            return facts
        except Exception as e:
            if self.logger:
                self.logger.log(stage="stage3_facts", model=MODEL, prompt_version="v1",
                                 latency_ms=(time.monotonic() - start) * 1000,
                                 status="error", error=str(e))
            raise

    async def judge(self, crop_path: str, generated_path: str, facts: ItemFacts) -> list[str]:
        start = time.monotonic()
        try:
            template = _read_prompt("stage5_judge_v1.txt")
            prompt = template.format(facts_block=facts.model_dump_json(indent=2))
            message = self.client.messages.create(
                model=MODEL, max_tokens=1024,
                messages=[{"role": "user", "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                                  "data": _b64_image(crop_path)}},
                    {"type": "image", "source": {"type": "base64", "media_type": "image/png",
                                                  "data": _b64_image(generated_path)}},
                    {"type": "text", "text": prompt + "\n\nRespond with JSON only."},
                ]}],
            )
            violations = json.loads(message.content[0].text)
            if self.logger:
                self.logger.log(stage="stage5_judge", model=MODEL, prompt_version="v1",
                                 latency_ms=(time.monotonic() - start) * 1000, status="ok")
            return violations
        except Exception as e:
            if self.logger:
                self.logger.log(stage="stage5_judge", model=MODEL, prompt_version="v1",
                                 latency_ms=(time.monotonic() - start) * 1000,
                                 status="error", error=str(e))
            raise

    async def generate(self, crop_path: str, facts: ItemFacts, violations):
        raise NotImplementedError("ClaudeProvider does not implement image generation")
